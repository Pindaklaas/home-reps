import type { Metadata } from "next";
import { Suspense } from "react";
import { FolderKanban } from "lucide-react";
import { getAppContext, listGoalOptions, listProjects } from "@/lib/data";
import { EmptyState, ListSkeleton, PageHeader } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { ProjectDialog } from "@/components/forms/entity-forms";
import { ProjectRow } from "@/components/projects/project-row";
import { PRIORITY_WEIGHT, type ProjectStatus } from "@/lib/constants";

export const metadata: Metadata = { title: "Proyectos" };

const VIEWS: Record<string, { label: string; statuses: ProjectStatus[] | null }> = {
  current: { label: "En curso", statuses: ["active", "planned", "paused"] },
  idea: { label: "Ideas", statuses: ["idea"] },
  closed: { label: "Cerrados", statuses: ["completed", "cancelled"] },
  all: { label: "Todos", statuses: null },
};
const ORDER: Record<ProjectStatus, number> = { active: 0, planned: 1, paused: 2, idea: 3, completed: 4, cancelled: 5 };

export default function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  return (
    <>
      <PageHeader title="Proyectos" description="Iniciativas concretas con tareas. Cada uno debería servir a un objetivo." />
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <ProjectsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ProjectsContent({ searchParams }: { searchParams: PageProps<"/projects">["searchParams"] }) {
  const sp = await searchParams;
  const view = typeof sp.view === "string" && sp.view in VIEWS ? sp.view : "current";
  const { supabase, today } = await getAppContext();
  const [projects, goals] = await Promise.all([listProjects(supabase), listGoalOptions(supabase)]);

  const counts = Object.fromEntries(
    Object.entries(VIEWS).map(([k, v]) => [k, v.statuses ? projects.filter((p) => v.statuses!.includes(p.status)).length : projects.length]),
  );
  const filter = VIEWS[view].statuses;
  const list = projects
    .filter((p) => !filter || filter.includes(p.status))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
  const unlinked = projects.filter((p) => !p.goal_id && ["active", "planned"].includes(p.status)).length;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Tabs
          className="flex-1"
          current={view}
          items={Object.entries(VIEWS).map(([value, v]) => ({
            value,
            label: v.label,
            count: counts[value],
            href: value === "current" ? "/projects" : `/projects?view=${value}`,
          }))}
        />
        <div className="-mt-1 shrink-0">
          <ProjectDialog goals={goals} />
        </div>
      </div>

      {unlinked > 0 && view === "current" ? (
        <p className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
          {unlinked === 1 ? "1 proyecto en curso no está vinculado" : `${unlinked} proyectos en curso no están vinculados`} a ningún objetivo. ¿Merecen tu tiempo?
        </p>
      ) : null}

      {list.length ? (
        <ul>{list.map((p) => <ProjectRow key={p.id} project={p} today={today} />)}</ul>
      ) : (
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" />}
          title="No hay proyectos en esta vista"
          description="Crea un proyecto o convierte una idea validada del Ideas Vault."
        />
      )}
    </>
  );
}
