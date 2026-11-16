import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge, Dot, ProgressBar } from "@/components/ui/primitives";
import { PRIORITY_LABEL, PRIORITY_TONE, PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "@/lib/constants";
import type { ProjectWithProgress } from "@/lib/data";
import { formatMinutes, relativeDay } from "@/lib/dates";

export function ProjectRow({ project, today, showGoal = true }: { project: ProjectWithProgress; today: string; showGoal?: boolean }) {
  const late = project.due_date && project.due_date < today && !["completed", "cancelled"].includes(project.status);
  return (
    <li>
      <Link
        href={`/projects/${project.id}`}
        className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-line px-1 py-3.5 transition-colors hover:bg-surface sm:grid-cols-[1fr_160px_auto]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-fg">{project.title}</span>
            <Badge tone={PROJECT_STATUS_TONE[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-faint">
            {showGoal && project.goal_title ? <span className="truncate">↳ {project.goal_title}</span> : null}
            <span className="inline-flex items-center gap-1.5">
              <Dot tone={PRIORITY_TONE[project.priority]} /> {PRIORITY_LABEL[project.priority]}
            </span>
            <span className="tabular-nums">
              {project.completed_tasks}/{project.total_tasks} tareas
            </span>
            {project.spent_minutes ? <span>{formatMinutes(project.spent_minutes)}</span> : null}
            {project.due_date ? <span className={late ? "text-danger" : undefined}>Límite {relativeDay(project.due_date, today)}</span> : null}
          </div>
        </div>
        <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
          <ProgressBar value={project.progress} label={`Progreso de ${project.title}`} />
          <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted">{project.progress}%</span>
        </div>
        <ChevronRight className="hidden h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden />
      </Link>
    </li>
  );
}
