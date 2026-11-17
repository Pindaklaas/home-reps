import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Flame, Sparkles } from "lucide-react";
import { getAppContext, getDay, listActivity, listGoals, listPendingProposals, listProjectOptions, listProjects, listTasks } from "@/lib/data";
import { EmptyState, ListSkeleton, ProgressBar, Section, Skeleton, Stat } from "@/components/ui/primitives";
import { PrimaryGoal } from "@/components/goals/goal-bits";
import { ProjectRow } from "@/components/projects/project-row";
import { TaskRow } from "@/components/tasks/task-row";
import { AiButton } from "@/components/brain/ai-button";
import { generateRecommendation } from "@/lib/actions/ai";
import { aiConfigured } from "@/lib/ai/client";
import { dailyRecommendationSchema } from "@/lib/ai/schemas";
import { PRIORITY_WEIGHT } from "@/lib/constants";
import { addDays, dateOf, dayBoundsUtc, formatDateTime, formatLongDate, formatMinutes, relativeTime, weekRange } from "@/lib/dates";
import { GoalDialog } from "@/components/forms/entity-forms";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-28 w-full" />
      <ListSkeleton rows={4} />
    </div>
  );
}

function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: tz }).format(new Date()));
  return h < 6 ? "Buenas noches" : h < 14 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
}

const ENTITY: Record<string, { label: string; href: (id: string) => string }> = {
  goals: { label: "Objetivo", href: (id) => `/goals/${id}` },
  projects: { label: "Proyecto", href: (id) => `/projects/${id}` },
  tasks: { label: "Tarea", href: () => "/tasks" },
  ideas: { label: "Idea", href: () => "/ideas" },
  decisions: { label: "Decisión", href: () => "/brain/memory" },
};
const ACTION: Record<string, string> = { created: "creado", status_changed: "→", deleted: "eliminado", updated: "editado" };
const STATUS_ES: Record<string, string> = {
  completed: "completado", active: "activo", paused: "pausado", in_progress: "en progreso", pending: "pendiente",
  cancelled: "cancelado", planned: "planificado", archived: "archivado", converted: "convertida", parked: "aparcada",
  approved: "aprobada", rejected: "rechazada", discarded: "descartada", exploring: "explorando", validated: "validada", idea: "idea", new: "nueva",
};

