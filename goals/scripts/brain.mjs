#!/usr/bin/env node
/**
 * GOALS "brain mode" for Claude Code: lets a Claude Code session act as the
 * AI brain of the deployed app when no ANTHROPIC_API_KEY is configured.
 * It reads the owner's data and writes AI outputs that the app already shows.
 * It never changes goals, projects, tasks or ideas directly: changes go in as
 * pending proposals that the owner approves in the app (same gate as the chat).
 *
 *   node scripts/brain.mjs context                 # owner's data as JSON
 *   node scripts/brain.mjs recommend  < rec.json    # dashboard recommendation (today)
 *   node scripts/brain.mjs plan 2026-11-18 < plan.json   # day plan proposal
 *   node scripts/brain.mjs evaluate <idea-id> < eval.json
 *   node scripts/brain.mjs review     < text.txt    # weekly review → memory (summary)
 *   node scripts/brain.mjs propose    < proposals.json   # [{action,target_id?,payload,summary,rationale}]
 *   node scripts/brain.mjs log        < turn.json   # {user, assistant}: keeps the chat in the app's AI Brain
 *
 * Needs the Supabase Management API (token injected by the "goals" cloud
 * environment, or SUPABASE_ACCESS_TOKEN) and runs with NODE_USE_ENV_PROXY=1 there.
 * Config: GOALS_PROJECT_REF (default: the project named "goals"). The owner is the
 * single account in the RLS allowlist (app_private.authorized_users).
 */
import { readFileSync } from "node:fs";
import { dailyRecommendationSchema, dayPlanSchema, ideaEvaluationSchema } from "../src/lib/ai/schemas.ts";

const CONVERSATION_TITLE = "Claude Code";
const ACTIONS = new Set([
  "create_goal", "update_goal", "create_project", "update_project",
  "create_task", "update_task", "create_idea", "record_decision", "save_memory",
]);

