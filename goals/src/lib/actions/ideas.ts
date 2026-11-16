"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ideaSchema, type ActionState } from "@/lib/validation";
import { IDEA_STATUSES } from "@/lib/constants";
import { ActionError, check, getId, parseForm, runAction } from "./helpers";

export async function createIdea(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const { data, error } = parseForm(ideaSchema, formData);
    if (error) return error;
    const res = await supabase.from("ideas").insert(data).select("id").single();
    check(res);
    return { ok: true, message: "Idea guardada", id: res.data!.id };
  });
}

export async function updateIdea(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const { data, error } = parseForm(ideaSchema, formData);
    if (error) return error;
    check(await supabase.from("ideas").update(data).eq("id", id));
    return { ok: true, message: "Cambios guardados" };
  });
}

export async function setIdeaStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    const status = z.enum(IDEA_STATUSES).safeParse(formData.get("status"));
    if (!status.success) throw new ActionError("Estado no válido");
    check(await supabase.from("ideas").update({ status: status.data }).eq("id", id));
    return { ok: true };
  });
}

/** Creates a project from an idea. The idea is kept and linked, never removed. */
export async function convertIdeaToProject(_: ActionState, formData: FormData): Promise<ActionState> {
  let projectId: string | undefined;
  const result = await runAction(async ({ supabase }) => {
    const id = getId(formData);
    const idea = await supabase.from("ideas").select("*").eq("id", id).single();
    check(idea);
    if (idea.data!.converted_project_id) throw new ActionError("Esta idea ya se convirtió en proyecto");
    const project = await supabase
      .from("projects")
      .insert({
        title: idea.data!.title,
        description: idea.data!.description,
        status: "planned",
        notes: `Creado desde la idea «${idea.data!.title}».`,
      })
      .select("id")
      .single();
    check(project);
    projectId = project.data!.id;
    check(await supabase.from("ideas").update({ status: "converted", converted_project_id: projectId }).eq("id", id));
    return { ok: true, id: projectId };
  });
  if (result?.ok && projectId) redirect(`/projects/${projectId}`);
  return result;
}

/** Deleting an idea is always an explicit user action, confirmed in the UI. */
export async function deleteIdea(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const id = getId(formData);
    check(await supabase.from("ideas").delete().eq("id", id));
    return { ok: true };
  });
}
