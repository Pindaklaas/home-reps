"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowUpRight, Check, Loader2, X } from "lucide-react";
import { approveProposal, rejectProposal } from "@/lib/actions/ai";
import { proposalHref } from "@/lib/ai/tools";
import { Badge } from "@/components/ui/primitives";
import {
  GOAL_STATUS_LABEL,
  PRIORITY_LABEL,
  PROJECT_STATUS_LABEL,
  PROPOSAL_STATUS_LABEL,
  TASK_STATUS_LABEL,
  MEMORY_KIND_LABEL,
  type ProposalStatus,
} from "@/lib/constants";
import { cn } from "@/lib/cn";
import { formatDate, formatMinutes } from "@/lib/dates";

export type ProposalView = {
  id: string;
  action: string;
  summary: string;
  rationale: string | null;
  status: ProposalStatus;
  error?: string | null;
  applied_entity_id?: string | null;
  payload?: unknown;
};

const ACTION_LABEL: Record<string, string> = {
  create_goal: "Nueva meta",
  update_goal: "Cambiar meta",
  create_project: "Nuevo proyecto",
  update_project: "Cambiar proyecto",
  create_task: "Nueva tarea",
  update_task: "Cambiar tarea",
  create_idea: "Nueva idea",
  record_decision: "Registrar decisión",
  save_memory: "Guardar en memoria",
};

const FIELD_LABEL: Record<string, string> = {
  description: "Descripción",
  priority: "Prioridad",
  due_date: "Fecha límite",
  target_date: "Fecha límite",
  scheduled_date: "Día",
  scheduled_time: "Hora",
  estimated_minutes: "Duración",
  status: "Estado",
  category: "Categoría",
  decision: "Decisión",
  context: "Contexto",
  options: "Opciones",
  kind: "Tipo",
  title: "Título",
  metric_name: "Métrica",
  metric_target: "Meta",
};

/** Fields shown in the "when" line instead of the detail list. */
const WHEN_FIELDS = new Set(["scheduled_date", "scheduled_time", "estimated_minutes", "priority"]);

/** "viernes, 20 nov · 10:30 · 1 h 30 min" for task proposals. */
function whenLine(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const src = (p.changes as Record<string, unknown> | undefined) ?? p;
  const parts: string[] = [];
  if (typeof src.scheduled_date === "string") parts.push(formatDate(src.scheduled_date, { weekday: "long", day: "numeric", month: "short" }));
  if (typeof src.scheduled_time === "string") parts.push(src.scheduled_time.slice(0, 5));
  if (typeof src.estimated_minutes === "number") parts.push(formatMinutes(src.estimated_minutes));
  return parts.length ? parts.join(" · ") : null;
}

function headline(p: ProposalView): string {
  const payload = p.payload as Record<string, unknown> | null;
  if (payload && typeof payload.title === "string" && !payload.changes) return payload.title;
  return p.summary;
}

function details(payload: unknown): [string, string][] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  const src = (p.changes as Record<string, unknown> | undefined) ?? p;
  return Object.entries(src)
    .filter(([k, v]) => k in FIELD_LABEL && !WHEN_FIELDS.has(k) && v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length) && !(k === "title" && !p.changes))
    .map(([k, v]) => [FIELD_LABEL[k], Array.isArray(v) ? v.join(" · ") : humanize(k, v)]);
}

const STATUS_LABELS: Record<string, string> = { ...GOAL_STATUS_LABEL, ...PROJECT_STATUS_LABEL, ...TASK_STATUS_LABEL };

function humanize(key: string, v: unknown): string {
  const s = String(v);
  if (key === "priority") return PRIORITY_LABEL[s as keyof typeof PRIORITY_LABEL] ?? s;
  if (key === "status") return STATUS_LABELS[s] ?? s;
  if (key === "kind") return MEMORY_KIND_LABEL[s as keyof typeof MEMORY_KIND_LABEL] ?? s;
  return s;
}

const tone = { pending: "warning", approved: "accent", applied: "success", rejected: "muted", failed: "danger" } as const;

export function ProposalCard({ p }: { p: ProposalView }) {
  const [approveState, approve, approving] = useActionState(approveProposal, null);
  const [rejectState, reject, rejecting] = useActionState(rejectProposal, null);
  const err = (approveState && !approveState.ok && approveState.error) || (rejectState && !rejectState.ok && rejectState.error) || p.error;
  // Optimistic status between the click and the router refresh.
  const status: ProposalStatus = approveState?.ok ? "applied" : rejectState?.ok ? "rejected" : p.status;
  const entityId = p.applied_entity_id ?? (approveState?.ok ? approveState.id : undefined) ?? null;
  const href = status === "applied" ? proposalHref(p.action, entityId) : null;
  const rows = details(p.payload);

  const when = whenLine(p.payload);
  const isTask = p.action === "create_task" || p.action === "update_task";

  return (
    <div data-proposal={p.id} className={cn("rounded-xl border bg-surface p-4 text-sm transition-opacity", status === "pending" ? "border-line-strong" : "border-line opacity-80")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-accent">{ACTION_LABEL[p.action] ?? p.action}</span>
        {status !== "pending" ? <Badge tone={tone[status]}>{PROPOSAL_STATUS_LABEL[status]}</Badge> : null}
      </div>
      <p className="mt-1 text-[16px] font-semibold leading-snug text-fg">{headline(p)}</p>
      {when ? <p className="mt-1 text-[14px] font-medium text-fg/90 first-letter:uppercase">{when}</p> : null}
      {rows.length ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-faint">{k}</dt>
              <dd className="min-w-0 break-words text-muted">{v.length > 220 ? `${v.slice(0, 220)}…` : v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {p.rationale ? <p className="mt-2 text-[13.5px] text-muted">Por qué: {p.rationale}</p> : null}
      {err && status !== "applied" ? <p className="mt-2 text-xs text-danger">{err}</p> : null}

      {status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <form action={approve} className="flex-1 sm:flex-none">
            <input type="hidden" name="id" value={p.id} />
            <button
              type="submit"
              disabled={approving || rejecting}
              aria-label="Aprobar"
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-[14px] font-semibold text-accent-fg hover:brightness-110 disabled:opacity-50"
            >
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.5} />} {isTask ? "Sí, apúntalo" : "Sí"}
            </button>
          </form>
          <form action={reject}>
            <input type="hidden" name="id" value={p.id} />
            <button
              type="submit"
              disabled={approving || rejecting}
              aria-label="Rechazar"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-[14px] text-muted hover:bg-hover hover:text-fg disabled:opacity-50"
            >
              <X className="h-4 w-4" /> No
            </button>
          </form>
        </div>
      ) : href ? (
        <Link href={href} className="mt-2 inline-flex items-center gap-1 text-[13px] text-accent hover:underline">
          Ver <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