async function api(method, url, body) {
  const headers = { "content-type": "application/json" };
  if (process.env.SUPABASE_ACCESS_TOKEN) headers.authorization = `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`;
  const res = await fetch(`https://api.supabase.com${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function projectRef() {
  if (process.env.GOALS_PROJECT_REF) return process.env.GOALS_PROJECT_REF;
  const projects = await api("GET", "/v1/projects");
  const p = projects.find((x) => x.name?.toLowerCase() === "goals");
  if (!p) throw new Error("No encuentro el proyecto de Supabase «goals».");
  return p.id;
}

/** Dollar-quoted literal with a tag that cannot appear in the value. */
function lit(value) {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  let tag = "g";
  while (s.includes(`$${tag}$`)) tag += "x";
  return `$${tag}$${s}$${tag}$`;
}

const ref = await projectRef();
const sql = (query) => api("POST", `/v1/projects/${ref}/database/query`, { query });
const stdin = () => readFileSync(0, "utf8");
const stdinJson = () => {
  try {
    return JSON.parse(stdin());
  } catch {
    throw new Error("La entrada no es JSON válido.");
  }
};

const owners = await sql(`select u.id, coalesce(p.timezone, 'Europe/Madrid') as tz,
  to_char((now() at time zone coalesce(p.timezone, 'Europe/Madrid'))::date, 'YYYY-MM-DD') as today
  from app_private.authorized_users a join auth.users u on lower(u.email) = a.email
  left join public.profiles p on p.id = u.id`);
if (owners.length !== 1) throw new Error(`Esperaba exactamente un propietario autorizado y hay ${owners.length}.`);
const [owner] = owners;
const uid = lit(owner.id);

async function conversationId() {
  const [c] = await sql(`select id from public.ai_conversations where user_id = ${uid} and title = ${lit(CONVERSATION_TITLE)} order by created_at limit 1`);
  if (c) return c.id;
  const [n] = await sql(`insert into public.ai_conversations (user_id, title) values (${uid}, ${lit(CONVERSATION_TITLE)}) returning id`);
  return n.id;
}

const [cmd, arg] = process.argv.slice(2);
const out = (x) => console.log(typeof x === "string" ? x : JSON.stringify(x, null, 2));

switch (cmd) {
  case "context": {
    const q = (s) => sql(s.replaceAll(":uid", uid));
    const [goals, projects, tasks, done, ideas, decisions, memory, proposals, log, profile] = await Promise.all([
      q(`select g.id, g.title, g.status, g.priority, g.is_primary, g.category, g.target_date, g.metric_name, g.metric_current, g.metric_target, g.metric_unit, gp.progress
         from goals g join goal_progress gp on gp.goal_id = g.id where g.user_id = :uid and g.status in ('active','paused') order by g.is_primary desc`),
      q(`select p.id, p.title, p.status, p.priority, p.due_date, p.goal_id, pp.progress, pp.completed_tasks, pp.total_tasks, pp.spent_minutes
         from projects p join project_progress pp on pp.project_id = p.id where p.user_id = :uid and p.status not in ('completed','cancelled')`),
      q(`select id, title, status, priority, project_id, due_date, scheduled_date, focus_rank, estimated_minutes, spent_minutes
         from tasks where user_id = :uid and status in ('pending','in_progress') order by due_date nulls last limit 100`),
      q(`select title, completed_at from tasks where user_id = :uid and status = 'completed' and completed_at > now() - interval '7 days'`),
      q(`select id, title, status, category, potential, difficulty, estimated_cost, ai_evaluation is not null as evaluated from ideas where user_id = :uid and status <> 'discarded'`),
      q(`select title, decision, status, decided_at from decisions where user_id = :uid order by created_at desc limit 15`),
      q(`select kind, content, confirmed, pinned from ai_memory where user_id = :uid order by pinned desc, created_at desc limit 40`),
      q(`select action, summary, status from ai_proposals where user_id = :uid and status = 'pending'`),
      q(`select intention, available_minutes, energy, summary from daily_logs where user_id = :uid and log_date = ${lit(owner.today)}`),
      q(`select display_name, timezone, daily_capacity_minutes, ai_instructions from profiles where id = :uid`),
    ]);
    out({ today: owner.today, timezone: owner.tz, profile: profile[0] ?? null, goals, projects, open_tasks: tasks, completed_last_7_days: done, ideas, decisions, memory, pending_proposals: proposals, today_log: log[0] ?? null });
    break;
  }
  case "recommend": {
    const rec = dailyRecommendationSchema.parse(stdinJson());
    await sql(`insert into daily_logs (user_id, log_date, ai_recommendation, ai_recommendation_at)
      values (${uid}, ${lit(owner.today)}, ${lit(rec)}::jsonb, now())
      on conflict (user_id, log_date) do update set ai_recommendation = excluded.ai_recommendation, ai_recommendation_at = now()`);
    out(`Recomendación guardada para ${owner.today}.`);
    break;
  }
  case "plan": {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(arg ?? "")) throw new Error("Uso: plan YYYY-MM-DD < plan.json");
    const input = stdinJson();
    const plan = dayPlanSchema.parse(input);
    const stored = { ...plan, start: input.start ?? "09:00", available_minutes: input.available_minutes ?? null };
    await sql(`insert into daily_logs (user_id, log_date, ai_plan, ai_plan_at) values (${uid}, ${lit(arg)}, ${lit(stored)}::jsonb, now())
      on conflict (user_id, log_date) do update set ai_plan = excluded.ai_plan, ai_plan_at = now()`);
    out(`Plan propuesto para ${arg}. El usuario lo aplica o descarta en el planificador.`);
    break;
  }
  case "evaluate": {
    const ev = ideaEvaluationSchema.parse(stdinJson());
    const rows = await sql(`update ideas set ai_evaluation = ${lit(ev)}::jsonb, ai_evaluated_at = now() where id = ${lit(arg)} and user_id = ${uid} returning id`);
    if (!rows.length) throw new Error("Idea no encontrada.");
    out("Evaluación guardada.");
    break;
  }
  case "review": {
    const text = stdin().trim().slice(0, 4000);
    if (!text) throw new Error("Texto vacío.");
    await sql(`insert into ai_memory (user_id, kind, content, confirmed, source, period_end) values (${uid}, 'summary', ${lit(text)}, false, 'ai', ${lit(owner.today)})`);
    out("Revisión guardada en la memoria (como resumen de Claude, no como hecho).");
    break;
  }
  case "propose": {
    const items = stdinJson();
    if (!Array.isArray(items) || !items.length || items.length > 20) throw new Error("Esperaba una lista de 1 a 20 propuestas.");
    for (const p of items) {
      if (!ACTIONS.has(p.action)) throw new Error(`Acción no válida: ${p.action}`);
      if (!p.summary || !p.payload || typeof p.payload !== "object") throw new Error("Cada propuesta necesita summary y payload.");
      if (p.action.startsWith("update_") && !p.target_id) throw new Error("Las actualizaciones necesitan target_id.");
    }
    const conv = await conversationId();
    // Attach to the latest logged user message, so the app shows them under that reply.
    const [last] = await sql(`select id from ai_messages where conversation_id = ${lit(conv)} and role = 'user' order by created_at desc limit 1`);
    const msg = last ? `${lit(last.id)}::uuid` : "null";
    const values = items
      .map((p) => `(${uid}, ${lit(conv)}, ${msg}, ${lit(p.action)}, ${p.target_id ? `${lit(p.target_id)}::uuid` : "null"}, ${lit(p.payload)}::jsonb, ${lit(String(p.summary).slice(0, 300))}, ${p.rationale ? lit(String(p.rationale).slice(0, 4000)) : "null"})`)
      .join(",\n");
    const rows = await sql(`insert into ai_proposals (user_id, conversation_id, message_id, action, target_id, payload, summary, rationale) values ${values} returning id`);
    out(`${rows.length} propuesta(s) pendientes de aprobación en la app (AI Brain → Memoria, o el panel de inicio).`);
    break;
  }
  case "log": {
    const t = stdinJson();
    if (!t.user || !t.assistant) throw new Error("Esperaba {user, assistant}.");
    const conv = await conversationId();
    await sql(`insert into ai_messages (user_id, conversation_id, role, content) values
      (${uid}, ${lit(conv)}, 'user', ${lit(String(t.user).slice(0, 200000))})`);
    await sql(`insert into ai_messages (user_id, conversation_id, role, content) values
      (${uid}, ${lit(conv)}, 'assistant', ${lit(String(t.assistant).slice(0, 200000))})`);
    out("Conversación guardada en el AI Brain de la app.");
    break;
  }
  default:
    out("Comandos: context | recommend | plan <fecha> | evaluate <idea-id> | review | propose | log");
    process.exitCode = 1;
}
