import type { Metadata } from "next";
import { CheckSquare } from "lucide-react";
import { getAppContext, listProjectOptions, listTasks, type TaskWithProject } from "@/lib/data";
import { Suspense } from "react";
import { EmptyState, ListSkeleton, PageHeader, Section } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { TaskDialog } from "@/components/forms/entity-forms";
import { TaskRow } from "@/components/tasks/task-row";
import { QuickAddTask } from "@/components/tasks/quick-add";
import { PRIORITY_WEIGHT } from "@/lib/constants";
import { addDays, formatLongDate, weekRange } from "@/lib/dates";

export const metadata: Metadata = { title: "Tareas" };

const VIEWS = ["open", "today", "week", "project", "done"] as const;
type View = (typeof VIEWS)[number];

function byUrgency(today: string) {
  return (a: TaskWithProject, b: TaskWithProject) => {
    const ao = a.due_date && a.due_date < today ? 1 : 0;
    const bo = b.due_date && b.due_date < today ? 1 : 0;
    if (ao !== bo) return bo - ao;
    if (a.status !== b.status) return a.status === "in_progress" ? -1 : b.status === "in_progress" ? 1 : 0;
    const pw = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (pw) return pw;
    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  };
}

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <>
      <PageHeader title="Tareas" description="Lo que hay que hacer, ordenado por urgencia y prioridad." />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <TasksContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function TasksContent({ searchParams }: { searchParams: PageProps<"/tasks">["searchParams"] }) {
  const sp = await searchParams;
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "open";
  const { supabase, today, profile } = await getAppContext();
  const week = weekRange(today, profile?.week_starts_on ?? 1);

  const [tasks, projects] = await Promise.all([
    listTasks(supabase, {
      status: view === "done" ? "completed" : "open",
      ...(view === "today" ? { scheduledTo: today } : {}),
      ...(view === "week" ? { scheduledFrom: week.start, scheduledTo: week.end } : {}),
    }),
    listProjectOptions(supabase),
  ]);
  const sorted = view === "done" ? tasks : [...tasks].sort(byUrgency(today));

  const tabs = [
    { value: "open", label: "Abiertas" },
    { value: "today", label: "Hoy" },
    { value: "week", label: "Semana" },
    { value: "project", label: "Por proyecto" },
    { value: "done", label: "Completadas" },
  ].map((t) => ({ ...t, href: t.value === "open" ? "/tasks" : `/tasks?view=${t.value}` }));

  let body: React.ReactNode;
  if (sorted.length === 0) {
    body = (
      <EmptyState
        icon={<CheckSquare className="h-5 w-5" />}
        title={view === "done" ? "Aún no has completado tareas" : "No hay tareas aquí"}
        description={view === "today" ? "Planifica tareas para hoy desde su menú o desde el planificador." : "Escribe arriba la próxima acción concreta."}
      />
    );
  } else if (view === "week") {
    const days = Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
    body = (
      <div className="flex flex-col gap-7">
        {days.map((d) => {
          const list = sorted.filter((t) => t.scheduled_date === d);
          if (!list.length) return null;
          return (
            <Section key={d} title={`${formatLongDate(d)}${d === today ? " · hoy" : ""}`}>
              <ul>{list.map((t) => <TaskRow key={t.id} task={t} projects={projects} today={today} focusDate={d} />)}</ul>
            </Section>
          );
        })}
      </div>
    );
  } else if (view === "project") {
    const groups = new Map<string, { title: string; tasks: TaskWithProject[] }>();
    for (const t of sorted) {
      const key = t.project_id ?? "none";
      const g = groups.get(key) ?? { title: t.project_title ?? "Sin proyecto", tasks: [] };
      g.tasks.push(t);
      groups.set(key, g);
    }
    body = (
      <div className="flex flex-col gap-7">
        {[...groups.entries()]
          .sort(([a], [b]) => (a === "none" ? 1 : b === "none" ? -1 : 0))
          .map(([key, g]) => (
            <Section key={key} title={`${g.title} · ${g.tasks.length}`}>
              <ul>{g.tasks.map((t) => <TaskRow key={t.id} task={t} projects={projects} today={today} showProject={false} />)}</ul>
            </Section>
          ))}
      </div>
    );
  } else {
    body = (
      <ul>
        {sorted.map((t) => (
          <TaskRow key={t.id} task={t} projects={projects} today={today} focusDate={view === "today" ? today : undefined} />
        ))}
      </ul>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Tabs items={tabs} current={view} className="flex-1" />
        <div className="-mt-1 shrink-0">
          <TaskDialog projects={projects} />
        </div>
      </div>
      {view !== "done" ? <QuickAddTask scheduledDate={view === "today" ? today : undefined} /> : null}
      {body}
    </>
  );
}
