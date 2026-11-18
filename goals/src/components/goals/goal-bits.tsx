import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge, Dot, ProgressBar } from "@/components/ui/primitives";
import { GOAL_STATUS_LABEL, GOAL_STATUS_TONE, PRIORITY_LABEL, PRIORITY_TONE } from "@/lib/constants";
import type { GoalWithProgress } from "@/lib/data";
import { daysBetween, formatDate } from "@/lib/dates";
import { formatNumber } from "@/lib/format";

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
/** Circular meter for a single value (progress of the primary goal). */
export function Ring({ value, size = 92, label }: { value: number; size?: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--subtle)" strokeWidth={8} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={v >= 100 ? "var(--success)" : "var(--accent)"}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        className="transition-[stroke-dasharray] duration-700"
      />
    </svg>
  );
}

const fmt = (n: number) => formatNumber(n);

/** The current primary goal, shown large. Metric goals get a ring and milestones. */
export function PrimaryGoal({ goal, today }: { goal: GoalWithProgress; today: string }) {
  const dl = deadlineText(goal.target_date, today);
  const target = goal.metric_target !== null ? Number(goal.metric_target) : null;
  const current = Number(goal.metric_current);
  const unit = goal.metric_unit ?? "";
  const milestones = target ? [0.2, 0.5, 1].map((f) => Math.round(target * f)) : [];
  const next = milestones.find((m) => current < m);
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
      <div className="relative flex items-center gap-5">
        {target ? (
          <div className="relative">
            <Ring value={goal.progress} label={`${goal.progress}% del objetivo`} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold tabular-nums tracking-tight text-fg">{goal.progress}%</span>
            </div>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-accent">Meta principal</div>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-fg sm:text-xl">{goal.title}</h2>
            {!target ? <span className="shrink-0 text-3xl font-semibold tabular-nums tracking-tight text-fg">{goal.progress}%</span> : null}
          </div>
          {target ? (
            <p className="mt-1 text-sm tabular-nums text-muted">
              <span className="text-xl font-semibold text-fg">{fmt(current)}</span> / {fmt(target)} {unit}
              {next ? <span className="ml-2 text-xs text-faint">· próximo hito {fmt(next)} {unit}</span> : null}
            </p>
          ) : goal.description ? (
            <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted">{goal.description}</p>
          ) : null}
          {!target ? <ProgressBar value={goal.progress} className="mt-4 h-2" label="Progreso de la meta principal" /> : null}
          {target ? (
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Hitos">
              {milestones.map((m) => (
                <span
                  key={m}
                  className={
                    current >= m
                      ? "rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success tabular-nums"
                      : "rounded-full border border-line px-2 py-0.5 text-[11px] text-faint tabular-nums"
                  }
                >
                  {current >= m ? "✓ " : ""}
                  {fmt(m)} {unit}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
            {dl ? <span className={dl.late ? "text-danger" : undefined}>{dl.text}</span> : null}
            <span>{goal.projectCount === 1 ? "1 proyecto vinculado" : `${goal.projectCount} proyectos vinculados`}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
