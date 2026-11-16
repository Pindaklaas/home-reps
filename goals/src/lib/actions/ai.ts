"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { aiErrorMessage, aiModel, anthropic, AiNotConfiguredError, FALLBACK_BETA } from "@/lib/ai/client";
import { buildContext } from "@/lib/ai/context";
import { SYSTEM_PROMPT, ANALYST_SYSTEM, DAILY_RECOMMENDATION_PROMPT, DAY_PLAN_PROMPT, IDEA_EVALUATION_PROMPT, WEEKLY_REVIEW_PROMPT } from "@/lib/ai/prompts";
import { dailyRecommendationSchema, dayPlanSchema, ideaEvaluationSchema, weeklyReviewSchema } from "@/lib/ai/schemas";
import { applyProposal, ProposalError } from "@/lib/ai/proposals";
import { PROPOSAL_TOOLS } from "@/lib/ai/tools";
import { closeDanglingToolUses } from "@/lib/ai/history";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { todayIn } from "@/lib/dates";
import type { ActionState } from "@/lib/validation";
import { ActionError, check, getId, runAction } from "./helpers";

type Effort = "low" | "medium" | "high";

async function loadProfile(supabase: ServerSupabase, userId: string) {
  const res = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  const profile = res.data;
  if (profile && !profile.ai_enabled) throw new ActionError("La IA está desactivada en Ajustes.");
  const tz = profile?.timezone ?? "Europe/Madrid";
  return { profile, tz, today: todayIn(tz) };
}

/**
 * One structured call to Claude. The schema is sent as the output format and
 * the parsed result is validated again here before it is returned.
 */
async function structured<S extends z.ZodType>(opts: {
  schema: S;
  context: string;
  instruction: string;
  effort: Effort;
}): Promise<z.infer<S>> {
  let response;
  try {
    response = await anthropic().beta.messages.parse({
      model: aiModel(),
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: [
        { type: "text", text: ANALYST_SYSTEM },
        { type: "text", text: `<contexto_goals>\n${opts.context}\n</contexto_goals>` },
      ],
      output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      messages: [{ role: "user", content: opts.instruction }],
    });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) throw new ActionError(e.message);
    console.error("[ai.structured]", e);
    throw new ActionError(aiErrorMessage(e));
  }
  if (response.stop_reason === "refusal") throw new ActionError("Claude ha declinado esta petición.");
  if (response.stop_reason === "max_tokens") throw new ActionError("La respuesta de Claude quedó cortada. Inténtalo de nuevo.");
  const checked = opts.schema.safeParse(response.parsed_output);
  if (!checked.success) throw new ActionError("Claude devolvió una respuesta con un formato inesperado. Inténtalo de nuevo.");
  return checked.data;
}

// ---------------------------------------------------------------------------
// Ideas
// ---------------------------------------------------------------------------
export async function evaluateIdea(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase, userId }) => {
    const id = getId(formData);
    const { profile, tz, today } = await loadProfile(supabase, userId);
    const idea = await supabase.from("ideas").select("*").eq("id", id).single();
    check(idea);
    const i = idea.data!;
    const context = await buildContext(supabase, { profile, today, tz });
    const evaluation = await structured({
      schema: ideaEvaluationSchema,
      context,
      effort: (profile?.ai_effort as Effort) ?? "medium",
      instruction: `${IDEA_EVALUATION_PROMPT}\n\nIdea a evaluar:\n- Título: ${i.title}\n- Descripción: ${i.description ?? "(sin descripción)"}\n- Categoría: ${i.category}\n- Potencial según el usuario: ${i.potential ?? "sin valorar"}/5\n- Dificultad según el usuario: ${i.difficulty ?? "sin valorar"}/5\n- Coste estimado: ${i.estimated_cost ?? "desconocido"} ${i.currency}\n- Estado: ${i.status}`,
    });
    check(
      await supabase
        .from("ideas")
        .update({ ai_evaluation: evaluation as unknown as Json, ai_evaluated_at: new Date().toISOString() })
        .eq("id", id),
    );
    return { ok: true, message: "Evaluación lista" };
  });
}

// ---------------------------------------------------------------------------
// Daily recommendation and plan
// ---------------------------------------------------------------------------
export async function generateRecommendation(_: ActionState): Promise<ActionState> {
  return runAction(async ({ supabase, userId }) => {
    const { profile, tz, today } = await loadProfile(supabase, userId);
    const context = await buildContext(supabase, { profile, today, tz });
    const rec = await structured({
      schema: dailyRecommendationSchema,
      context,
      effort: "low",
      instruction: DAILY_RECOMMENDATION_PROMPT,
    });
    check(
      await supabase.from("daily_logs").upsert(
        { log_date: today, ai_recommendation: rec as unknown as Json, ai_recommendation_at: new Date().toISOString() },
        { onConflict: "user_id,log_date" },
      ),
    );
    return { ok: true };
  });
}

const planRequest = z.object({
  date: z.iso.date(),
  start: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
  minutes: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(15).max(1440).nullable()),
});

