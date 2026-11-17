import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { pushConfigured, sendPush } from "@/lib/push";

/**
 * Called every minute by the database (pg_cron + pg_net) with the reminders
 * that are due. Authenticated by a shared secret, not by a user session; it
 * only sends what it receives and has no database access of its own.
 */
const body = z.object({
  notifications: z
    .array(
      z.object({
        endpoint: z.url().startsWith("https://"),
        p256dh: z.string().min(1).max(200),
        auth: z.string().min(1).max(100),
        title: z.string().min(1).max(200),
        body: z.string().max(400).nullable().optional(),
        url: z.string().max(200).nullable().optional(),
      }),
    )
    .max(200),
});

function secretMatches(given: string | null, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = serverEnv().PUSH_DISPATCH_SECRET;
  if (!secret || !pushConfigured()) return Response.json({ error: "push_not_configured" }, { status: 503 });
  if (!secretMatches(request.headers.get("x-dispatch-secret"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const results = await Promise.all(parsed.data.notifications.map((n) => sendPush(n, n)));
  return Response.json({
    sent: results.filter((r) => r === "sent").length,
    gone: parsed.data.notifications.filter((_, i) => results[i] === "gone").map((n) => n.endpoint),
    failed: results.filter((r) => r === "failed").length,
  });
}
