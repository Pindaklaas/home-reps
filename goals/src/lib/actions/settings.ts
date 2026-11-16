"use server";

import { z } from "zod";
import { aiSettingsSchema, profileSchema, type ActionState } from "@/lib/validation";
import { ActionError, check, parseForm, runAction } from "./helpers";

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase, userId }) => {
    const { data, error } = parseForm(profileSchema, formData);
    if (error) return error;
    check(await supabase.from("profiles").update(data).eq("id", userId));
    return { ok: true, message: "Perfil guardado" };
  });
}

export async function updateAiSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase, userId }) => {
    const { data, error } = parseForm(aiSettingsSchema, formData);
    if (error) return error;
    check(await supabase.from("profiles").update(data).eq("id", userId));
    return { ok: true, message: "Preferencias de IA guardadas" };
  });
}

const passwordSchema = z
  .object({
    password: z.string().min(12, "Mínimo 12 caracteres").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden", path: ["confirm"] });

export async function changePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const { data, error } = parseForm(passwordSchema, formData);
    if (error) return error;
    const res = await supabase.auth.updateUser({ password: data.password });
    if (res.error) throw new ActionError(res.error.message.includes("different") ? "Usa una contraseña distinta de la actual" : "No se pudo cambiar la contraseña");
    return { ok: true, message: "Contraseña actualizada" };
  });
}

/** Signs out every session of this account (all devices). */
export async function signOutEverywhere(_: ActionState): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const res = await supabase.auth.signOut({ scope: "global" });
    if (res.error) throw new ActionError("No se pudo cerrar las sesiones");
    return { ok: true, message: "Se han cerrado todas las sesiones" };
  });
}

/** Saves the theme preference on the profile (the device applies it locally first). */
export async function saveTheme(theme: unknown): Promise<ActionState> {
  return runAction(async ({ supabase, userId }) => {
    const parsed = z.enum(["dark", "light", "system"]).safeParse(theme);
    if (!parsed.success) throw new ActionError("Tema no válido");
    check(await supabase.from("profiles").update({ theme: parsed.data }).eq("id", userId));
    return { ok: true };
  });
}