export async function generateDayPlan(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase, userId }) => {
    const parsed = planRequest.safeParse({ date: formData.get("date"), start: formData.get("start") || undefined, minutes: formData.get("minutes") });
    if (!parsed.success) throw new ActionError("Datos del plan no válidos");
    const { date, start, minutes } = parsed.data;
    const { profile, tz, today } = await loadProfile(supabase, userId);
    const context = await buildContext(supabase, { profile, today, tz });
    const available = minutes ?? profile?.daily_capacity_minutes ?? 360;
    const plan = await structured({
      schema: dayPlanSchema,
      context,
      effort: (profile?.ai_effort as Effort) ?? "medium",
      instruction: `${DAY_PLAN_PROMPT}\n\nDía a planificar: ${date}. Hora de inicio: ${start}. Tiempo disponible: ${available} minutos.`,
    });
    // Keep only task ids that really exist and are open: Claude must not invent them.
    const ids = [...new Set([...plan.priorities.map((p) => p.task_id), ...plan.blocks.map((b) => b.task_id).filter(Boolean) as string[], ...plan.deferred_task_ids])];
    const valid = ids.length
      ? new Set((await supabase.from("tasks").select("id").in("id", ids.filter((i) => z.uuid().safeParse(i).success)).in("status", ["pending", "in_progress"])).data?.map((r) => r.id) ?? [])
      : new Set<string>();
    const clean = {
      ...plan,
      priorities: plan.priorities.filter((p) => valid.has(p.task_id)).slice(0, 3),
      blocks: plan.blocks.map((b) => ({ ...b, task_id: b.task_id && valid.has(b.task_id) ? b.task_id : null })),
      deferred_task_ids: plan.deferred_task_ids.filter((t) => valid.has(t)),
      available_minutes: available,
      start,
    };
    check(
      await supabase
        .from("daily_logs")
        .upsert({ log_date: date, ai_plan: clean as unknown as Json, ai_plan_at: new Date().toISOString() }, { onConflict: "user_id,log_date" }),
    );
    return { ok: true, message: "Plan propuesto. Revísalo antes de aplicarlo." };
  });
}

/** The user accepts Claude's plan: schedule its tasks and set the 1-3 priorities. */
export async function applyDayPlan(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const date = z.iso.date().safeParse(formData.get("date"));
    if (!date.success) throw new ActionError("Fecha no válida");
    const log = await supabase.from("daily_logs").select("ai_plan").eq("log_date", date.data).maybeSingle();
    check(log);
    const plan = dayPlanSchema.safeParse(log.data?.ai_plan);
    if (!plan.success) throw new ActionError("No hay un plan válido para aplicar");

    const blockIds = plan.data.blocks.map((b) => b.task_id).filter((x): x is string => Boolean(x));
    const scheduleIds = [...new Set([...plan.data.priorities.map((p) => p.task_id), ...blockIds])];
    // Free the day's priority slots, then assign them in plan order.
    check(await supabase.from("tasks").update({ focus_rank: null }).eq("scheduled_date", date.data).not("focus_rank", "is", null));
    if (scheduleIds.length) check(await supabase.from("tasks").update({ scheduled_date: date.data }).in("id", scheduleIds));
    for (const [i, p] of plan.data.priorities.slice(0, 3).entries()) {
      check(await supabase.from("tasks").update({ scheduled_date: date.data, focus_rank: i + 1 }).eq("id", p.task_id));
    }
    if (plan.data.deferred_task_ids.length) {
      check(
        await supabase
          .from("tasks")
          .update({ scheduled_date: null, focus_rank: null })
          .in("id", plan.data.deferred_task_ids)
          .eq("scheduled_date", date.data),
      );
    }
    return { ok: true, message: "Plan aplicado" };
  });
}

export async function discardDayPlan(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const date = z.iso.date().safeParse(formData.get("date"));
    if (!date.success) throw new ActionError("Fecha no válida");
    check(await supabase.from("daily_logs").update({ ai_plan: null, ai_plan_at: null }).eq("log_date", date.data));
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Connection check: the same request shapes the app uses, kept tiny.
// ---------------------------------------------------------------------------
export async function checkClaude(_: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const started = Date.now();
    // 1. Structured output (ideas, recommendation, plan, weekly review use this path).
    const probe = await structured({
      schema: z.object({ ok: z.boolean(), reply: z.string() }),
      context: "Prueba de conexión de GOALS. No hay datos del usuario.",
      instruction: "Devuelve ok=true y reply con la palabra «listo».",
      effort: "low",
    });
    if (!probe.ok) throw new ActionError("Claude respondió, pero la respuesta estructurada no fue la esperada.");

    // 2. Chat turn: streaming, propose_* tools and the context as a mid-conversation system message.
    let stop: string | null = null;
    let served = aiModel();
    try {
      const stream = anthropic().beta.messages.stream({
        model: aiModel(),
        max_tokens: 2000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        cache_control: { type: "ephemeral" },
        system: [{ type: "text", text: SYSTEM_PROMPT }],
        output_config: { effort: "low" },
        tools: PROPOSAL_TOOLS,
        messages: [
          { role: "user", content: "Prueba de conexión: responde solo «listo», sin usar herramientas." },
          { role: "system", content: "<contexto_goals>Prueba de conexión; sin datos.</contexto_goals>" },
        ],
      });
      const msg = await stream.finalMessage();
      stop = msg.stop_reason;
      served = msg.model;
      // Nothing is stored; this only keeps the shape identical to the real chat loop.
      closeDanglingToolUses([{ role: "assistant", content: msg.content as never }]);
    } catch (e) {
      console.error("[ai.check]", e);
      throw new ActionError(`El chat falló: ${aiErrorMessage(e)}`);
    }
    if (stop === "refusal") throw new ActionError("Claude declinó la prueba de chat.");
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    return { ok: true, message: `Claude funciona (${served}, ${seconds} s): respuestas estructuradas y chat con herramientas correctos.` };
  });
}

