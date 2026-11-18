import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";
import { z } from "zod";
import { getAppContext, getProject, listGoalOptions, listProjectOptions, listTasks } from "@/lib/data";
import { Badge, Dot, EmptyState, ListSkeleton, ProgressBar, Section, Stat } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { InlineAction } from "@/components/ui/forms";
import { EditProjectButton } from "@/components/forms/entity-forms";
import { TaskRow } from "@/components/tasks/task-row";
import { QuickAddTask } from "@/components/tasks/quick-add";
import { deleteProject } from "@/lib/actions/projects";
import { PRIORITY_LABEL, PRIORITY_TONE, PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "@/lib/constants";
import { formatDate, formatMinutes, relativeDay } from "@/lib/dates";
import { StatusSwitcher } from "./status-switcher";
import { NotesEditor } from "./notes-editor";

export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <>
      <Link href="/projects" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-faint hover:text-muted">
        <ArrowLeft className="h-3.5 w-3.5" /> Proyectos
      </Link>
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <ProjectContent params={params} />
      </Suspense>
    </>
  );
}

async function ProjectContent({ params }: { params: PageProps<"/projects/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, today } = await getAppContext();
  const [data, tasks, goals, projectOptions] = await Promise.all([
    getProject(supabase, id),
    listTasks(supabase, { projectId: id, status: "all" }),
    listGoalOptions(supabase),
    listProjectOptions(supabase),
  ]);
  if (!data) notFound();
  const { project, progress } = data;
  const goal = project.goals as { id: string; title: string } | null;
  const open = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const closed = tasks.filter((t) => t.status === "completed" || t.status === "cancelled");
  const late = project.due_date && project.due_date < today && !["completed", "cancelled"].includes(project.status);
  const btn = buttonClass("secondary", "sm");
  const analyzePrompt = encodeURIComponent(`Analiza el proyecto «${project.title}»: ¿está bien planteado, qué riesgos ves y cuáles deberían ser las próximas tareas?`);

  return (
    <div className="flex flex-col gap-9">
      <header>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={PROJECT_STATUS_TONE[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</Badge>
          <span className="inline-flex items-center gap-1.5 text-xs text-faint">
            <Dot tone={PRIORITY_TONE[project.priority]} /> Prioridad {PRIORITY_LABEL[project.priority].toLowerCase()}
          </span>
          {goal ? (
            <Link href={`/goals/${goal.id}`} className="text-xs text-faint hover:text-muted">
              · Objetivo: {goal.title}
            </Link>
          ) : (
            <span className="text-xs text-warning">· Sin meta</span>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
        {project.description ? <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted">{project.description}</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <StatusSwitcher id={project.id} status={project.status} />
          <EditProjectButton project={project} goals={goals} />
          <Link href={`/brain?prompt=${analyzePrompt}`} className={btn}>
            <Sparkles className="h-3.5 w-3.5" /> Analizar con Claude
          </Link>
          <InlineAction
            action={deleteProject}
            fields={{ id: project.id, redirect: "1" }}
            confirm={`¿Eliminar «${project.title}»? Sus tareas se conservan sin proyecto. No se puede deshacer.`}
            className={buttonClass("ghost", "sm", "hover:text-danger")}
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </InlineAction>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Progreso" value={`${progress?.progress ?? 0}%`} />
        <Stat label="Tareas" value={`${progress?.completed_tasks ?? 0}/${progress?.total_tasks ?? 0}`} hint="completadas" />
        <Stat
          label="Tiempo invertido"
          value={formatMinutes(progress?.spent_minutes ?? 0)}
          hint={progress?.estimated_minutes ? `de ${formatMinutes(progress.estimated_minutes)} estimados` : undefined}
        />
        <Stat
          label="Fecha límite"
          value={project.due_date ? formatDate(project.due_date) : "—"}
          hint={project.due_date ? <span className={late ? "text-danger" : undefined}>{relativeDay(project.due_date, today)}</span> : "Sin fecha"}
        />
      </div>
      <ProgressBar value={progress?.progress ?? 0} className="-mt-4 h-2" />

      <Section title={`Tareas · ${open.length} abiertas`}>
        <QuickAddTask projectId={project.id} />
        {open.length ? (
          <ul>{open.map((t) => <TaskRow key={t.id} task={t} projects={projectOptions} today={today} showProject={false} />)}</ul>
        ) : (
          <EmptyState title="Sin tareas abiertas" description="¿Cuál es la siguiente acción concreta para avanzar este proyecto?" />
        )}
        {closed.length ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-[13px] text-faint hover:text-muted">Completadas y canceladas · {closed.length}</summary>
            <ul className="mt-2">{closed.map((t) => <TaskRow key={t.id} task={t} projects={projectOptions} today={today} showProject={false} />)}</ul>
          </details>
        ) : null}
      </Section>

      <Section title="Notas y resultados">
        <NotesEditor id={project.id} notes={project.notes ?? ""} outcomes={project.outcomes ?? ""} />
      </Section>
    </div>
  );
}
