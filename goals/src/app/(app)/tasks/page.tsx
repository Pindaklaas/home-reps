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
import { addDays, formatLongDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Tareas" };

const VIEWS = ["open", "project", "done"] as const;
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
      <PageHeader title="Tareas" description="Todo lo que tienes que hacer, día a día." />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <TasksContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function TasksContent({ searchParams }: { searchParams: PageProps<"/tasks">["searchParams"] }) {
  const sp = await searchParams;
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "open";
  const { supabase, today } = await getAppContext();

  const [tasks, projects] = await Promise.all([
    listTasks(supabase, { status: view === "done" ? "completed" : "open" }),
    listProjectOptions(supabase),
  ]);
  const sorted =
    view === "done"
      ? [...tasks].sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")).slice(0, 100)
      : [...tasks].sort(byUrgency(today));

  const tabs = [
    { value: "open", label: "Por días" },
    { value: "project", label: "Por proyecto" },
    { value: "done", label: "Hechas" },
  ].map((t) => ({ ...t, href: t.value === "open" ? "/tasks" : `/tasks?view=${t.value}` }));

  let body: React.ReactNode;
  if (sorted.length === 0) {
    body = (
      <EmptyState
        icon={<CheckSquare className="h-5 w-5" />}
        title={view === "done" ? "Aún no has completado tareas" : "No hay tareas aquí"}
        description="Escribe arriba lo próximo que tengas que hacer."
      />
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
  } else if (view === "done") {
    body = (
      <ul>
        {sorted.map((t) => (
          <TaskRow key={t.id} task={t} projects={projects} today={today} />
        ))}
      </ul>
    );
  } else {
    body = <ByDay tasks={sorted} projects={projects} today={today} />;
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Tabs items={tabs} current={view} className="flex-1" />
        <div className="-mt-1 shrink-0">
          <TaskDialog projects={projects} />
        </div>
      </div>
      {view !== "done" ? <QuickAddTask /> : null}
      {body}
    </>
  );
}

const byTime = (a: TaskWithProject, b: TaskWithProject) => (a.scheduled_time ?? "99").localeCompare(b.scheduled_time ?? "99");

/** Open tasks grouped as: atrasadas, hoy, mañana, each later day, sin día. */
function ByDay({ tasks, projects, today }: { tasks: TaskWithProject[]; projects: { id: string; title: string }[]; today: string }) {
  const tomorrow = addDays(today, 1);
  const late = tasks.filter((t) => (t.scheduled_date && t.scheduled_date < today) || (!t.scheduled_date && t.due_date && t.due_date < today));
  const lateIds = new Set(late.map((t) => t.id));
  const dated = tasks.filter((t) => t.scheduled_date && !lateIds.has(t.id));
  const days = [...new Set(dated.map((t) => t.scheduled_date!))].sort();
  const undated = tasks.filter((t) => !t.scheduled_date && !lateIds.has(t.id));
  const label = (d: string) => (d === today ? "Hoy" : d === tomorrow ? "Mañana" : formatLongDate(d));
  const groups: { key: string; title: string; tone?: "danger"; list: TaskWithProject[]; focus?: string }[] = [
    ...(late.length ? [{ key: "late", title: "Atrasadas", tone: "danger" as const, list: late }] : []),
    ...days.map((d) => ({ key: d, title: label(d), list: dated.filter((t) => t.scheduled_date === d).sort(byTime), focus: d })),
    ...(undated.length ? [{ key: "none", title: "Sin día", list: undated }] : []),
  ];
  return (
    <div className="flex flex-col gap-7">
      {groups.map((g) => (
        <Section key={g.key} title={<span className={g.tone === "danger" ? "text-danger" : undefined}>{`${g.title} · ${g.list.length}`}</span>}>
          <ul>
            {g.list.map((t) => (
              <TaskRow key={t.id} task={t} projects={projects} today={today} focusDate={g.focus} hideDay />
            ))}
          </ul>
        </Section>
      ))}
    </div>
  );
}
