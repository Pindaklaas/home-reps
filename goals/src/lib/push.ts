import "server-only";
import webpush from "web-push";
import { publicEnv, serverEnv } from "@/lib/env";

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body?: string | null; url?: string | null };

/** True when the VAPID key pair is configured (push can be sent). */
export function pushConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY && serverEnv().VAPID_PRIVATE_KEY && serverEnv().VAPID_SUBJECT);
}

let ready = false;
function configure() {
  if (ready) return;
  const env = serverEnv();
  webpush.setVapidDetails(env.VAPID_SUBJECT!, publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  ready = true;
}

/**
 * Sends one notification. Returns "gone" when the browser dropped the
 * subscription (404/410), so the caller can forget it.
 */
export async function sendPush(target: PushTarget, msg: PushMessage): Promise<"sent" | "gone" | "failed"> {
  configure();
  const url = msg.url && msg.url.startsWith("/") ? msg.url : "/";
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify({ title: msg.title.slice(0, 120), body: (msg.body ?? "").slice(0, 300), url }),
      { TTL: 1800, urgency: "high" },
    );
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[push]", status ?? e);
    return "failed";
  }
}
