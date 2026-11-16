"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import type { ActionState } from "@/lib/validation";

const credentials = z.object({
  email: z.email("Introduce un email válido").transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Introduce la contraseña").max(200),
  next: z.string().optional(),
});

const GENERIC_ERROR = "Email o contraseña incorrectos.";

/** Only same-site relative paths are allowed as post-login destinations. */
function safeNext(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export async function signInWithPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const { email, password, next } = parsed.data;
  // Refuse any account other than the owner before touching Supabase.
  if (email !== serverEnv().OWNER_EMAIL) return { ok: false, error: GENERIC_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 429) return { ok: false, error: "Demasiados intentos. Espera unos minutos." };
    return { ok: false, error: GENERIC_ERROR };
  }

  const { data: authorized, error: rpcError } = await supabase.rpc("is_authorized");
  if (rpcError) {
    await supabase.auth.signOut();
    return { ok: false, error: "No se pudo verificar el acceso con la base de datos. Inténtalo de nuevo en unos segundos." };
  }
  if (!authorized) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error: "La cuenta existe pero no está en la lista de acceso de la base de datos. Revisa el paso «Autorizar al propietario» del README.",
    };
  }

  redirect(safeNext(next));
}

const magicSchema = z.object({
  email: z.email("Introduce un email válido").transform((v) => v.trim().toLowerCase()),
});

export async function sendMagicLink(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = magicSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Email no válido" };
  const sent: ActionState = { ok: true, message: "Si el email es correcto, recibirás un enlace de acceso en unos segundos." };

  // Same answer for any address, so the form doesn't reveal who the owner is.
  if (parsed.data.email !== serverEnv().OWNER_EMAIL) return sent;

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error?.status === 429) return { ok: false, error: "Demasiadas solicitudes. Espera un minuto." };
  return sent;
}
