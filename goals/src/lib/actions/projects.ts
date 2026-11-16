"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { projectSchema, type ActionState } from "@/lib/validation";
import { PROJECT_STATUSES } from "@/lib/constants";
import { ActionError, check, getId, parseForm, runAction } from "./helpers";

export async function createProject(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const { data, error } = parseForm(projectSchema, formData);
    if (error) return error;
    const res = await supabase.from("projects").insert(data).select("id").single();
    check(res);
    return { ok: true, message: "Proyecto creado", id: res.data!.id };
  });
}

export async function updateProject(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const { data, error } = parseForm(projectSchema, formData);
    if (error) return error;
    check(await supabase.from("projects").update(data).eq("id", id));
    return { ok: true, message: "Cambios guardados" };
  });
}

/** Saves just the notes/outcomes fields (autosave-style editor on the project page). */
const notesSchema = z.object({
  notes: z.string().max(20000).nullable(),
  outcomes: z.string().max(10000).nullable(),
});

export async function updateProjectNotes(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const parsed = notesSchema.safeParse({
      notes: (formData.get("notes") as string | null) || null,
      outcomes: (formData.get("outcomes") as string | null) || null,
    });
    if (!parsed.success) throw new ActionError("Texto demasiado largo");
    check(await supabase.from("projects").update(parsed.data).eq("id", id));
    return { ok: true, message: "Guardado" };
  });
}

export async function setProjectStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const status = z.enum(PROJECT_STATUSES).safeParse(formData.get("status"));
    if (!status.success) throw new ActionError("Estado no válido");
    check(await supabase.from("projects").update({ status: status.data }).eq("id", id));
    return { ok: true };
  });
}

export async function deleteProject(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async ({ supabase }) => {
    const id = getId(formData);
    check(await supabase.from("projects").delete().eq("id", id));
    return { ok: true };
  });
  if (result?.ok && formData.get("redirect") === "1") redirect("/projects");
  return result;
}
