#!/usr/bin/env node
/**
 * Configures Web Push reminders for the deployed GOALS (idempotent).
 *
 *   NODE_USE_ENV_PROXY=1 node scripts/setup-push.mjs
 *
 * - Generates a VAPID key pair and a dispatch secret only if Vercel does not
 *   have them yet (rotating them would silently break existing subscriptions).
 * - Stores them as Vercel environment variables of the project "goals".
 * - Stores the dispatch URL and secret in the database (app_private.settings),
 *   where the pg_cron dispatcher reads them.
 * Secrets are never printed. Run scripts/deploy-cloud.mjs afterwards so the
 * new variables reach a build.
 */
import { randomBytes } from "node:crypto";
import webpush from "web-push";

const NAME = process.env.PROJECT_NAME ?? "goals";

async function call(base, token, method, url, body) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const vc = (m, u, b) => call("https://api.vercel.com", process.env.VERCEL_TOKEN, m, u, b);
const sb = (m, u, b) => call("https://api.supabase.com", process.env.SUPABASE_ACCESS_TOKEN, m, u, b);
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

const project = await vc("GET", `/v9/projects/${NAME}`);
const envs = (await vc("GET", `/v9/projects/${project.id}/env?decrypt=true`)).envs ?? [];
const get = (k) => envs.find((e) => e.key === k && e.target?.includes("production"))?.value;

let publicKey = get("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
let privateKey = get("VAPID_PRIVATE_KEY");
let secret = get("PUSH_DISPATCH_SECRET");
const created = [];
if (!publicKey || !privateKey) {
  ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
  created.push("claves VAPID");
}
if (!secret) {
  secret = randomBytes(32).toString("base64url");
  created.push("secreto de envío");
}

const domains = (await vc("GET", `/v9/projects/${project.id}/domains`)).domains ?? [];
const host = domains.map((d) => d.name).sort((a, b) => a.length - b.length)[0];
if (!host) throw new Error("El proyecto de Vercel no tiene dominio de producción todavía.");
const site = `https://${host}`;

await vc(
  "POST",
  `/v10/projects/${project.id}/env?upsert=true`,
  [
    ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", publicKey, "plain"],
    ["VAPID_PRIVATE_KEY", privateKey, "encrypted"],
    ["VAPID_SUBJECT", site, "plain"],
    ["PUSH_DISPATCH_SECRET", secret, "encrypted"],
  ].map(([key, value, type]) => ({ key, value, type, target: ["production", "preview", "development"] })),
);
console.log(`• Vercel: variables de notificaciones configuradas${created.length ? ` (nuevas: ${created.join(", ")})` : " (sin cambios de claves)"}.`);

const projects = await sb("GET", "/v1/projects");
const ref = (projects.find((p) => p.name?.toLowerCase() === NAME.toLowerCase()) ?? {}).id;
if (!ref) throw new Error("No encuentro el proyecto de Supabase.");
await sb("POST", `/v1/projects/${ref}/database/query`, {
  query: `insert into app_private.settings (key, value) values
            ('dispatch_url', ${lit(`${site}/api/notifications/dispatch`)}), ('dispatch_secret', ${lit(secret)})
          on conflict (key) do update set value = excluded.value;`,
});
console.log(`• Supabase: el envío programado apunta a ${site}/api/notifications/dispatch.`);
