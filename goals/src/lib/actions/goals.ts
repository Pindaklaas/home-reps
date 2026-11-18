"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { formatNumber } from "@/lib/format";
import { goalCheckinSchema, goalSchema, text, type ActionState } from "@/lib/validation";
import { GOAL_STATUSES } from "@/lib/constants";
import { check, getId, parseForm, runAction, ActionError } from "./helpers";
import type { ServerSupabase } from "@/lib/supabase/server";

async function clearOtherPrimary(supabase: ServerSupabase, keepId?: string) {
  let q = supabase.from("goals").update({ is_primary: false }).eq("is_primary", true);
  if (keepId) q = q.neq("id", keepId);
  check(await q);
}

export async function createGoal(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const { data, error } = parseForm(goalSchema, formData);
    if (error) return error;
    if (data.is_primary) await clearOtherPrimary(supabase);
    const res = await supabase.from("goals").insert(data).select("id").single();
    check(res);
    return { ok: true, message: "Objetivo creado", id: res.data!.id };
  });
}

export async function updateGoal(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const { data, error } = parseForm(goalSchema, formData);
    if (error) return error;
    if (data.is_primary) await clearOtherPrimary(supabase, id);
    check(await supabase.from("goals").update(data).eq("id", id));
    return { ok: true, message: "Cambios guardados" };
  });
}

const statusSchema = z.enum(GOAL_STATUSES);

export async function setGoalStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const status = statusSchema.safeParse(formData.get("status"));
    if (!status.success) throw new ActionError("Estado no válido");
    const patch: { status: typeof status.data; is_primary?: boolean } = { status: status.data };
    if (status.data !== "active") patch.is_primary = false;
    check(await supabase.from("goals").update(patch).eq("id", id));
    return { ok: true };
  });
}

export async function makePrimaryGoal(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    await clearOtherPrimary(supabase, id);
    check(await supabase.from("goals").update({ is_primary: true, status: "active" }).eq("id", id));
    return { ok: true };
  });
}

export async function deleteGoal(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async ({ supabase }) => {
    const id = getId(formData);
    check(await supabase.from("goals").delete().eq("id", id));
    return { ok: true };
  });
  if (result?.ok && formData.get("redirect") === "1") redirect("/goals");
  return result;
}

export async function addGoalCheckin(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const { data, error } = parseForm(goalCheckinSchema, formData);
    if (error) return error;
    check(await supabase.from("goal_checkins").insert(data));
    return { ok: true, message: "Valor registrado" };
  });
}

const incomeSchema = z.object({
  goal_id: z.uuid(),
  amount: z.coerce.number({ message: "Escribe una cantidad" }).finite().positive("La cantidad tiene que ser mayor que 0").max(1_000_000, "Cantidad demasiado grande"),
  note: text(200),
});

/** "He ganado dinero": adds an amount to the goal's metric (a new check-in with the new total). */
export async function addIncome(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const { data, error } = parseForm(incomeSchema, formData);
    if (error) return error;
    const goal = await supabase.from("goals").select("metric_current, metric_unit").eq("id", data.goal_id).single();
    check(goal);
    const total = Number(goal.data!.metric_current ?? 0) + data.amount;
    const unit = goal.data!.metric_unit ?? "";
    const n = (x: number) => formatNumber(x, 2);
    check(await supabase.from("goal_checkins").insert({ goal_id: data.goal_id, value: total, note: data.note ?? `+${n(data.amount)} ${unit}`.trim() }));
    return { ok: true, message: `+${n(data.amount)} ${unit} · ya llevas ${n(total)} ${unit}` };
  });
}
