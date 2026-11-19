import type { Metadata } from "next";
import { Suspense } from "react";
import { getAppContext, getAnalytics, listGoals } from "@/lib/data";
import { ListSkeleton, PageHeader, Section, Stat } from "@/components/ui/primitives";
import { ColumnChart } from "@/components/charts/column-chart";
import { BarList } from "@/components/charts/bar-list";
import { TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/constants";
import { addDays, dateOf, formatDate, formatMinutes, weekRange } from "@/lib/dates";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Números" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader title="Números" description="Cuánto has hecho de verdad, semana a semana." />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <Analytics />
      </Suspense>
    </>
  );
}


async function Analytics() {
  const { supabase, today, tz, profile } = await getAppContext();
  const weekStartsOn = profile?.week_starts_on ?? 1;
  const [a, goals] = await Promise.all([getAnalytics(supabase, today, weekStartsOn, tz), listGoals(supabase)]);
  const money = goals.find((g) => g.is_primary && g.progress_mode === "metric");
  const checkins = money
    ? ((await supabase.from("goal_checkins").select("value, created_at").eq("goal_id", money.id).order("created_at")).data ?? [])
    : [];
  // Money earned per check-in = increase over the previous total (adds via «He ganado dinero»).
  const earned = checkins.map((c, i) => ({ date: dateOf(c.created_at, tz), amount: Math.max(0, Number(c.value) - (i ? Number(checkins[i - 1].value) : Number(money?.metric_start ?? 0))) }));

  const doneDates = a.completedTasks.map((t) => dateOf(t.completed_at!, tz));
  const thisWeek = weekRange(today, weekStartsOn).start;

  // Weekly: last 12 weeks
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(thisWeek, -7 * (11 - i)));
  const weekly = weeks.map((w) => ({
    key: w,
    label: formatDate(w, { day: "numeric", month: "numeric" }),
    tooltip: `Semana del ${formatDate(w)}`,
    value: doneDates.filter((d) => d >= w && d < addDays(w, 7)).length,
    highlight: w === thisWeek,
  }));
  const weeklyHours = weeks.map((w) => ({
    key: w,
    label: formatDate(w, { day: "numeric", month: "numeric" }),
    tooltip: `Semana del ${formatDate(w)}`,
    value: Math.round((a.time.filter((t) => t.logged_on >= w && t.logged_on < addDays(w, 7)).reduce((s, t) => s + t.minutes, 0) / 60) * 10) / 10,
    highlight: w === thisWeek,
  }));

  const weeklyMoney = weeks.map((w) => ({
    key: w,
    label: formatDate(w, { day: "numeric", month: "numeric" }),
    tooltip: `Semana del ${formatDate(w)}`,
    value: earned.filter((e) => e.date >= w && e.date < addDays(w, 7)).reduce((s, e) => s + e.amount, 0),
    highlight: w === thisWeek,
  }));
  const moneyThisWeek = weeklyMoney[weeklyMoney.length - 1].value;

  // Last 30 days
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, -29 + i));
  const daily = days.map((d) => ({
    key: d,
    label: formatDate(d, { day: "numeric" }),
    tooltip: formatDate(d, { weekday: "short", day: "numeric", month: "short" }),
    value: doneDates.filter((x) => x === d).length,
    highlight: d === today,
  }));

  const titles = new Map(a.projects.map((p) => [p.id, p.title]));
  const timeByProject = new Map<string, number>();
  for (const t of a.time) {
    const pid = t.tasks?.project_id ?? "none";
    timeByProject.set(pid, (timeByProject.get(pid) ?? 0) + t.minutes);
  }
  const projectTime = [...timeByProject.entries()]
    .map(([id, minutes]) => ({ key: id, label: id === "none" ? "Sin proyecto" : titles.get(id) ?? "Proyecto", value: minutes, href: id === "none" ? undefined : `/projects/${id}` }))
    .sort((x, y) => y.value - x.value)
    .slice(0, 8);

  const statusCounts = TASK_STATUSES.map((s) => ({ key: s, label: TASK_STATUS_LABEL[s], value: a.taskStatuses.filter((t) => t.status === s).length }));
  const activeGoals = goals.filter((g) => g.status === "active");
  const overall = activeGoals.length ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length) : 0;
  const goalsCompleted = a.goals.filter((g) => g.status === "completed").length;
  const goalsCompletedMonth = a.goals.filter((g) => g.completed_at && dateOf(g.completed_at, tz).startsWith(today.slice(0, 7))).length;
  const totalMinutes90 = a.time.filter((t) => t.logged_on >= addDays(today, -89)).reduce((s, t) => s + t.minutes, 0);
  const doneTotalWindow = doneDates.filter((d) => d >= weeks[0]).length;

  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {money ? (
          <Stat label={money.metric_name ?? "Dinero"} value={`${formatNumber(Number(money.metric_current))} ${money.metric_unit ?? ""}`} hint={`de ${formatNumber(Number(money.metric_target))} ${money.metric_unit ?? ""}`} />
        ) : (
          <Stat label="Progreso de tus metas" value={`${overall}%`} hint={`${activeGoals.length} ${activeGoals.length === 1 ? "meta activa" : "metas activas"}`} />
        )}
        {money ? <Stat label="Ganado esta semana" value={`${formatNumber(moneyThisWeek)} ${money.metric_unit ?? ""}`} /> : <Stat label="Metas conseguidas" value={goalsCompleted} hint={`${goalsCompletedMonth} este mes`} />}
        <Stat label="Tareas hechas" value={doneTotalWindow} hint="últimas 12 semanas" />
        <Stat label="Tiempo apuntado" value={formatMinutes(totalMinutes90)} hint="últimos 90 días" />
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        {money ? (
          <Section title="Dinero ganado por semana" description="Lo que apuntas con «He ganado dinero».">
            <ColumnChart label="Dinero ganado por semana, últimas 12 semanas" data={weeklyMoney} valueFormat="euros" labelEvery={2} />
          </Section>
        ) : null}
        <Section title="Tareas hechas por semana">
          <ColumnChart label="Tareas completadas por semana, últimas 12 semanas" data={weekly} labelEvery={2} />
        </Section>
        <Section title="Tareas hechas por día" description="Últimos 30 días.">
          <ColumnChart label="Tareas completadas por día, últimos 30 días" data={daily} labelEvery={5} />
        </Section>
        <Section title="Horas apuntadas por semana">
          <ColumnChart
            label="Horas registradas por semana, últimas 12 semanas"
            data={weeklyHours}
            valueFormat="hours"
            labelEvery={2}
          />
        </Section>
        <Section title="Tiempo por proyecto" description="Último año, según el tiempo registrado en tareas.">
          <BarList items={projectTime} format={formatMinutes} empty="Registra tiempo en tus tareas para ver dónde va tu esfuerzo." />
        </Section>
        <Section title="Estado de las tareas">
          <BarList items={statusCounts} empty="Sin tareas." />
        </Section>
      </div>

      <Section title="Progreso por meta">
        <BarList
          items={activeGoals.map((g) => ({ key: g.id, label: g.title, value: g.progress, href: `/goals/${g.id}` }))}
          format={(v) => `${v}%`}
          max={100}
          empty="Sin metas activas."
        />
      </Section>
    </div>
  );
}
