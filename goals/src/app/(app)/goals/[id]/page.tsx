import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Pause, Play, Star, Trash2 } from "lucide-react";
import { getAppContext, getGoal, listGoalOptions, listProjects } from "@/lib/data";
import { Badge, Dot, EmptyState, ListSkeleton, ProgressBar, Section, Stat } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { EditGoalButton, ProjectDialog } from "@/components/forms/entity-forms";
import { InlineAction } from "@/components/ui/forms";
import { ProjectRow } from "@/components/projects/project-row";
import { ColumnChart } from "@/components/charts/column-chart";
import { CheckinForm } from "./checkin-form";
import { deleteGoal, makePrimaryGoal, setGoalStatus } from "@/lib/actions/goals";
import { GOAL_PROGRESS_MODE_LABEL, GOAL_STATUS_LABEL, GOAL_STATUS_TONE, PRIORITY_LABEL, PRIORITY_TONE } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
import { deadlineText } from "@/components/goals/goal-bits";
import { z } from "zod";
import { formatNumber } from "@/lib/format";

export default function GoalPage({ params }: PageProps<"/goals/[id]">) {
  return (
    <>
      <Link href="/goals" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-faint hover:text-muted">
        <ArrowLeft className="h-3.5 w-3.5" /> Metas
      </Link>
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <GoalContent params={params} />
      </Suspense>
    </>
  );
}

async function GoalContent({ params }: { params: PageProps<"/goals/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, today, tz } = await getAppContext();
  const [data, projects, goalOptions] = await Promise.all([
    getGoal(supabase, id),
    listProjects(supabase, { goalId: id }),
    listGoalOptions(supabase),
  ]);
  if (!data) notFound();
  const { goal, progress, checkins } = data;
  const dl = deadlineText(goal.target_date, today);
  const hasMetric = goal.metric_target !== null && goal.metric_name;
  const history = [...checkins].reverse().slice(-20);
  const iconBtn = buttonClass("secondary", "sm");

  return (
    <div className="flex flex-col gap-9">
      <header>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={GOAL_STATUS_TONE[goal.status]}>{GOAL_STATUS_LABEL[goal.status]}</Badge>
          {goal.is_primary ? <Badge tone="accent">Principal</Badge> : null}
          <span className="inline-flex items-center gap-1.5 text-xs text-faint">
            <Dot tone={PRIORITY_TONE[goal.priority]} /> Prioridad {PRIORITY_LABEL[goal.priority].toLowerCase()}
          </span>
          <span className="text-xs capitalize text-faint">· {goal.category}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{goal.title}</h1>
        {goal.description ? <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted">{goal.description}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <EditGoalButton goal={goal} />
          {!goal.is_primary && goal.status === "active" ? (
            <InlineAction action={makePrimaryGoal} fields={{ id: goal.id }} className={iconBtn}>
              <Star className="h-3.5 w-3.5" /> Hacer principal
            </InlineAction>
          ) : null}
          {goal.status === "active" ? (
            <InlineAction action={setGoalStatus} fields={{ id: goal.id, status: "paused" }} className={iconBtn}>
              <Pause className="h-3.5 w-3.5" /> Pausar
            </InlineAction>
          ) : null}
          {goal.status === "paused" || goal.status === "archived" || goal.status === "completed" ? (
            <InlineAction action={setGoalStatus} fields={{ id: goal.id, status: "active" }} className={iconBtn}>
              <Play className="h-3.5 w-3.5" /> Reactivar
            </InlineAction>
          ) : null}
          {goal.status !== "completed" ? (
            <InlineAction
              action={setGoalStatus}
              fields={{ id: goal.id, status: "completed" }}
              confirm="¿Marcar esta meta como conseguida?"
              className={iconBtn}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Completar
            </InlineAction>
          ) : null}
          <InlineAction
            action={deleteGoal}
            fields={{ id: goal.id, redirect: "1" }}
            confirm={`¿Eliminar «${goal.title}»? Sus proyectos se conservan, desvinculados. No se puede deshacer.`}
            className={buttonClass("ghost", "sm", "hover:text-danger")}
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </InlineAction>
        </div>
      </header>

      <Section title="Progreso" description={GOAL_PROGRESS_MODE_LABEL[goal.progress_mode]}>
        <div className="grid gap-6 sm:grid-cols-3">
          <Stat label="Avance" value={`${progress}%`} />
          {hasMetric ? (
            <Stat
              label={goal.metric_name!}
              value={`${formatNumber(Number(goal.metric_current), 2)} ${goal.metric_unit ?? ""}`}
              hint={`Meta: ${formatNumber(Number(goal.metric_target), 2)} ${goal.metric_unit ?? ""} · inicio ${formatNumber(Number(goal.metric_start), 2)}`}
            />
          ) : null}
          <Stat
            label="Fecha límite"
            value={goal.target_date ? formatDate(goal.target_date, { day: "numeric", month: "short", year: "numeric" }) : "—"}
            hint={dl ? <span className={dl.late ? "text-danger" : undefined}>{dl.text}</span> : "Sin fecha"}
          />
        </div>
        <ProgressBar value={progress} className="mt-5 h-2" />
      </Section>

      {goal.metric_name ? (
        <Section title="Métrica" description="Registra el valor real cada vez que cambie. El historial alimenta el progreso y el análisis.">
          <CheckinForm goalId={goal.id} unit={goal.metric_unit} current={Number(goal.metric_current)} />
          {history.length > 1 ? (
            <div className="mt-6">
              <ColumnChart
                label={`Evolución de ${goal.metric_name}`}
                data={history.map((c) => ({
                  key: c.id,
                  label: formatDate(c.recorded_at.slice(0, 10)),
                  tooltip: `${formatDateTime(c.recorded_at, tz)}${c.note ? ` · ${c.note}` : ""}`,
                  value: Number(c.value),
                }))}
                valueFormat="number"
                labelEvery={Math.ceil(history.length / 8)}
              />
            </div>
          ) : null}
          {checkins.length ? (
            <ul className="mt-4 divide-y divide-line text-sm">
              {checkins.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="text-muted">{formatDateTime(c.recorded_at, tz)}{c.note ? ` · ${c.note}` : ""}</span>
                  <span className="tabular-nums text-fg">
                    {formatNumber(Number(c.value), 2)} {goal.metric_unit ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      <Section
        title={`Proyectos · ${projects.length}`}
        action={<ProjectDialog goals={goalOptions} defaultGoalId={goal.id} />}
      >
        {projects.length ? (
          <ul>{projects.map((p) => <ProjectRow key={p.id} project={p} today={today} showGoal={false} />)}</ul>
        ) : (
          <EmptyState
            title="Ningún proyecto empuja esta meta todavía"
            description="Una meta sin proyectos es solo un deseo. Crea el primero o pide a Claude que la divida en proyectos."
          />
        )}
      </Section>
    </div>
  );
}
