import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { addDays, dayBoundsUtc, todayIn, weekRange } from "@/lib/dates";

export type Profile = Tables<"profiles">;
export type Goal = Tables<"goals">;
export type Project = Tables<"projects">;
export type Task = Tables<"tasks">;
export type Idea = Tables<"ideas">;
export type Decision = Tables<"decisions">;
export type DailyLog = Tables<"daily_logs">;
export type Memory = Tables<"ai_memory">;
export type Proposal = Tables<"ai_proposals">;
export type Activity = Tables<"activity_log">;

export type GoalWithProgress = Goal & { progress: number; projectCount: number };
export type ProjectWithProgress = Project & {
  progress: number;
  total_tasks: number;
  completed_tasks: number;
  spent_minutes: number;
  goal_title: string | null;
};
export type TaskWithProject = Task & { project_title: string | null };

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`No se pudo cargar ${what}: ${res.error.message}`);
  return (res.data ?? ([] as unknown)) as T;
}

/** Everything a signed-in page needs first: verified user, client, profile and "today". */
export const getAppContext = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw new Error(`No se pudo cargar el perfil: ${error.message}`);
  const tz = profile?.timezone ?? "Europe/Madrid";
  const today = todayIn(tz);
  return { user, supabase, profile, tz, today };
});

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------
export async function listGoals(supabase: ServerSupabase): Promise<GoalWithProgress[]> {
  const [goals, progress, projects] = await Promise.all([
    supabase.from("goals").select("*").order("is_primary", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("goal_progress").select("goal_id, progress"),
    supabase.from("projects").select("goal_id").not("goal_id", "is", null),
  ]);
  const g = must(goals, "los objetivos");
  const p = new Map(must(progress, "el progreso").map((r) => [r.goal_id, r.progress ?? 0]));
  const counts = new Map<string, number>();
  for (const r of must(projects, "los proyectos")) {
    if (r.goal_id) counts.set(r.goal_id, (counts.get(r.goal_id) ?? 0) + 1);
  }
  return g.map((goal) => ({ ...goal, progress: p.get(goal.id) ?? 0, projectCount: counts.get(goal.id) ?? 0 }));
}

export async function getGoal(supabase: ServerSupabase, id: string) {
  const [goal, progress, checkins] = await Promise.all([
    supabase.from("goals").select("*").eq("id", id).maybeSingle(),
    supabase.from("goal_progress").select("progress").eq("goal_id", id).maybeSingle(),
    supabase.from("goal_checkins").select("*").eq("goal_id", id).order("recorded_at", { ascending: false }).limit(50),
  ]);
  if (goal.error) throw new Error(goal.error.message);
  if (!goal.data) return null;
  return {
    goal: goal.data,
    progress: progress.data?.progress ?? 0,
    checkins: must(checkins, "el historial"),
  };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export async function listProjects(
  supabase: ServerSupabase,
  opts: { goalId?: string } = {},
): Promise<ProjectWithProgress[]> {
  let q = supabase.from("projects").select("*, goals(title)").order("updated_at", { ascending: false });
  if (opts.goalId) q = q.eq("goal_id", opts.goalId);
  const [projects, progress] = await Promise.all([
    q,
    supabase.from("project_progress").select("*"),
  ]);
  const p = new Map(must(progress, "el progreso").map((r) => [r.project_id, r]));
  return must(projects, "los proyectos").map(({ goals, ...project }) => {
    const pr = p.get(project.id);
    return {
      ...project,
      goal_title: (goals as { title: string } | null)?.title ?? null,
      progress: pr?.progress ?? 0,
      total_tasks: pr?.total_tasks ?? 0,
      completed_tasks: pr?.completed_tasks ?? 0,
      spent_minutes: pr?.spent_minutes ?? 0,
    };
  });
}

export async function getProject(supabase: ServerSupabase, id: string) {
  const [project, progress] = await Promise.all([
    supabase.from("projects").select("*, goals(id, title)").eq("id", id).maybeSingle(),
    supabase.from("project_progress").select("*").eq("project_id", id).maybeSingle(),
  ]);
  if (project.error) throw new Error(project.error.message);
  if (!project.data) return null;
  return { project: project.data, progress: progress.data };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export type TaskFilter = {
  projectId?: string;
  status?: "open" | "all" | "completed";
  scheduledFrom?: string;
  scheduledTo?: string;
};

export async function listTasks(supabase: ServerSupabase, f: TaskFilter = {}): Promise<TaskWithProject[]> {
  let q = supabase.from("tasks").select("*, projects(title)");
  if (f.projectId) q = q.eq("project_id", f.projectId);
  if (f.status === "open") q = q.in("status", ["pending", "in_progress"]);
  if (f.status === "completed") q = q.eq("status", "completed");
  if (f.scheduledFrom) q = q.gte("scheduled_date", f.scheduledFrom);
  if (f.scheduledTo) q = q.lte("scheduled_date", f.scheduledTo);
  q = q.order("completed_at", { ascending: false, nullsFirst: true }).order("created_at", { ascending: false }).limit(500);
  return must(await q, "las tareas").map(({ projects, ...t }) => ({
    ...t,
    project_title: (projects as { title: string } | null)?.title ?? null,
  }));
}

export async function listProjectOptions(supabase: ServerSupabase) {
  const res = await supabase
    .from("projects")
    .select("id, title, status")
    .not("status", "in", "(completed,cancelled)")
    .order("title");
  return must(res, "los proyectos");
}

export async function listGoalOptions(supabase: ServerSupabase) {
  const res = await supabase.from("goals").select("id, title, status").in("status", ["active", "paused"]).order("title");
  return must(res, "los objetivos");
}

// ---------------------------------------------------------------------------
// Daily planner
// ---------------------------------------------------------------------------
export async function getDay(supabase: ServerSupabase, date: string, tz: string) {
  const bounds = dayBoundsUtc(date, tz);
  const [log, scheduled, completedToday, overdue, time] = await Promise.all([
    supabase.from("daily_logs").select("*").eq("log_date", date).maybeSingle(),
    supabase.from("tasks").select("*, projects(title)").eq("scheduled_date", date).order("focus_rank", { ascending: true, nullsFirst: false }).order("priority", { ascending: false }),
    supabase.from("tasks").select("id").eq("status", "completed").gte("completed_at", bounds.start).lt("completed_at", bounds.end),
    supabase.from("tasks").select("*, projects(title)").in("status", ["pending", "in_progress"]).lt("scheduled_date", date).order("scheduled_date"),
    supabase.from("time_entries").select("minutes").eq("logged_on", date),
  ]);
  const mapTask = ({ projects, ...t }: Task & { projects: { title: string } | null }) => ({
    ...t,
    project_title: projects?.title ?? null,
  });
  return {
    log: log.data,
    scheduled: must(scheduled, "el plan").map(mapTask),
    carriedOver: must(overdue, "las tareas atrasadas").map(mapTask),
    completedCount: must(completedToday, "las tareas completadas").length,
    minutesToday: must(time, "el tiempo").reduce((s, r) => s + r.minutes, 0),
  };
}

// ---------------------------------------------------------------------------
// Ideas, decisions, memory, proposals, activity
// ---------------------------------------------------------------------------
export async function listIdeas(supabase: ServerSupabase) {
  return must(await supabase.from("ideas").select("*").order("created_at", { ascending: false }), "las ideas");
}

export async function listDecisions(supabase: ServerSupabase, limit = 100) {
  return must(
    await supabase.from("decisions").select("*").order("created_at", { ascending: false }).limit(limit),
    "las decisiones",
  );
}

export async function listMemory(supabase: ServerSupabase, limit = 200) {
  return must(
    await supabase.from("ai_memory").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(limit),
    "la memoria",
  );
}

export async function listPendingProposals(supabase: ServerSupabase) {
  return must(
    await supabase.from("ai_proposals").select("*").eq("status", "pending").order("created_at", { ascending: false }),
    "las propuestas",
  );
}

export async function listActivity(supabase: ServerSupabase, limit = 12) {
  return must(
    await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(limit),
    "la actividad",
  );
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export async function getAnalytics(supabase: ServerSupabase, today: string, weekStartsOn: number, tz: string) {
  // Six full months back (covers the monthly chart; weekly uses the last 12 weeks).
  const since = `${addDays(today, -183).slice(0, 7)}-01`;
  const [completedTasks, time, goals, projects, projectProgress, allTasks] = await Promise.all([
    supabase.from("tasks").select("completed_at, project_id").eq("status", "completed").gte("completed_at", dayBoundsUtc(since, tz).start),
    supabase.from("time_entries").select("minutes, logged_on, task_id, tasks(project_id)").gte("logged_on", addDays(today, -365)),
    supabase.from("goals").select("id, status, completed_at"),
    supabase.from("projects").select("id, title, status"),
    supabase.from("project_progress").select("project_id, spent_minutes, progress"),
    supabase.from("tasks").select("status"),
  ]);
  return {
    since,
    weekStart: weekRange(today, weekStartsOn).start,
    completedTasks: must(completedTasks, "las tareas"),
    time: must(time, "el tiempo") as Array<{ minutes: number; logged_on: string; task_id: string; tasks: { project_id: string | null } | null }>,
    goals: must(goals, "los objetivos"),
    projects: must(projects, "los proyectos"),
    projectProgress: must(projectProgress, "el progreso"),
    taskStatuses: must(allTasks, "las tareas"),
  };
}
