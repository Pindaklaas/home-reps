import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge, Dot, ProgressBar } from "@/components/ui/primitives";
import { GOAL_STATUS_LABEL, GOAL_STATUS_TONE, PRIORITY_LABEL, PRIORITY_TONE } from "@/lib/constants";
import type { GoalWithProgress } from "@/lib/data";
import { daysBetween, formatDate } from "@/lib/dates";

export function deadlineText(target: string | null, today: string) {
  if (!target) return null;
  const d = daysBetween(today, target);
  if (d < 0) return { text: `venció hace ${-d} días`, late: true };
  if (d === 0) return { text: "vence hoy", late: false };
  if (d < 60) return { text: `quedan ${d} días`, late: false };
  return { text: `hasta ${formatDate(target, { day: "numeric", month: "short", year: "numeric" })}`, late: false };
}

export function GoalRow({ goal, today }: { goal: GoalWithProgress; today: string }) {
  const dl = deadlineText(goal.target_date, today);
  return (
    <li>
      <Link
        href={`/goals/${goal.id}`}
        className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-line px-1 py-3.5 transition-colors hover:bg-surface sm:grid-cols-[1fr_180px_auto]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-fg">{goal.title}</span>
            {goal.status !== "active" ? <Badge tone={GOAL_STATUS_TONE[goal.status]}>{GOAL_STATUS_LABEL[goal.status]}</Badge> : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-faint">
            <span className="capitalize">{goal.category}</span>
            <span className="inline-flex items-center gap-1.5">
              <Dot tone={PRIORITY_TONE[goal.priority]} /> {PRIORITY_LABEL[goal.priority]}
            </span>
            {goal.projectCount ? <span>{goal.projectCount === 1 ? "1 proyecto" : `${goal.projectCount} proyectos`}</span> : null}
            {dl ? <span className={dl.late && goal.status === "active" ? "text-danger" : undefined}>{dl.text}</span> : null}
          </div>
        </div>
        <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
          <ProgressBar value={goal.progress} label={`Progreso de ${goal.title}`} />
          <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted">{goal.progress}%</span>
        </div>
        <ChevronRight className="hidden h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden />
      </Link>
    </li>
  );
}

/** The current primary goal, shown large. */
export function PrimaryGoal({ goal, today }: { goal: GoalWithProgress; today: string }) {
  const dl = deadlineText(goal.target_date, today);
  return (
    <Link
      href={`/goals/${goal.id}`}
      className="group relative block overflow-hidden rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong sm:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ background: "radial-gradient(500px circle at 100% 0%, var(--accent-soft), transparent 60%)" }}
      />
      <div className="relative">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-accent">Objetivo principal</div>
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-fg sm:text-xl">{goal.title}</h2>
          <span className="shrink-0 text-3xl font-semibold tabular-nums tracking-tight text-fg">{goal.progress}%</span>
        </div>
        {goal.description ? <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted">{goal.description}</p> : null}
        <ProgressBar value={goal.progress} className="mt-4 h-2" label="Progreso del objetivo principal" />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
          {goal.metric_name && goal.metric_target !== null ? (
            <span className="tabular-nums">
              {goal.metric_name}: {Number(goal.metric_current).toLocaleString("es-ES")} / {Number(goal.metric_target).toLocaleString("es-ES")} {goal.metric_unit ?? ""}
            </span>
          ) : null}
          {dl ? <span className={dl.late ? "text-danger" : undefined}>{dl.text}</span> : null}
          <span>{goal.projectCount === 1 ? "1 proyecto vinculado" : `${goal.projectCount} proyectos vinculados`}</span>
        </div>
      </div>
    </Link>
  );
}
