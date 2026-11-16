"use server";

import { z } from "zod";
import { decisionSchema, memorySchema, type ActionState } from "@/lib/validation";
import { DECISION_STATUSES } from "@/lib/constants";
import { ActionError, check, getId, parseForm, runAction } from "./helpers";

export async function createDecision(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const { data, error } = parseForm(decisionSchema, formData);
    if (error) return error;
    check(await supabase.from("decisions").insert({ ...data, source: "user" }));
    return { ok: true, message: "Decisión registrada" };
  });
}

export async function setDecisionStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const status = z.enum(DECISION_STATUSES).safeParse(formData.get("status"));
    if (!status.success) throw new ActionError("Estado no válido");
    check(await supabase.from("decisions").update({ status: status.data }).eq("id", id));
    return { ok: true };
  });
}

export async function deleteDecision(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    check(await supabase.from("decisions").delete().eq("id", getId(formData)));
    return { ok: true };
  });
}

export async function createMemory(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const { data, error } = parseForm(memorySchema, formData);
    if (error) return error;
    // Anything the user writes themself is confirmed by definition, except ideas.
    const confirmed = data.kind === "idea" ? false : true;
    check(await supabase.from("ai_memory").insert({ ...data, confirmed, source: "user" }));
    return { ok: true, message: "Guardado en memoria" };
  });
}

export async function confirmMemory(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const confirmed = formData.get("confirmed") !== "false";
    check(await supabase.from("ai_memory").update({ confirmed }).eq("id", getId(formData)));
    return { ok: true };
  });
}

export async function togglePinMemory(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const cur = await supabase.from("ai_memory").select("pinned").eq("id", id).single();
    check(cur);
    check(await supabase.from("ai_memory").update({ pinned: !cur.data!.pinned }).eq("id", id));
    return { ok: true };
  });
}

export async function deleteMemory(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    check(await supabase.from("ai_memory").delete().eq("id", getId(formData)));
    return { ok: true };
  });
}
