#!/usr/bin/env node
/**
 * Configures Web Push reminders for the deployed GOALS (idempotent).
 *
 *   NODE_USE_ENV_PROXY=1 node scripts/setup-push.mjs
 *
 * - Generates a VAPID key pair only if Vercel does not have one yet (rotating
 *   it breaks existing device subscriptions; ROTATE_PUSH_KEYS=1 forces it).
 * - Keeps the dispatch secret in the database and copies it to Vercel.
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
// Vercel never returns decrypted values of encrypted variables, so secrets are
// never read back from it: only their presence is checked.
const envs = (await vc("GET", `/v9/projects/${project.id}/env`)).envs ?? [];
const has = (k) => envs.some((e) => e.key === k && e.target?.includes("production"));

const projects = await sb("GET", "/v1/projects");
const ref = (projects.find((p) => p.name?.toLowerCase() === NAME.toLowerCase()) ?? {}).id;
if (!ref) throw new Error("No encuentro el proyecto de Supabase.");
const sql = (query) => sb("POST", `/v1/projects/${ref}/database/query`, { query });

const domains = (await vc("GET", `/v9/projects/${project.id}/domains`)).domains ?? [];
const host = domains.map((d) => d.name).sort((a, b) => a.length - b.length)[0];
if (!host) throw new Error("El proyecto de Vercel no tiene dominio de producción todavía.");
const site = `https://${host}`;

const rotate = process.env.ROTATE_PUSH_KEYS === "1";
const vars = [["VAPID_SUBJECT", site, "plain"]];
const created = [];
if (rotate || !has("NEXT_PUBLIC_VAPID_PUBLIC_KEY") || !has("VAPID_PRIVATE_KEY")) {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  vars.push(["NEXT_PUBLIC_VAPID_PUBLIC_KEY", publicKey, "plain"], ["VAPID_PRIVATE_KEY", privateKey, "encrypted"]);
  created.push("claves VAPID");
}

// The dispatch secret's source of truth is the database (readable here).
const [row] = await sql(`select value from app_private.settings where key = 'dispatch_secret'`);
let secret = row?.value;
if (rotate || !secret || secret.length > 200) {
  secret = randomBytes(32).toString("base64url");
  created.push("secreto de envío");
}
vars.push(["PUSH_DISPATCH_SECRET", secret, "encrypted"]);

await vc(
  "POST",
  `/v10/projects/${project.id}/env?upsert=true`,
  vars.map(([key, value, type]) => ({ key, value, type, target: ["production", "preview", "development"] })),
);
console.log(`• Vercel: variables de notificaciones configuradas${created.length ? ` (nuevas: ${created.join(", ")})` : ""}.`);

await sql(`insert into app_private.settings (key, value) values
            ('dispatch_url', ${lit(`${site}/api/notifications/dispatch`)}), ('dispatch_secret', ${lit(secret)})
          on conflict (key) do update set value = excluded.value;`);
console.log(`• Supabase: el envío programado apunta a ${site}/api/notifications/dispatch.`);
