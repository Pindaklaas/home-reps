"use server";

import { z } from "zod";
import { pushConfigured, sendPush } from "@/lib/push";
import type { ActionState } from "@/lib/validation";
import { ActionError, check, runAction } from "./helpers";

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Saves this device's push subscription for the owner. */
export async function savePushSubscription(subscription: unknown, userAgent: string): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const parsed = subscriptionSchema.safeParse(subscription);
    if (!parsed.success) throw new ActionError("Suscripción no válida");
    const { endpoint, keys } = parsed.data;
    check(
      await supabase
        .from("push_subscriptions")
        .upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: userAgent.slice(0, 400) }, { onConflict: "endpoint" }),
    );
    return { ok: true, message: "Notificaciones activadas en este dispositivo" };
  });
}

export async function removePushSubscription(endpoint: string): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    check(await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint));
    return { ok: true, message: "Notificaciones desactivadas en este dispositivo" };
  });
}

/** Sends a test notification to every device of the owner. */
export async function sendTestPush(_: ActionState): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    if (!pushConfigured()) throw new ActionError("Las notificaciones no están configuradas en el servidor.");
    const res = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
    check(res);
    const subs = res.data ?? [];
    if (!subs.length) throw new ActionError("Activa primero las notificaciones en este dispositivo.");
    let sent = 0;
    for (const s of subs) {
      const r = await sendPush(s, { title: "GOALS: notificación de prueba", body: "Así te avisaré de tus tareas con hora.", url: "/planner" });
      if (r === "sent") sent++;
      if (r === "gone") await supabase.from("push_subscriptions").delete().eq("id", s.id);
    }
    if (!sent) throw new ActionError("No se pudo entregar la notificación. Vuelve a activarlas en este dispositivo.");
    return { ok: true, message: `Enviada a ${sent} dispositivo${sent > 1 ? "s" : ""}` };
  });
}
