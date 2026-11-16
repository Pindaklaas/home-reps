import type { Metadata } from "next";
import { Suspense } from "react";
import { Target } from "lucide-react";
import { getAppContext, listGoals } from "@/lib/data";
import { EmptyState, ListSkeleton, PageHeader, Section } from "@/components/ui/primitives";
import { GoalDialog } from "@/components/forms/entity-forms";
import { GoalRow, PrimaryGoal } from "@/components/goals/goal-bits";

export const metadata: Metadata = { title: "Objetivos" };

export default function GoalsPage() {
  return (
    <>
      <PageHeader title="Objetivos" description="Los resultados que persigues. Todo lo demás debería empujar alguno de ellos." />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <GoalsContent />
      </Suspense>
    </>
  );
}

async function GoalsContent() {
  const { supabase, today } = await getAppContext();
  const goals = await listGoals(supabase);
  const primary = goals.find((g) => g.is_primary && g.status === "active");
  const active = goals.filter((g) => g.status === "active" && g !== primary);
  const paused = goals.filter((g) => g.status === "paused");
  const closed = goals.filter((g) => g.status === "completed" || g.status === "archived");

  if (!goals.length) {
    return (
      <EmptyState
        icon={<Target className="h-5 w-5" />}
        title="Define tu primer objetivo"
        description="Empieza por uno o dos. Un buen objetivo tiene un resultado medible y una fecha."
        action={<GoalDialog />}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <GoalDialog />
      </div>
      {primary ? <PrimaryGoal goal={primary} today={today} /> : null}
      {active.length ? (
        <Section title={primary ? "Otros objetivos activos" : "Activos"}>
          <ul>{active.map((g) => <GoalRow key={g.id} goal={g} today={today} />)}</ul>
        </Section>
      ) : null}
      {paused.length ? (
        <Section title="En pausa">
          <ul>{paused.map((g) => <GoalRow key={g.id} goal={g} today={today} />)}</ul>
        </Section>
      ) : null}
      {closed.length ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-[13px] font-semibold uppercase tracking-wider text-faint hover:text-muted">
            Completados y archivados · {closed.length}
          </summary>
          <ul className="mt-3">{closed.map((g) => <GoalRow key={g.id} goal={g} today={today} />)}</ul>
        </details>
      ) : null}
    </div>
  );
}
