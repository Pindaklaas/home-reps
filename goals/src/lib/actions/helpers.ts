import "server-only";
import { refresh } from "next/cache";
import { z } from "zod";
import { authedClient, UnauthorizedError } from "@/lib/auth";
import type { ServerSupabase } from "@/lib/supabase/server";
import { formToObject, validationError, type ActionState } from "@/lib/validation";

type Ctx = { supabase: ServerSupabase; userId: string };

/** Maps Postgres/PostgREST errors to messages a person can act on. */
export function dbErrorMessage(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "23505":
      return "Ya existe un registro que choca con este (por ejemplo, otro objetivo principal u otra prioridad con el mismo número ese día).";
    case "23514":
      return "Algún valor está fuera del rango permitido.";
    case "23503":
      return "El elemento relacionado ya no existe.";
    case "42501":
      return "No tienes permiso para esta operación.";
    case "PGRST116":
      return "No se encontró el elemento.";
    default:
      return "No se pudo guardar. Inténtalo de nuevo.";
  }
}

export class ActionError extends Error {}

/**
 * Wraps a Server Action: verifies the owner session, runs the handler, converts
 * failures into ActionState and refreshes the router on success.
 */
export async function runAction(handler: (ctx: Ctx) => Promise<ActionState | void>): Promise<ActionState> {
  try {
    const { supabase, user } = await authedClient();
    const result = (await handler({ supabase, userId: user.id })) ?? { ok: true };
    if (result?.ok) refresh();
    return result;
  } catch (e) {
    if (e instanceof UnauthorizedError) return { ok: false, error: "Tu sesión ha caducado. Vuelve a entrar." };
    if (e instanceof ActionError) return { ok: false, error: e.message };
    console.error("[action]", e);
    return { ok: false, error: "Error inesperado. Tus datos no se han modificado." };
  }
}

/** Parses FormData with a schema; returns the data or an ActionState error. */
export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { data: z.infer<S>; error?: undefined } | { data?: undefined; error: Exclude<ActionState, null> } {
  const res = schema.safeParse(formToObject(formData));
  if (!res.success) return { error: validationError(res.error) };
  return { data: res.data };
}

export function check(res: { error: { code?: string; message: string } | null }) {
  if (res.error) {
    console.error("[db]", res.error);
    throw new ActionError(dbErrorMessage(res.error));
  }
}

export const idSchema = z.uuid("Identificador no válido");

export function getId(formData: FormData, key = "id"): string {
  const parsed = idSchema.safeParse(formData.get(key));
  if (!parsed.success) throw new ActionError("Identificador no válido");
  return parsed.data;
}