async function Dashboard() {
  const { supabase, today, tz, profile } = await getAppContext();
  const week = weekRange(today, profile?.week_starts_on ?? 1);
  const lastWeekStart = addDays(week.start, -7);

  const [goals, projects, openTasks, day, activity, proposals, projectOptions, completedRecent, timeWeek] = await Promise.all([
    listGoals(supabase),
    listProjects(supabase),
    listTasks(supabase, { status: "open" }),
    getDay(supabase, today, tz),
    listActivity(supabase, 10),
    listPendingProposals(supabase),
    listProjectOptions(supabase),
    supabase.from("tasks").select("completed_at").eq("status", "completed").gte("completed_at", dayBoundsUtc(addDays(today, -30), tz).start),
    supabase.from("time_entries").select("minutes, logged_on").gte("logged_on", lastWeekStart),
  ]);

  const primary = goals.find((g) => g.is_primary && g.status === "active");
  const activeGoals = goals.filter((g) => g.status === "active");
  const activeProjects = projects.filter((p) => p.status === "active").sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
  const focus = day.scheduled.filter((t) => t.focus_rank).sort((a, b) => a.focus_rank! - b.focus_rank!);
  const overdue = openTasks.filter((t) => t.due_date && t.due_date < today);
  const upcoming = openTasks
    .filter((t) => !t.focus_rank || t.scheduled_date !== today)
    .filter((t) => (t.due_date && t.due_date <= addDays(today, 3)) || t.scheduled_date === today || t.status === "in_progress")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
    .slice(0, 6);

  // Productivity indicators from real rows.
  const doneDates = (completedRecent.data ?? []).map((r) => dateOf(r.completed_at!, tz));
  const doneThisWeek = doneDates.filter((d) => d >= week.start).length;
  const doneLastWeek = doneDates.filter((d) => d >= lastWeekStart && d < week.start).length;
  const minutesWeek = (timeWeek.data ?? []).filter((r) => r.logged_on >= week.start).reduce((s, r) => s + r.minutes, 0);
  const daysWithDone = new Set(doneDates);
  let streak = 0;
  for (let d = daysWithDone.has(today) ? today : addDays(today, -1); daysWithDone.has(d); d = addDays(d, -1)) streak++;

  const todayTotal = day.scheduled.filter((t) => t.status !== "cancelled").length;
  const todayDone = day.scheduled.filter((t) => t.status === "completed").length;
  const rec = dailyRecommendationSchema.safeParse(day.log?.ai_recommendation);
  const recTasks = rec.success ? openTasks.filter((t) => rec.data.focus_task_ids.includes(t.id)) : [];
  const ai = aiConfigured();

  return (
    <div className="flex flex-col gap-10">
      <header>
        <div className="text-xs font-medium uppercase tracking-wider text-faint">{formatLongDate(today)}</div>
        <h1 className="mt-1.5 text-[22px] font-semibold tracking-tight sm:text-2xl">
          {greeting(tz)}
          {profile?.display_name ? `, ${profile.display_name}` : ""}.
        </h1>
        <TodayMeter done={todayDone} total={todayTotal} streak={streak} />
        <p className="mt-1 text-sm text-muted">
          {focus.length
            ? `Tienes ${focus.length} ${focus.length === 1 ? "prioridad" : "prioridades"} para hoy${overdue.length ? ` y ${overdue.length} ${overdue.length === 1 ? "tarea atrasada" : "tareas atrasadas"}` : ""}.`
            : "Aún no has elegido las prioridades de hoy."}{" "}
          <Link href="/planner" className="text-accent hover:underline">
            Abrir el día
          </Link>
        </p>
      </header>

      {/* Claude's recommendation */}
      <section aria-labelledby="rec-title" className="rounded-xl border border-line bg-surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="rec-title" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> Recomendación de Claude
          </h2>
          <AiButton
            action={generateRecommendation}
            disabled={!ai}
            variant="ghost"
            label={rec.success ? "Actualizar" : "Pedir recomendación"}
            pendingLabel="Analizando tu día…"
          />
        </div>
        {rec.success ? (
          <div className="animate-fade-in">
            <p className="text-[15px] font-medium leading-snug text-fg">{rec.data.headline}</p>
            <p className="mt-1.5 text-sm text-muted">{rec.data.why}</p>
            {recTasks.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {recTasks.map((t) => (
                  <li key={t.id} className="rounded-md border border-line bg-bg px-2.5 py-1 text-[13px] text-fg">
                    {t.title}
                  </li>
                ))}
              </ul>
            ) : null}
            {rec.data.warnings.length ? (
              <ul className="mt-3 flex flex-col gap-1">
                {rec.data.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[13px] text-warning">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            ) : null}
            {rec.data.avoid ? <p className="mt-2 text-[13px] text-faint">Evita hoy: {rec.data.avoid}</p> : null}
            {day.log?.ai_recommendation_at ? (
              <p className="mt-3 text-[11px] text-faint">Recomendación generada {formatDateTime(day.log.ai_recommendation_at, tz)} · es un consejo, no un dato</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">
            {ai
              ? "Pide a Claude que analice tus objetivos, tareas y tiempo, y te diga en qué centrarte hoy."
              : "Sin clave de Anthropic: pide la recomendación a Claude Code («actúa como el cerebro de GOALS») y aparecerá aquí."}
          </p>
        )}
      </section>

      {primary ? (
        <PrimaryGoal goal={primary} today={today} />
      ) : (
        <EmptyState
          title={activeGoals.length ? "No hay un objetivo principal" : "Empieza por un objetivo"}
          description={activeGoals.length ? "Marca uno de tus objetivos como principal para que todo lo demás se ordene a su alrededor." : "Todo en GOALS gira alrededor de tus objetivos."}
          action={activeGoals.length ? <Link className="text-sm text-accent hover:underline" href="/goals">Elegir objetivo principal</Link> : <GoalDialog />}
        />
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
        <div className="flex min-w-0 flex-col gap-10">
          <Section
            title="Prioridades de hoy"
            action={
              <Link href="/planner" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
                Planificar <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {focus.length ? (
              <ul>{focus.map((t) => <TaskRow key={t.id} task={t} projects={projectOptions} today={today} focusDate={today} />)}</ul>
            ) : (
              <p className="text-sm text-faint">Sin prioridades elegidas. Abre el planificador o pide a Claude un plan.</p>
            )}
          </Section>

          <Section
            title={`Pendiente ahora${overdue.length ? ` · ${overdue.length} atrasadas` : ""}`}
            action={
              <Link href="/tasks" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
                Todas <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {upcoming.length ? (
              <ul>{upcoming.map((t) => <TaskRow key={t.id} task={t} projects={projectOptions} today={today} />)}</ul>
            ) : (
              <p className="text-sm text-faint">Nada urgente en los próximos tres días.</p>
            )}
          </Section>

          <Section
            title={`Proyectos activos · ${activeProjects.length}`}
            action={
              <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {activeProjects.length ? (
              <ul>{activeProjects.slice(0, 5).map((p) => <ProjectRow key={p.id} project={p} today={today} />)}</ul>
            ) : (
              <p className="text-sm text-faint">No hay proyectos activos.</p>
            )}
          </Section>
        </div>

        <aside className="flex flex-col gap-9">
          <Section title="Esta semana">
            <div className="grid grid-cols-2 gap-5">
              <Stat
                label="Tareas completadas"
                value={doneThisWeek}
                hint={doneLastWeek || doneThisWeek ? `${doneThisWeek >= doneLastWeek ? "+" : ""}${doneThisWeek - doneLastWeek} vs. semana pasada` : "—"}
              />
              <Stat label="Tiempo registrado" value={formatMinutes(minutesWeek)} />
              <Stat label="Racha" value={`${streak} ${streak === 1 ? "día" : "días"}`} hint="con alguna tarea completada" />
              <Stat label="Atrasadas" value={<span className={overdue.length ? "text-danger" : undefined}>{overdue.length}</span>} />
            </div>
          </Section>

          {proposals.length ? (
            <Link href="/brain/memory" className="flex items-center justify-between rounded-lg border border-line bg-surface px-3.5 py-3 text-sm hover:border-line-strong">
              <span>
                <span className="font-medium text-fg">{proposals.length}</span>
                <span className="text-muted"> {proposals.length === 1 ? "propuesta de Claude pendiente" : "propuestas de Claude pendientes"}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-faint" />
            </Link>
          ) : null}

          <Section title="Objetivos">
            {activeGoals.length ? (
              <ul className="flex flex-col gap-3.5">
                {activeGoals.slice(0, 6).map((g) => (
                  <li key={g.id}>
                    <Link href={`/goals/${g.id}`} className="block hover:opacity-80">
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="truncate text-fg">{g.title}</span>
                        <span className="shrink-0 tabular-nums text-muted">{g.progress}%</span>
                      </div>
                      <ProgressBar value={g.progress} label={`Progreso de ${g.title}`} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-faint">Sin objetivos activos.</p>
            )}
          </Section>

          <Section title="Actividad reciente">
            {activity.length ? (
              <ul className="flex flex-col gap-2.5">
                {activity.map((a) => {
                  const e = ENTITY[a.entity_type];
                  const body = (
                    <>
                      <span className="text-faint">{e?.label ?? a.entity_type} </span>
                      <span className="text-fg">{a.title ?? ""}</span>{" "}
                      <span className="text-faint">
                        {a.action === "status_changed" ? `→ ${STATUS_ES[a.to_status ?? ""] ?? a.to_status}` : ACTION[a.action]}
                      </span>
                    </>
                  );
                  return (
                    <li key={a.id} className="text-[13px] leading-snug">
                      {e && a.action !== "deleted" ? (
                        <Link href={e.href(a.entity_id)} className="hover:underline">
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                      <div className="text-[11px] text-faint">{relativeTime(a.created_at)}</div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-faint">Todavía no hay actividad.</p>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
}

function TodayMeter({ done, total, streak }: { done: number; total: number; streak: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="min-w-0 flex-1 sm:max-w-xs">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-muted">Hoy</span>
          <span className="tabular-nums text-fg">
            {done}/{total} {total === 1 ? "tarea" : "tareas"}
          </span>
        </div>
        <ProgressBar value={pct} className="h-2" label={`Hoy: ${done} de ${total} tareas`} />
      </div>
      <span
        className={streak ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning" : "inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-faint"}
        title="Días seguidos completando al menos una tarea"
      >
        <Flame className="h-3.5 w-3.5" aria-hidden /> {streak} {streak === 1 ? "día" : "días"}
      </span>
    </div>
  );
}
