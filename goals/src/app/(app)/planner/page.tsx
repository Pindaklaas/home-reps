import type { Metadata } from "next";
import { Fragment, Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { z } from "zod";
import { getAppContext, getDay, listProjectOptions } from "@/lib/data";
import { EmptyState, ListSkeleton, PageHeader, Section, Stat } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { TaskRow } from "@/components/tasks/task-row";
import { QuickAddTask } from "@/components/tasks/quick-add";
import { DayLogForm } from "./day-log-form";
import { DayPlanPanel } from "./day-plan";
import { aiConfigured } from "@/lib/ai/client";
import { dayPlanSchema } from "@/lib/ai/schemas";
import { addDays, formatLongDate, formatMinutes, relativeDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Hoy" };

export default function PlannerPage({ searchParams }: PageProps<"/planner">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Planificador" />
          <ListSkeleton rows={6} />
        </>
      }
    >
      <Planner searchParams={searchParams} />
    </Suspense>
  );
}

async function Planner({ searchParams }: { searchParams: PageProps<"/planner">["searchParams"] }) {
  const sp = await searchParams;
  const { supabase, today, tz, profile } = await getAppContext();
  const date = z.iso.date().safeParse(sp.date).success ? (sp.date as string) : today;
  const [day, projects, goalsRes] = await Promise.all([
    getDay(supabase, date, tz),
    listProjectOptions(supabase),
    supabase.from("goals").select("id, title, is_primary, status").eq("status", "active"),
  ]);

  const focus = [1, 2, 3].map((rank) => day.scheduled.find((t) => t.focus_rank === rank) ?? null);
  const rest = day.scheduled.filter((t) => !t.focus_rank);
  const open = rest.filter((t) => t.status === "pending" || t.status === "in_progress");
  const done = day.scheduled.filter((t) => t.status === "completed");
  const plannedMinutes = day.scheduled.filter((t) => t.status !== "completed" && t.status !== "cancelled").reduce((s, t) => s + (t.estimated_minutes ?? 0), 0);
  const available = day.log?.available_minutes ?? profile?.daily_capacity_minutes ?? 360;
  const plan = dayPlanSchema.safeParse(day.log?.ai_plan);
  const taskTitles: Record<string, string> = Object.fromEntries([...day.scheduled, ...day.carriedOver].map((t) => [t.id, t.title]));
  if (plan.success) {
    const missing = [
      ...plan.data.priorities.map((p) => p.task_id),
      ...plan.data.blocks.map((b) => b.task_id),
      ...plan.data.deferred_task_ids,
    ].filter((id): id is string => Boolean(id) && !taskTitles[id!]);
    if (missing.length) {
      const res = await supabase.from("tasks").select("id, title").in("id", [...new Set(missing)]);
      for (const t of res.data ?? []) taskTitles[t.id] = t.title;
    }
  }

  // Goals the day's work pushes: via the projects of scheduled tasks.
  const projectIds = [...new Set(day.scheduled.map((t) => t.project_id).filter(Boolean))] as string[];
  const linked = projectIds.length
    ? (await supabase.from("projects").select("goal_id").in("id", projectIds).not("goal_id", "is", null)).data?.map((p) => p.goal_id) ?? []
    : [];
  const goals = (goalsRes.data ?? []).filter((g) => g.is_primary || linked.includes(g.id));

  const isToday = date === today;
  return (
    <>
      <PageHeader
        eyebrow={isToday ? "Hoy" : relativeDay(date, today)}
        title={formatLongDate(date)}
        actions={
          <div className="flex items-center gap-1">
            <Link href={`/planner?date=${addDays(date, -1)}`} className={buttonClass("ghost", "icon")} aria-label="Día anterior">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            {!isToday ? (
              <Link href="/planner" className={buttonClass("secondary", "sm")}>
                Hoy
              </Link>
            ) : null}
            <Link href={`/planner?date=${addDays(date, 1)}`} className={buttonClass("ghost", "icon")} aria-label="Día siguiente">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-9">
          <Section title="Tres prioridades">
            <ol className="grid gap-2">
              {focus.map((t, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-0.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-xs font-semibold text-accent">{i + 1}</span>
                  {t ? (
                    <ul className="min-w-0 flex-1">
                      <TaskRow task={t} projects={projects} today={today} focusDate={date} showFocusBadge={false} />
                    </ul>
                  ) : (
                    <span className="py-3 text-sm text-faint">Libre · elige una tarea con «Prioridad {i + 1} del día» en su menú</span>
                  )}
                </li>
              ))}
            </ol>
          </Section>

          <DayPlanPanel
            date={date}
            aiEnabled={aiConfigured()}
            plan={plan.success ? plan.data : null}
            planMeta={day.log?.ai_plan as { start?: string; available_minutes?: number } | null}
            taskTitles={taskTitles}
            defaultMinutes={available}
          />

          <Section title={`Programadas · ${open.length}`}>
            <QuickAddTask scheduledDate={date} placeholder="Añadir tarea a este día…" />
            {open.length ? (
              <ul>
                {open.map((t, i) => {
                  const nowHm = isToday ? nowInZone(tz) : null;
                  const prev = open[i - 1]?.scheduled_time?.slice(0, 5);
                  const cur = t.scheduled_time?.slice(0, 5);
                  const marker = nowHm && cur && cur > nowHm && (!prev || prev <= nowHm);
                  return (
                    <Fragment key={t.id}>
                      {marker ? <NowMarker time={nowHm} /> : null}
                      <TaskRow task={t} projects={projects} today={today} focusDate={date} />
                    </Fragment>
                  );
                })}
              </ul>
            ) : (
              <p className="px-1 text-sm text-faint">No hay más tareas programadas para este día.</p>
            )}
          </Section>

          {isToday && day.carriedOver.length ? (
            <Section title={`Atrasadas de días anteriores · ${day.carriedOver.length}`} description="Reprográmalas o decide si siguen teniendo sentido.">
              <ul>{day.carriedOver.map((t) => <TaskRow key={t.id} task={t} projects={projects} today={today} />)}</ul>
            </Section>
          ) : null}

          {done.length ? (
            <Section title={`Completadas · ${done.length}`}>
              <ul>{done.map((t) => <TaskRow key={t.id} task={t} projects={projects} today={today} focusDate={date} />)}</ul>
            </Section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-8">
          <div className="grid grid-cols-3 gap-4 lg:grid-cols-1 lg:gap-5">
            <Stat label="Completadas" value={day.completedCount} hint={isToday ? "hoy" : "ese día"} />
            <Stat label="Tiempo registrado" value={formatMinutes(day.minutesToday)} />
            <Stat
              label="Planificado"
              value={formatMinutes(plannedMinutes)}
              hint={<span className={plannedMinutes > available ? "text-warning" : undefined}>de {formatMinutes(available)} disponibles</span>}
            />
          </div>

          <Section title="Objetivos del día">
            {goals.length ? (
              <ul className="flex flex-col gap-1.5">
                {goals.map((g) => (
                  <li key={g.id}>
                    <Link href={`/goals/${g.id}`} className="flex items-center gap-2 text-sm text-muted hover:text-fg">
                      <Target className={g.is_primary ? "h-3.5 w-3.5 text-accent" : "h-3.5 w-3.5 text-faint"} />
                      <span className="truncate">{g.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState className="py-6" title="Ningún objetivo conectado" description="Las tareas de hoy no pertenecen a proyectos con objetivo." />
            )}
          </Section>

          <Section title="Registro del día">
            <DayLogForm date={date} log={day.log} />
          </Section>
        </aside>
      </div>
    </>
  );
}

function nowInZone(tz: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(new Date());
}

function NowMarker({ time }: { time: string }) {
  return (
    <li className="flex items-center gap-2 py-1" aria-label={`Ahora, ${time}`}>
      <span className="h-2 w-2 rounded-full bg-danger" aria-hidden />
      <span className="font-mono text-[11px] tabular-nums text-danger">{time}</span>
      <span className="h-px flex-1 bg-danger/40" aria-hidden />
    </li>
  );
}
