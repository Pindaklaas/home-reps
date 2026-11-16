import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/lib/data";
import { addDays, dayBoundsUtc, weekRange } from "@/lib/dates";
import { ideaEvaluationSchema } from "./schemas";

/**
 * Builds the snapshot of GOALS data that Claude sees. Everything comes from the
 * database through the user's RLS-bound client, so Claude only ever sees what
 * the owner can see. Sections are labelled by how certain they are.
 */
export async function buildContext(
  supabase: ServerSupabase,
  { profile, today, tz }: { profile: Profile | null; today: string; tz: string },
): Promise<string> {
  const week = weekRange(today, profile?.week_starts_on ?? 1);
  const weekStartUtc = dayBoundsUtc(week.start, tz).start;

  const [goals, goalProgress, projects, projectProgress, openTasks, doneWeek, ideas, decisions, memory, log, timeWeek, proposals] =
    await Promise.all([
      supabase.from("goals").select("id, title, description, category, status, priority, is_primary, target_date, metric_name, metric_unit, metric_start, metric_target, metric_current").in("status", ["active", "paused"]).order("is_primary", { ascending: false }).limit(30),
      supabase.from("goal_progress").select("goal_id, progress"),
      supabase.from("projects").select("id, title, status, priority, goal_id, due_date, description").not("status", "in", "(completed,cancelled)").order("updated_at", { ascending: false }).limit(40),
      supabase.from("project_progress").select("project_id, progress, total_tasks, completed_tasks, spent_minutes"),
      supabase.from("tasks").select("id, title, status, priority, project_id, due_date, scheduled_date, focus_rank, estimated_minutes, spent_minutes").in("status", ["pending", "in_progress"]).order("due_date", { ascending: true, nullsFirst: false }).limit(80),
      supabase.from("tasks").select("id, title, project_id, completed_at").eq("status", "completed").gte("completed_at", weekStartUtc).limit(60),
      supabase.from("ideas").select("id, title, status, category, potential, difficulty, estimated_cost, ai_evaluation").in("status", ["new", "exploring", "validated", "parked"]).order("created_at", { ascending: false }).limit(30),
      supabase.from("decisions").select("id, title, decision, status, decided_at, created_at").order("created_at", { ascending: false }).limit(15),
      supabase.from("ai_memory").select("id, kind, content, confirmed, source, pinned, created_at").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(40),
      supabase.from("daily_logs").select("intention, available_minutes, energy, summary").eq("log_date", today).maybeSingle(),
      supabase.from("time_entries").select("minutes").gte("logged_on", week.start),
      supabase.from("ai_proposals").select("summary, action").eq("status", "pending").limit(20),
    ]);

  const gp = new Map((goalProgress.data ?? []).map((r) => [r.goal_id, r.progress]));
  const pp = new Map((projectProgress.data ?? []).map((r) => [r.project_id, r]));
  const projectTitle = new Map((projects.data ?? []).map((p) => [p.id, p.title]));
  const goalTitle = new Map((goals.data ?? []).map((g) => [g.id, g.title]));
  const clip = (s: string | null | undefined, n = 160) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s).replace(/\s+/g, " ") : "");

  const L: string[] = [];
  L.push(`Fecha de hoy: ${today} (zona horaria ${tz}). Semana actual: ${week.start} a ${week.end}.`);
  if (profile?.display_name) L.push(`Nombre del usuario: ${profile.display_name}.`);
  L.push(`Capacidad diaria declarada: ${profile?.daily_capacity_minutes ?? 360} min.`);
  if (log.data) {
    L.push(
      `Registro de hoy: intención «${clip(log.data.intention) || "—"}», tiempo disponible ${log.data.available_minutes ?? "no indicado"} min, energía ${log.data.energy ?? "no indicada"}/5.`,
    );
  }
  const minutesWeek = (timeWeek.data ?? []).reduce((s, r) => s + r.minutes, 0);
  L.push(`Esta semana: ${doneWeek.data?.length ?? 0} tareas completadas, ${minutesWeek} min registrados.`);

  L.push("\n## 1. INFORMACIÓN CONFIRMADA (registros reales de GOALS)");
  L.push("### Objetivos activos y en pausa");
  if (!goals.data?.length) L.push("(ninguno)");
  for (const g of goals.data ?? []) {
    const metric =
      g.metric_name && g.metric_target !== null
        ? ` · métrica ${g.metric_name}: ${g.metric_current}/${g.metric_target}${g.metric_unit ?? ""} (inicio ${g.metric_start})`
        : "";
    L.push(
      `- [goal:${g.id}] ${g.is_primary ? "★PRINCIPAL " : ""}«${g.title}» · ${g.status} · prioridad ${g.priority} · ${g.category} · progreso ${gp.get(g.id) ?? 0}%${g.target_date ? ` · fecha objetivo ${g.target_date}` : ""}${metric}${g.description ? ` · ${clip(g.description, 200)}` : ""}`,
    );
  }

  L.push("### Proyectos abiertos (los de estado «idea» aún no son compromisos)");
  if (!projects.data?.length) L.push("(ninguno)");
  for (const p of projects.data ?? []) {
    const pr = pp.get(p.id);
    L.push(
      `- [project:${p.id}] «${p.title}» · ${p.status} · prioridad ${p.priority} · objetivo: ${p.goal_id ? `«${goalTitle.get(p.goal_id) ?? p.goal_id}»` : "NINGUNO"} · ${pr?.completed_tasks ?? 0}/${pr?.total_tasks ?? 0} tareas · ${pr?.progress ?? 0}% · ${pr?.spent_minutes ?? 0} min invertidos${p.due_date ? ` · límite ${p.due_date}` : ""}`,
    );
  }

  L.push("### Tareas abiertas");
  if (!openTasks.data?.length) L.push("(ninguna)");
  for (const t of openTasks.data ?? []) {
    const flags = [
      t.due_date && t.due_date < today ? "ATRASADA" : "",
      t.scheduled_date ? `planificada ${t.scheduled_date}` : "",
      t.focus_rank ? `prioridad del día #${t.focus_rank}` : "",
    ].filter(Boolean);
    L.push(
      `- [task:${t.id}] «${t.title}» · ${t.status} · ${t.priority}${t.project_id ? ` · proyecto «${projectTitle.get(t.project_id) ?? "otro"}»` : " · sin proyecto"}${t.due_date ? ` · vence ${t.due_date}` : ""}${t.estimated_minutes ? ` · estimada ${t.estimated_minutes} min` : ""}${t.spent_minutes ? ` · invertidos ${t.spent_minutes} min` : ""}${flags.length ? ` · ${flags.join(", ")}` : ""}`,
    );
  }

  L.push("### Completadas esta semana (confirmado: estado «completada» en la base de datos)");
  L.push(doneWeek.data?.length ? (doneWeek.data ?? []).map((t) => `«${t.title}»`).join(", ") : "(ninguna)");

  const confirmedMemory = (memory.data ?? []).filter((m) => m.confirmed && (m.kind === "fact" || m.kind === "preference"));
  L.push("### Datos y preferencias confirmados por el usuario");
  L.push(confirmedMemory.length ? confirmedMemory.map((m) => `- [memory:${m.id}] (${m.kind}) ${clip(m.content, 300)}`).join("\n") : "(ninguno)");

  L.push("\n## 2. IDEAS (no son compromisos ni hechos)");
  if (!ideas.data?.length) L.push("(ninguna)");
  for (const i of ideas.data ?? []) {
    const ev = ideaEvaluationSchema.safeParse(i.ai_evaluation);
    L.push(
      `- [idea:${i.id}] «${i.title}» · ${i.status} · ${i.category} · potencial ${i.potential ?? "?"}/5 · dificultad ${i.difficulty ?? "?"}/5${i.estimated_cost !== null ? ` · coste ${i.estimated_cost}€` : ""}${ev.success ? ` · tu evaluación previa: ${ev.data.verdict} (${ev.data.score})` : ""}`,
    );
  }
  const ideaMemory = (memory.data ?? []).filter((m) => m.kind === "idea");
  if (ideaMemory.length) L.push(ideaMemory.map((m) => `- [memory:${m.id}] ${clip(m.content, 300)}`).join("\n"));

  L.push("\n## 3. RECOMENDACIONES PREVIAS (consejos tuyos, no hechos)");
  const recs = (memory.data ?? []).filter((m) => m.kind === "recommendation" || m.kind === "summary");
  L.push(recs.length ? recs.slice(0, 12).map((m) => `- [memory:${m.id}] (${m.kind}, ${m.created_at.slice(0, 10)}) ${clip(m.content, 300)}`).join("\n") : "(ninguna)");

  L.push("\n## 4. DECISIONES");
  const approved = (decisions.data ?? []).filter((d) => d.status === "approved");
  const otherDecisions = (decisions.data ?? []).filter((d) => d.status !== "approved");
  L.push("### Aprobadas por el usuario");
  L.push(approved.length ? approved.map((d) => `- «${d.title}»: ${clip(d.decision, 240) || "(sin detalle)"} (${(d.decided_at ?? d.created_at).slice(0, 10)})`).join("\n") : "(ninguna)");
  const memDecisions = (memory.data ?? []).filter((m) => m.kind === "decision" && m.confirmed);
  if (memDecisions.length) L.push(memDecisions.map((m) => `- [memory:${m.id}] ${clip(m.content, 300)}`).join("\n"));
  if (otherDecisions.length) {
    L.push("### Propuestas o rechazadas (no vigentes)");
    L.push(otherDecisions.map((d) => `- «${d.title}» · ${d.status}`).join("\n"));
  }

  if (proposals.data?.length) {
    L.push("\n## Propuestas tuyas pendientes de aprobación (no aplicadas; no las dupliques)");
    L.push(proposals.data.map((p) => `- (${p.action}) ${p.summary}`).join("\n"));
  }

  if (profile?.ai_instructions) {
    L.push("\n## Instrucciones personales del usuario para ti");
    L.push(clip(profile.ai_instructions, 4000));
  }

  L.push(`\n(Mañana es ${addDays(today, 1)}.)`);
  return L.join("\n");
}
