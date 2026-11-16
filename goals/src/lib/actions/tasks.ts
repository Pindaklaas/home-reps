"use server";

import { z } from "zod";
import { taskSchema, timeEntrySchema, type ActionState } from "@/lib/validation";
import { TASK_STATUSES } from "@/lib/constants";
import { ActionError, check, getId, parseForm, runAction } from "./helpers";

export async function createTask(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const { data, error } = parseForm(taskSchema, formData);
    if (error) return error;
    const res = await supabase.from("tasks").insert(data).select("id").single();
    check(res);
    return { ok: true, message: "Tarea creada", id: res.data!.id };
  });
}

export async function updateTask(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const { data, error } = parseForm(taskSchema, formData);
    if (error) return error;
    // Unscheduling a task also drops its focus slot.
    const patch = data.scheduled_date ? data : { ...data, focus_rank: null };
    check(await supabase.from("tasks").update(patch).eq("id", id));
    return { ok: true, message: "Cambios guardados" };
  });
}

export async function setTaskStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const status = z.enum(TASK_STATUSES).safeParse(formData.get("status"));
    if (!status.success) throw new ActionError("Estado no válido");
    check(await supabase.from("tasks").update({ status: status.data }).eq("id", id));
    return { ok: true };
  });
}

/** Toggles completed <-> pending. */
export async function toggleTask(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const current = await supabase.from("tasks").select("status").eq("id", id).single();
    check(current);
    const next = current.data!.status === "completed" ? "pending" : "completed";
    check(await supabase.from("tasks").update({ status: next }).eq("id", id));
    return { ok: true };
  });
}

const scheduleSchema = z.object({
  date: z.preprocess((v) => (v === "" ? null : v), z.iso.date().nullable()),
});

export async function scheduleTask(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const parsed = scheduleSchema.safeParse({ date: formData.get("date") });
    if (!parsed.success) throw new ActionError("Fecha no válida");
    check(
      await supabase
        .from("tasks")
        .update({ scheduled_date: parsed.data.date, focus_rank: null })
        .eq("id", id),
    );
    return { ok: true };
  });
}

const focusSchema = z.object({
  date: z.iso.date(),
  rank: z.preprocess((v) => (v === "" || v === "0" ? null : v), z.coerce.number().int().min(1).max(3).nullable()),
});

/** Puts a task in one of the day's three priority slots, freeing the slot first. */
export async function setFocus(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const parsed = focusSchema.safeParse({ date: formData.get("date"), rank: formData.get("rank") });
    if (!parsed.success) throw new ActionError("Prioridad no válida");
    const { date, rank } = parsed.data;
    if (rank !== null) {
      check(
        await supabase.from("tasks").update({ focus_rank: null }).eq("scheduled_date", date).eq("focus_rank", rank).neq("id", id),
      );
    }
    check(await supabase.from("tasks").update({ scheduled_date: date, focus_rank: rank }).eq("id", id));
    return { ok: true };
  });
}

export async function logTime(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const { data, error } = parseForm(timeEntrySchema, formData);
    if (error) return error;
    const loggedOn = z.iso.date().safeParse(formData.get("logged_on"));
    check(await supabase.from("time_entries").insert({ ...data, ...(loggedOn.success ? { logged_on: loggedOn.data } : {}) }));
    return { ok: true, message: `${data.minutes} min registrados` };
  });
}

export async function deleteTask(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    check(await supabase.from("tasks").delete().eq("id", id));
    return { ok: true };
  });
}
