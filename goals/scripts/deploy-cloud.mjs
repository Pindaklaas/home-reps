#!/usr/bin/env node
/**
 * Creates or updates the whole GOALS cloud setup through the Supabase
 * Management API and the Vercel API. Idempotent: safe to run again.
 *
 *   OWNER_EMAIL=you@example.com node scripts/deploy-cloud.mjs   # first time
 *   node scripts/deploy-cloud.mjs                              # later: owner read from the DB
 *
 * Authentication: SUPABASE_ACCESS_TOKEN (sbp_…) and VERCEL_TOKEN, sent as
 * Bearer tokens. In a Claude cloud environment the network proxy injects them
 * instead, so the variables can be left unset there.
 *
 * Steps: Supabase project "goals" (eu-central-1) → schema (supabase/migrations)
 * → owner account + RLS allowlist (scripts/sql/create-owner.sql) → Vercel
 * project "goals" with its environment variables → production deploy →
 * Supabase Auth settings (sign-ups closed, site URL, redirect URLs).
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NAME = process.env.PROJECT_NAME ?? "goals";
const REGION = process.env.SUPABASE_REGION ?? "eu-central-1";
let OWNER_EMAIL = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
const VERCEL_CLI = "vercel@65.14.0";

if (OWNER_EMAIL && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(OWNER_EMAIL)) {
  console.error("OWNER_EMAIL no es un email válido.");
  process.exit(1);
}

const log = (msg) => console.log(`• ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function headers(token) {
  const h = { "content-type": "application/json" };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

async function call(base, token, method, url, body) {
  const res = await fetch(base + url, { method, headers: headers(token), body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`${method} ${url} → ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const sb = (method, url, body) => call("https://api.supabase.com", process.env.SUPABASE_ACCESS_TOKEN, method, url, body);
const vc = (method, url, body) => call("https://api.vercel.com", process.env.VERCEL_TOKEN, method, url, body);
const sql = (ref, query) => sb("POST", `/v1/projects/${ref}/database/query`, { query });
const literal = (s) => `'${String(s).replace(/'/g, "''")}'`;

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------
async function supabaseProject() {
  const orgs = await sb("GET", "/v1/organizations");
  if (!orgs.length) throw new Error("Tu cuenta de Supabase no tiene ninguna organización. Crea una en supabase.com.");
  const org = process.env.SUPABASE_ORG ? orgs.find((o) => o.id === process.env.SUPABASE_ORG || o.slug === process.env.SUPABASE_ORG) : orgs[0];
  if (!org) throw new Error(`No encuentro la organización ${process.env.SUPABASE_ORG}`);

  const projects = await sb("GET", "/v1/projects");
  // Reuse a project with the same name (any case, any region), e.g. one created in the dashboard.
  let project = projects.find((p) => p.name?.toLowerCase() === NAME.toLowerCase());
  if (project) {
    log(`Supabase: uso el proyecto existente «${project.name}» (${project.id}, ${project.region}).`);
  } else {
    log(`Supabase: creando el proyecto «${NAME}» en ${REGION} (organización «${org.name}»)…`);
    // The database password is random and not shown: GOALS never uses it
    // (schema changes go through the Management API). It can be reset in the dashboard.
    const body = { name: NAME, region: REGION, db_pass: randomBytes(24).toString("base64url") };
    try {
      project = await sb("POST", "/v1/projects", { ...body, organization_slug: org.slug ?? org.id });
    } catch (e) {
      if (e.status !== 400 && e.status !== 422) throw e;
      project = await sb("POST", "/v1/projects", { ...body, organization_id: org.id });
    }
  }
  const ref = project.id ?? project.ref;

  for (let i = 0; i < 90; i++) {
    const p = await sb("GET", `/v1/projects/${ref}`);
    if (p.status === "ACTIVE_HEALTHY") break;
    if (i === 0) log(`Supabase: esperando a que el proyecto esté listo (estado ${p.status})…`);
    if (i === 89) throw new Error(`El proyecto sigue en estado ${p.status} tras 15 minutos.`);
    await sleep(10_000);
  }
  // The database can answer a little after the project reports healthy.
  for (let i = 0; ; i++) {
    try {
      await sql(ref, "select 1");
      break;
    } catch (e) {
      if (i >= 30) throw e;
      await sleep(10_000);
    }
  }
  return { ref, org };
}

async function applySchema(ref) {
  await sql(
    ref,
    `create schema if not exists supabase_migrations;
     create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`,
  );
  const applied = new Set((await sql(ref, "select version from supabase_migrations.schema_migrations")).map((r) => r.version));
  const dir = path.join(ROOT, "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    if (applied.has(version)) continue;
    log(`Supabase: aplicando ${file}…`);
    const body = readFileSync(path.join(dir, file), "utf8");
    // Same bookkeeping as `supabase db push`, so later migrations can be pushed with the CLI.
    await sql(ref, `begin;\n${body}\ninsert into supabase_migrations.schema_migrations (version, name) values (${literal(version)}, ${literal(rest.join("_"))});\ncommit;`);
  }
  log("Supabase: esquema al día.");
}

async function createOwner(ref) {
  const template = readFileSync(path.join(ROOT, "scripts", "sql", "create-owner.sql"), "utf8");
  await sql(ref, template.replaceAll(":owner_email", literal(OWNER_EMAIL)));
  const check = await sql(ref, `select (select count(*) from auth.users where email = ${literal(OWNER_EMAIL)})::int as users, (select count(*) from app_private.authorized_users where email = ${literal(OWNER_EMAIL)})::int as allowed`);
  if (check[0]?.users !== 1 || check[0]?.allowed !== 1) throw new Error(`No se pudo crear o autorizar al propietario: ${JSON.stringify(check)}`);
  log(`Supabase: propietario ${OWNER_EMAIL} creado y autorizado.`);
}

async function publicKey(ref) {
  const keys = await sb("GET", `/v1/projects/${ref}/api-keys`);
  const publishable = keys.find((k) => k.type === "publishable" && k.api_key && !k.api_key.includes("·"));
  const anon = keys.find((k) => k.name === "anon" && k.api_key);
  const key = publishable?.api_key ?? anon?.api_key;
  if (!key) throw new Error("No encuentro la clave pública del proyecto.");
  return key;
}

async function configureAuth(ref, siteUrl) {
  await sb("PATCH", `/v1/projects/${ref}/config/auth`, {
    site_url: siteUrl,
    uri_allow_list: `${siteUrl}/auth/callback,${siteUrl}/**`,
    disable_signup: true,
    password_min_length: 12,
  });
  log("Supabase: registro cerrado, contraseña mínima 12, URL del sitio y redirecciones configuradas.");
}

// ---------------------------------------------------------------------------
// Vercel
// ---------------------------------------------------------------------------
async function vercelProject(env) {
  let project;
  try {
    project = await vc("GET", `/v9/projects/${NAME}`);
    log(`Vercel: uso el proyecto existente «${NAME}».`);
  } catch (e) {
    if (e.status !== 404) throw e;
    log(`Vercel: creando el proyecto «${NAME}»…`);
    project = await vc("POST", "/v11/projects", { name: NAME, framework: "nextjs" });
  }
  await vc(
    "POST",
    `/v10/projects/${project.id}/env?upsert=true`,
    Object.entries(env).map(([key, value]) => ({
      key,
      value,
      type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted",
      target: ["production", "preview", "development"],
    })),
  );
  log(`Vercel: variables configuradas (${Object.keys(env).join(", ")}).`);
  return project;
}

function deploy(project) {
  log("Vercel: subiendo y compilando (unos minutos)…");
  const out = execFileSync(
    "npx",
    ["--yes", VERCEL_CLI, "deploy", "--prod", "--yes", "--token", process.env.VERCEL_TOKEN || "proxyinjectedplaceholder0000"],
    {
      cwd: ROOT,
      env: { ...process.env, VERCEL_ORG_ID: project.accountId, VERCEL_PROJECT_ID: project.id, VERCEL_TELEMETRY_DISABLED: "1" },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 50 * 1024 * 1024,
    },
  );
  const url = out.trim().split(/\s+/).filter((s) => s.startsWith("https://")).pop();
  if (!url) throw new Error("El despliegue terminó sin devolver una URL.");
  return url;
}

async function productionUrl(project, fallback) {
  const domains = await vc("GET", `/v9/projects/${project.id}/domains`).catch(() => ({ domains: [] }));
  const list = (domains.domains ?? []).map((d) => d.name).filter(Boolean);
  const pick = list.find((d) => !d.endsWith(".vercel.app")) ?? list.sort((a, b) => a.length - b.length)[0];
  return pick ? `https://${pick}` : fallback;
}

// ---------------------------------------------------------------------------
const { ref } = await supabaseProject();
await applySchema(ref);
if (!OWNER_EMAIL) {
  // Redeploys don't need the email: use the single owner already authorized.
  const rows = await sql(ref, "select email from app_private.authorized_users");
  if (rows.length !== 1) throw new Error("Pasa OWNER_EMAIL: no hay exactamente un propietario autorizado.");
  OWNER_EMAIL = rows[0].email;
}
await createOwner(ref);
const supabaseUrl = `https://${ref}.supabase.co`;
const key = await publicKey(ref);

const project = await vercelProject({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  OWNER_EMAIL,
});
const deploymentUrl = deploy(project);
const siteUrl = await productionUrl(project, deploymentUrl);
await configureAuth(ref, siteUrl);

console.log(`\nGOALS desplegado en ${siteUrl}`);
console.log(`Supabase: ${supabaseUrl}`);
console.log("Primer acceso: «Entrar con un enlace por email» con el email del propietario; luego pon tu contraseña en Ajustes.");