// ---------------------------------------------------------------------------
// Weekly review (stored as a "summary" memory: Claude's view, not a fact)
// ---------------------------------------------------------------------------
export async function generateWeeklyReview(_: ActionState): Promise<ActionState> {
  return runAction(async ({ supabase, userId }) => {
    const { profile, tz, today } = await loadProfile(supabase, userId);
    const context = await buildContext(supabase, { profile, today, tz });
    const review = await structured({ schema: weeklyReviewSchema, context, effort: (profile?.ai_effort as Effort) ?? "medium", instruction: WEEKLY_REVIEW_PROMPT });
    const text = [
      review.summary,
      review.wins.length ? `Logros: ${review.wins.join("; ")}` : "",
      review.misses.length ? `Pendiente: ${review.misses.join("; ")}` : "",
      review.patterns.length ? `Patrones: ${review.patterns.join("; ")}` : "",
      review.focus_next_week.length ? `Foco próxima semana: ${review.focus_next_week.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    check(
      await supabase.from("ai_memory").insert({
        kind: "summary",
        content: text.slice(0, 4000),
        confirmed: false,
        source: "ai",
        period_end: today,
      }),
    );
    return { ok: true, message: "Revisión semanal guardada en la memoria" };
  });
}

// ---------------------------------------------------------------------------
// Proposals: the explicit-approval gate
// ---------------------------------------------------------------------------
async function decide(supabase: ServerSupabase, id: string, approve: boolean): Promise<ActionState> {
  const res = await supabase.from("ai_proposals").select("*").eq("id", id).maybeSingle();
  check(res);
  const p = res.data;
  if (!p) throw new ActionError("La propuesta ya no existe");
  if (p.status !== "pending") throw new ActionError("Esta propuesta ya se decidió");
  const now = new Date().toISOString();

  if (!approve) {
    check(await supabase.from("ai_proposals").update({ status: "rejected", decided_at: now }).eq("id", id).eq("status", "pending"));
    return { ok: true, message: "Propuesta rechazada" };
  }

  // Claim it first so a double click cannot apply it twice.
  const claim = await supabase.from("ai_proposals").update({ status: "approved", decided_at: now }).eq("id", id).eq("status", "pending").select("id");
  check(claim);
  if (!claim.data?.length) throw new ActionError("Esta propuesta ya se decidió");

  try {
    const entityId = await applyProposal(supabase, p);
    check(await supabase.from("ai_proposals").update({ status: "applied", applied_entity_id: entityId, error: null }).eq("id", id));
    return { ok: true, message: "Aplicada", id: entityId };
  } catch (e) {
    const msg = e instanceof ProposalError || e instanceof ActionError ? e.message : "Error al aplicar";
    await supabase.from("ai_proposals").update({ status: "failed", error: msg.slice(0, 500) }).eq("id", id);
    return { ok: false, error: msg };
  }
}

export async function approveProposal(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(({ supabase }) => decide(supabase, getId(formData), true));
}

export async function rejectProposal(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(({ supabase }) => decide(supabase, getId(formData), false));
}

/** Approves, one by one, every pending proposal the user is looking at. */
export async function approveProposals(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const ids = z.array(z.uuid()).min(1).max(50).safeParse(formData.getAll("ids"));
    if (!ids.success) throw new ActionError("Nada que aprobar");
    let applied = 0;
    const errors: string[] = [];
    for (const id of ids.data) {
      const r = await decide(supabase, id, true).catch((e: Error) => ({ ok: false as const, error: e.message }));
      if (r?.ok) applied++;
      else if (r && !r.ok) errors.push(r.error);
    }
    if (errors.length && !applied) return { ok: false, error: errors[0] };
    return { ok: true, message: `${applied} aplicadas${errors.length ? `, ${errors.length} con error` : ""}` };
  });
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------
export async function renameConversation(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const title = z.string().trim().min(1).max(160).safeParse(formData.get("title"));
    if (!title.success) throw new ActionError("Título no válido");
    check(await supabase.from("ai_conversations").update({ title: title.data }).eq("id", getId(formData)));
    return { ok: true };
  });
}

export async function deleteConversation(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async ({ supabase }) => {
    check(await supabase.from("ai_conversations").delete().eq("id", getId(formData)));
    return { ok: true };
  });
  if (result?.ok) redirect("/brain");
  return result;
}
