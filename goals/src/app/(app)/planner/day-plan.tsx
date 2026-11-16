"use client";

import { useActionState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { applyDayPlan, discardDayPlan, generateDayPlan } from "@/lib/actions/ai";
import type { DayPlan } from "@/lib/ai/schemas";
import { Input } from "@/components/ui/field";
import { InlineAction } from "@/components/ui/forms";
import { Section } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { formatMinutes } from "@/lib/dates";

export function DayPlanPanel({
  date,
  plan,
  planMeta,
  aiEnabled,
  taskTitles,
  defaultMinutes,
}: {
  date: string;
  plan: DayPlan | null;
  planMeta: { start?: string; available_minutes?: number } | null;
  aiEnabled: boolean;
  taskTitles: Record<string, string>;
  defaultMinutes: number;
}) {
  const [state, generate, pending] = useActionState(generateDayPlan, null);

  return (
    <Section
      title="Plan propuesto por Claude"
      description={plan ? "Una propuesta. No cambia nada hasta que la apliques." : "Claude organiza el día según tus prioridades y el tiempo disponible."}
    >
      {plan ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-fg">{plan.summary}</p>
          {plan.priorities.length ? (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
              {plan.priorities.map((p) => (
                <li key={p.task_id}>
                  <span className="text-fg">{taskTitles[p.task_id] ?? "Tarea"}</span> — {p.reason}
                </li>
              ))}
            </ol>
          ) : null}
          {plan.blocks.length ? (
            <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
              {plan.blocks.map((b, i) => (
                <li key={i} className="flex items-baseline gap-3 py-2">
                  <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-faint">{b.start}</span>
                  <span className="min-w-0 flex-1 text-fg">{b.task_id && taskTitles[b.task_id] ? taskTitles[b.task_id] : b.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{formatMinutes(b.minutes)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs text-faint">
            Total {formatMinutes(plan.total_minutes)}
            {planMeta?.available_minutes ? ` de ${formatMinutes(planMeta.available_minutes)} disponibles` : ""}
            {plan.deferred_task_ids.length ? ` · aplazar: ${plan.deferred_task_ids.map((id) => taskTitles[id] ?? "tarea").join(", ")}` : ""}
          </p>
          {plan.notes ? <p className="mt-2 text-xs text-muted">{plan.notes}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <InlineAction action={applyDayPlan} fields={{ date }} className={buttonClass("primary", "sm")} title="Aplicar el plan">
              <Check className="h-3.5 w-3.5" /> Aplicar plan
            </InlineAction>
            <InlineAction action={discardDayPlan} fields={{ date }} className={buttonClass("ghost", "sm")} title="Descartar">
              <X className="h-3.5 w-3.5" /> Descartar
            </InlineAction>
          </div>
        </div>
      ) : null}

      <form action={generate} className={`${plan ? "mt-3" : ""} flex flex-wrap items-end gap-2`}>
        <input type="hidden" name="date" value={date} />
        <label className="flex flex-col gap-1 text-xs text-faint">
          Empiezo a las
          <Input name="start" type="time" defaultValue={planMeta?.start ?? "09:00"} className="h-8 w-28" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-faint">
          Minutos disponibles
          <Input name="minutes" type="number" min={15} max={1440} step={15} defaultValue={planMeta?.available_minutes ?? defaultMinutes} className="h-8 w-28" />
        </label>
        <button
          type="submit"
          disabled={!aiEnabled || pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-subtle px-3 text-[13px] text-fg hover:bg-hover disabled:opacity-50"
          title={aiEnabled ? undefined : "Configura ANTHROPIC_API_KEY para usar Claude"}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-accent" />}
          {pending ? "Planificando…" : plan ? "Rehacer plan" : "Proponer plan"}
        </button>
        {!aiEnabled ? <span className="text-xs text-faint">Claude no está configurado.</span> : null}
        {state && !state.ok ? <span className="text-xs text-danger">{state.error}</span> : null}
      </form>
    </Section>
  );
}
