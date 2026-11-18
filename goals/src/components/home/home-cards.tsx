import Link from "next/link";
import { AlertTriangle, CalendarCheck2, Clock, Flame, Lightbulb, MessageCircle, PartyPopper, Sparkles, Target } from "lucide-react";
import type { GoalWithProgress, TaskWithProject } from "@/lib/data";
import type { NowPick } from "@/lib/now";
import { daysBetween, formatMinutes, relativeDay } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { AddIncome, BigDoneButton } from "./home-actions";

const hm = (t: string | null) => (t ? t.slice(0, 5) : null);
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

function inMinutes(from: string, to: string) {
  const d = toMin(to) - toMin(from);
  if (d <= 0) return "ya";
  if (d < 60) return `en ${d} min`;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return `en ${h} h${m ? ` ${m} min` : ""}`;
}

function endOf(time: string, minutes: number | null) {
  const end = toMin(time) + Math.max(minutes ?? 30, 15);
  return `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

/** The first thing on the home screen: what to do right now, as big as possible. */
export function NowCard({
  pick,
  today,
  nowHm,
  done,
  total,
  streak,
  canAskClaude,
}: {
  pick: NowPick<TaskWithProject>;
  today: string;
  nowHm: string;
  done: number;
  total: number;
  streak: number;
  canAskClaude: boolean;
}) {
  const task = pick.task;
  const time = hm(task?.scheduled_time ?? null);
  const label =
    pick.kind === "now" ? "Ahora toca" : pick.kind === "next" ? "Lo siguiente" : pick.kind === "later" ? "Lo próximo" : total && done === total ? "¡Has terminado hoy!" : "Hoy tienes el día libre";

  return (
    <section
      aria-labelledby="now-title"
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-surface p-5 sm:p-6",
        pick.kind === "now" ? "border-accent/50" : "border-line",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(420px circle at 0% 0%, var(--accent-soft), transparent 70%)" }}
      />
      <div className="relative">
        <h2 id="now-title" className="flex items-center gap-2 text-[15px] font-semibold text-accent">
          {pick.kind === "now" ? (
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
          ) : pick.kind === "free" ? (
            <PartyPopper className="h-4 w-4" aria-hidden />
          ) : (
            <Clock className="h-4 w-4" aria-hidden />
          )}
          {label}
        </h2>

        {task ? (
          <>
            <p className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-fg sm:text-3xl">{task.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-muted">
              {pick.kind === "later" && task.scheduled_date ? (
                <span className="font-medium text-fg capitalize">{relativeDay(task.scheduled_date, today)}</span>
              ) : null}
              {time ? (
                <span className="tabular-nums">
                  <span className="font-semibold text-fg">{time}</span>
                  {pick.kind === "now" ? ` · hasta las ${endOf(time, task.estimated_minutes)}` : pick.kind === "next" ? ` · ${inMinutes(nowHm, time)}` : ""}
                </span>
              ) : null}
              {task.estimated_minutes ? <span>{formatMinutes(task.estimated_minutes)}</span> : null}
              {task.project_title ? <span className="rounded-full bg-subtle px-2.5 py-0.5 text-[13px] text-muted">{task.project_title}</span> : null}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              {pick.kind !== "later" ? <BigDoneButton key={task.id} id={task.id} title={task.title} /> : null}
              <Link href={pick.kind === "later" && task.scheduled_date ? `/planner?date=${task.scheduled_date}` : "/planner"} className="text-[15px] font-medium text-accent hover:underline">
                {pick.kind === "later" ? "Ver ese día" : "Ver todo mi día"}
              </Link>
            </div>
          </>
        ) : (
          <div className="mt-3">
            <p className="text-[22px] font-bold leading-tight text-fg">{total ? "Todo hecho. ¡Descansa!" : "No hay nada apuntado."}</p>
            {canAskClaude ? (
              <Link
                href={`/brain?prompt=${encodeURIComponent("Organízame lo que queda de hoy")}`}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-semibold text-accent-fg"
              >
                <Sparkles className="h-4 w-4" /> Pídele un plan a Claude
              </Link>
            ) : null}
          </div>
        )}

        {pick.missed.length ? (
          <Link href="/planner" className="mt-5 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Se te ha pasado: <b>{pick.missed.map((m) => `${hm(m.scheduled_time)} ${m.title}`).join(", ")}</b>. Márcalo o cámbialo de hora.
            </span>
          </Link>
        ) : null}

        <TodayDots done={done} total={total} streak={streak} />
      </div>
    </section>
  );
}

function TodayDots({ done, total, streak }: { done: number; total: number; streak: number }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <div className="flex items-center gap-3">
        {total ? (
          <span className="flex gap-1.5" aria-hidden>
            {Array.from({ length: Math.min(total, 10) }, (_, i) => (
              <span key={i} className={cn("h-3 w-3 rounded-full", i < done ? "bg-success" : "border-2 border-line-strong")} />
            ))}
          </span>
        ) : null}
        <span className="text-[15px] text-muted">
          Hoy: <b className="text-fg tabular-nums">{done}</b> de <b className="text-fg tabular-nums">{total}</b> {total === 1 ? "hecha" : "hechas"}
        </span>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
          streak ? "bg-warning-soft text-warning" : "border border-line text-faint",
        )}
        title="Días seguidos completando al menos una tarea"
      >
        <Flame className="h-4 w-4" aria-hidden /> {streak} {streak === 1 ? "día seguido" : "días seguidos"}
      </span>
    </div>
  );
}

const fmt = (n: number) => formatNumber(n);

/** The money goal in plain words: how much, how much is left, and a button to add income. */
export function MoneyCard({ goal, today }: { goal: GoalWithProgress; today: string }) {
  const target = Number(goal.metric_target);
  const current = Number(goal.metric_current ?? 0);
  const unit = goal.metric_unit ?? "";
  const pct = Math.max(0, Math.min(100, target ? (current / target) * 100 : 0));
  const steps = [0.2, 0.5, 1].map((f) => Math.round(target * f));
  const next = steps.find((m) => current < m);
  const days = goal.target_date ? daysBetween(today, goal.target_date) : null;

  return (
    <section aria-labelledby="money-title" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="money-title" className="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <Target className="h-4 w-4 text-success" aria-hidden />
          <Link href={`/goals/${goal.id}`} className="hover:underline">
            {goal.title}
          </Link>
        </h2>
        {days !== null && days >= 0 ? <span className="shrink-0 text-sm text-muted">quedan {days} días</span> : null}
      </div>

      <p className="mt-3 tabular-nums">
        <span className="text-[40px] font-bold leading-none tracking-tight text-fg">{fmt(current)}</span>
        <span className="ml-1 text-xl font-semibold text-fg">{unit}</span>
        <span className="ml-2 text-lg text-muted">
          de {fmt(target)} {unit}
        </span>
      </p>

      <div className="relative mt-4 h-4 rounded-full bg-subtle" role="img" aria-label={`${Math.round(pct)}% de la meta`}>
        <div className="h-4 rounded-full bg-success transition-[width] duration-700" style={{ width: `${Math.max(pct, current > 0 ? 3 : 0)}%` }} />
        {steps.slice(0, -1).map((m) => (
          <span key={m} aria-hidden className="absolute top-0 h-4 w-0.5 bg-bg" style={{ left: `${(m / target) * 100}%` }} />
        ))}
      </div>
      <div className="relative mt-1.5 h-5 text-xs tabular-nums text-faint" aria-hidden>
        {steps.map((m) => (
          <span
            key={m}
            className={cn("absolute -translate-x-1/2 whitespace-nowrap", current >= m && "font-semibold text-success", m === target && "right-0 translate-x-0")}
            style={m === target ? undefined : { left: `${(m / target) * 100}%` }}
          >
            {current >= m ? "✓ " : ""}
            {fmt(m)}
          </span>
        ))}
      </div>

      <p className="mt-3 text-[15px] text-muted">
        {next ? (
          <>
            Siguiente meta: <b className="text-fg">{fmt(next)} {unit}</b> · te faltan <b className="text-fg">{fmt(next - current)} {unit}</b>
          </>
        ) : (
          <b className="text-success">¡Meta conseguida!</b>
        )}
      </p>
      <div className="mt-4">
        <AddIncome goalId={goal.id} unit={unit} />
      </div>
    </section>
  );
}

const TILES = [
  { href: "/brain", label: "Claude", hint: "Escríbele lo que quieras", icon: MessageCircle, tone: "bg-accent-soft text-accent" },
  { href: "/planner", label: "Mi día", hint: "Tus tareas de hoy", icon: CalendarCheck2, tone: "bg-success-soft text-success" },
  { href: "/goals", label: "Metas", hint: "Lo que quieres conseguir", icon: Target, tone: "bg-warning-soft text-warning" },
  { href: "/ideas", label: "Ideas", hint: "Apunta una idea", icon: Lightbulb, tone: "bg-subtle text-fg" },
] as const;

/** Four big doors to the main places of the app. */
export function HomeTiles({ waiting }: { waiting?: number }) {
  return (
    <nav aria-label="Accesos rápidos" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TILES.map(({ href, label, hint, icon: Icon, tone }) => (
        <Link
          key={href}
          href={href}
          className="group relative flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong active:scale-[0.98]"
        >
          <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", tone)}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block text-base font-semibold text-fg">{label}</span>
            <span className="block text-[13px] leading-snug text-muted">{hint}</span>
          </span>
          {href === "/brain" && waiting ? (
            <span className="absolute right-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-fg">{waiting}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
