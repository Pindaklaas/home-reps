import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { aiConfigured, aiErrorMessage, aiModel, anthropic, FALLBACK_BETA } from "@/lib/ai/client";
import { buildContext } from "@/lib/ai/context";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { PROPOSAL_TOOLS, TOOL_NAMES, type ToolName } from "@/lib/ai/tools";
import { proposalsFromToolCall } from "@/lib/ai/proposals";
import { closeDanglingToolUses, toApiMessages, type StoredMessage } from "@/lib/ai/history";
import { todayIn } from "@/lib/dates";
import type { Json } from "@/lib/supabase/database.types";

export const maxDuration = 300;

const bodySchema = z.object({
  conversationId: z.uuid().nullable().optional(),
  message: z.string().trim().min(1, "Escribe un mensaje").max(8000, "Mensaje demasiado largo"),
});

const MAX_STEPS = 6;

/** NDJSON event stream consumed by components/brain/chat.tsx */
export type ChatEvent =
  | { type: "conversation"; id: string; title: string }
  | { type: "text"; delta: string }
  | { type: "status"; text: string }
  | { type: "proposals"; items: { id: string; action: string; summary: string; rationale: string | null }[] }
  | { type: "done"; messageId: string | null }
  | { type: "error"; message: string };

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!aiConfigured()) {
    return Response.json({ error: "Claude no está configurado. Añade ANTHROPIC_API_KEY en el servidor." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Petición no válida" }, { status: 400 });
  const { message } = parsed.data;

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (profile && !profile.ai_enabled) return Response.json({ error: "La IA está desactivada en Ajustes." }, { status: 403 });
  const tz = profile?.timezone ?? "Europe/Madrid";
  const today = todayIn(tz);

  // Conversation: existing (RLS guarantees it is ours) or new.
  let conversationId = parsed.data.conversationId ?? null;
  let title = "";
  if (conversationId) {
    const conv = await supabase.from("ai_conversations").select("id, title").eq("id", conversationId).maybeSingle();
    if (!conv.data) return Response.json({ error: "Conversación no encontrada" }, { status: 404 });
    title = conv.data.title;
  } else {
    title = message.replace(/\s+/g, " ").slice(0, 70);
    const conv = await supabase.from("ai_conversations").insert({ title }).select("id").single();
    if (conv.error) return Response.json({ error: "No se pudo crear la conversación" }, { status: 500 });
    conversationId = conv.data.id;
  }

  const historyRes = await supabase
    .from("ai_messages")
    .select("id, role, content, api_content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(400);
  const history = (historyRes.data ?? []) as StoredMessage[];

  // GOALS data goes in as a mid-conversation system message right after the
  // user's message: the stable system prompt and earlier turns stay cached,
  // and the snapshot is stored with the turn so history is append-only.
  const context = profile?.ai_include_context === false
    ? `Fecha de hoy: ${today}. (El usuario ha desactivado el envío del contexto de GOALS: no tienes acceso a sus datos.)`
    : await buildContext(supabase, { profile, today, tz });
  const userTurn: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: message },
    { role: "system", content: `<contexto_goals actualizado="${new Date().toISOString()}">\n${context}\n</contexto_goals>` },
  ];

  const userRow = await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversationId, role: "user", content: message, api_content: userTurn as unknown as Json })
    .select("id")
    .single();
  if (userRow.error) return Response.json({ error: "No se pudo guardar el mensaje" }, { status: 500 });

  const effort = (profile?.ai_effort ?? "medium") as "low" | "medium" | "high";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ChatEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      send({ type: "conversation", id: conversationId!, title });

      const messages: Anthropic.Beta.BetaMessageParam[] = [...toApiMessages(history), ...userTurn];
      const turn: Anthropic.Beta.BetaMessageParam[] = []; // assistant + tool_result messages produced now
      let text = "";
      let lastStop: string | null = null;
      const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
      let jsonRetries = 0;

      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          const s = anthropic().beta.messages.stream(
            {
              model: aiModel(),
              max_tokens: 64000,
              betas: [FALLBACK_BETA],
              fallbacks: "default",
              cache_control: { type: "ephemeral" },
              system: [{ type: "text", text: SYSTEM_PROMPT }],
              output_config: { effort },
              tools: PROPOSAL_TOOLS,
              messages: [...messages, ...turn],
            },
            { signal: request.signal },
          );
          s.on("text", (delta) => {
            text += delta;
            send({ type: "text", delta });
          });

          let msg: Anthropic.Beta.BetaMessage;
          try {
            msg = await s.finalMessage();
            jsonRetries = 0;
          } catch (err) {
            // A tool input the SDK could not parse at all: re-issue this step.
            if (err instanceof Anthropic.APIError || request.signal.aborted || jsonRetries++ >= 2) throw err;
            continue;
          }

          lastStop = msg.stop_reason;
          usage.input_tokens += msg.usage.input_tokens ?? 0;
          usage.output_tokens += msg.usage.output_tokens ?? 0;
          usage.cache_read_input_tokens += msg.usage.cache_read_input_tokens ?? 0;
          usage.cache_creation_input_tokens += msg.usage.cache_creation_input_tokens ?? 0;

          // Keep the assistant turn exactly as returned (thinking blocks included).
          turn.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });

          if (msg.stop_reason === "refusal") {
            const note = "\n\n_Claude ha declinado continuar con esta petición._";
            text += note;
            send({ type: "text", delta: note });
            break;
          }
          if (msg.stop_reason === "pause_turn") continue;

          const toolUses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          // Only run tools on a clean tool_use stop: an input cut off at
          // max_tokens can still look valid, so it is never executed.
          if (msg.stop_reason !== "tool_use" || toolUses.length === 0) break;

          send({ type: "status", text: "Preparando propuestas…" });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          const created: { id: string; action: string; summary: string; rationale: string | null }[] = [];

          for (const tu of toolUses) {
            if (!TOOL_NAMES.includes(tu.name as ToolName)) {
              results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Herramienta desconocida: ${tu.name}` });
              continue;
            }
            const conv = proposalsFromToolCall(tu.name as ToolName, tu.input);
            if (!conv.ok) {
              results.push({
                type: "tool_result",
                tool_use_id: tu.id,
                is_error: true,
                content: JSON.stringify({ INVALID_INPUT: conv.error }),
              });
              continue;
            }
            const ins = await supabase
              .from("ai_proposals")
              .insert(conv.rows.map((r) => ({ ...r, conversation_id: conversationId, message_id: userRow.data.id })))
              .select("id, action, summary, rationale");
            if (ins.error) {
              results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: "No se pudo registrar la propuesta." });
              continue;
            }
            created.push(...ins.data);
            results.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: `Registrada${ins.data.length > 1 ? "s" : ""} ${ins.data.length} propuesta${ins.data.length > 1 ? "s" : ""} (${ins.data.map((r) => r.id).join(", ")}). Estado: PENDIENTE de aprobación del usuario. No se ha aplicado ningún cambio.`,
            });
          }
          if (created.length) send({ type: "proposals", items: created });
          turn.push({ role: "user", content: results });
        }

        closeDanglingToolUses(turn);
        const saved = await supabase
          .from("ai_messages")
          .insert({
            conversation_id: conversationId,
            role: "assistant",
            content: text.trim() || "(sin texto)",
            api_content: turn as unknown as Json,
            model: aiModel(),
            usage: usage as unknown as Json,
            stop_reason: lastStop,
          })
          .select("id")
          .single();
        send({ type: "done", messageId: saved.data?.id ?? null });
      } catch (e) {
        if (!request.signal.aborted) {
          console.error("[ai.chat]", e);
          send({ type: "error", message: aiErrorMessage(e) });
        }
        // Keep whatever complete steps happened, so the history stays consistent.
        if (turn.length) {
          closeDanglingToolUses(turn);
          await supabase.from("ai_messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: text.trim() || "(respuesta interrumpida)",
            api_content: turn as unknown as Json,
            model: aiModel(),
            usage: usage as unknown as Json,
            stop_reason: "interrupted",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
