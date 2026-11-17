"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/validation";
import { ActionError, check, getId, runAction } from "./helpers";
import { NOTIFY_KINDS } from "@/lib/constants";

export async function markNotificationRead(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    check(await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", getId(formData)).is("read_at", null));
    return { ok: true };
  });
}

export async function markAllNotificationsRead(_: ActionState): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    check(await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).lte("scheduled_for", new Date().toISOString()));
    return { ok: true, message: "Todo leído" };
  });
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida");

const prefsSchema = z.object({
  quiet_start: hhmm,
  quiet_end: hhmm,
  busy_label: z.string().trim().max(40).optional(),
  busy_start: z.union([hhmm, z.literal("")]),
  busy_end: z.union([hhmm, z.literal("")]),
  busy_days: z.array(z.coerce.number().int().min(0).max(6)).max(7),
});

/** Which smart notifications to get, quiet hours and the busy block (school/work). */
export async function saveNotificationPrefs(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase, userId }) => {
    const parsed = prefsSchema.safeParse({
      quiet_start: formData.get("quiet_start"),
      quiet_end: formData.get("quiet_end"),
      busy_label: formData.get("busy_label") ?? undefined,
      busy_start: formData.get("busy_start") ?? "",
      busy_end: formData.get("busy_end") ?? "",
      busy_days: formData.getAll("busy_days"),
    });
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Datos no válidos");
    const d = parsed.data;
    if (d.busy_start && d.busy_end && d.busy_start >= d.busy_end) throw new ActionError("El horario ocupado debe terminar después de empezar.");
    const notify_prefs = Object.fromEntries(NOTIFY_KINDS.map((k) => [k, formData.get(`notify_${k}`) === "on"]));
    const busy_blocks =
      d.busy_start && d.busy_end && d.busy_days.length
        ? [{ days: [...new Set(d.busy_days)].sort(), start: d.busy_start, end: d.busy_end, label: d.busy_label || "Ocupado" }]
        : [];
    check(await supabase.from("profiles").update({ notify_prefs, quiet_start: d.quiet_start, quiet_end: d.quiet_end, busy_blocks }).eq("id", userId));
    return { ok: true, message: "Preferencias de avisos guardadas" };
  });
}
