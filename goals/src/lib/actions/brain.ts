"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/validation";
import { ActionError, check, runAction } from "./helpers";

/**
 * Chat without an API key: the message is saved and a Claude Code scheduled
 * task is woken (database RPC → API trigger). Claude answers in the same
 * conversation a minute or two later and a push notification announces it.
 */
const sendSchema = z.object({
  conversationId: z.uuid().nullable(),
  message: z.string().trim().min(1, "Escribe algo").max(8000, "Mensaje demasiado largo"),
});

export async function sendToBrain(input: { conversationId: string | null; message: string }): Promise<ActionState> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Mensaje no válido" };
  const { message } = parsed.data;
  let conversationId = parsed.data.conversationId;
  return runAction(async ({ supabase }) => {
    if (conversationId) {
      const conv = await supabase.from("ai_conversations").select("id").eq("id", conversationId).maybeSingle();
      if (!conv.data) throw new ActionError("Conversación no encontrada");
    } else {
      const conv = await supabase
        .from("ai_conversations")
        .insert({ title: message.replace(/\s+/g, " ").slice(0, 70) })
        .select("id")
        .single();
      check(conv);
      conversationId = conv.data!.id;
    }
    check(await supabase.from("ai_messages").insert({ conversation_id: conversationId, role: "user", content: message }));
    const fired = await supabase.rpc("request_brain_reply");
    if (fired.error) console.error("[brain]", fired.error);
    return { ok: true, id: conversationId, message: fired.data ?? "error" };
  });
}

/** Wakes Claude again for a conversation that is still waiting (e.g. after a failure). */
export async function nudgeBrain(): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const res = await supabase.rpc("request_brain_reply");
    check(res);
    return { ok: true, message: res.data ?? undefined };
  });
}

const tokenSchema = z
  .string()
  .trim()
  .max(512, "Ese código es demasiado largo")
  .regex(/^[A-Za-z0-9._-]*$/, "Pega solo el código, sin espacios ni comillas");

export async function saveBrainToken(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = tokenSchema.safeParse(formData.get("token") ?? "");
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Código no válido" };
  return runAction(async ({ supabase }) => {
    check(await supabase.rpc("set_brain_token", { p_token: parsed.data }));
    return { ok: true, message: parsed.data ? "Conectado. Ya puedes escribir a Claude desde el chat." : "Desconectado." };
  });
}
