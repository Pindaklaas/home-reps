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
  scheduled_date: "Planificada",
  estimated_minutes: "Estimación (min)",
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

function details(payload: unknown): [string, string][] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  const src = (p.changes as Record<string, unknown> | undefined) ?? p;
  return Object.entries(src)
    .filter(([k, v]) => k in FIELD_LABEL && v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length) && !(k === "title" && !p.changes))
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

  return (
    <div className={cn("rounded-lg border bg-surface p-3.5 text-sm transition-opacity", status === "pending" ? "border-line-strong" : "border-line opacity-80")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-faint">{ACTION_LABEL[p.action] ?? p.action}</span>
        <Badge tone={tone[status]}>{PROPOSAL_STATUS_LABEL[status]}</Badge>
      </div>
      <p className="mt-1.5 font-medium text-fg">{p.summary}</p>
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
      {p.rationale ? <p className="mt-2 text-[13px] text-muted">{p.rationale}</p> : null}
      {err && status !== "applied" ? <p className="mt-2 text-xs text-danger">{err}</p> : null}

      {status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <form action={approve}>
            <input type="hidden" name="id" value={p.id} />
            <button
              type="submit"
              disabled={approving || rejecting}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[13px] font-medium text-accent-fg hover:brightness-110 disabled:opacity-50"
            >
              {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aprobar
            </button>
          </form>
          <form action={reject}>
            <input type="hidden" name="id" value={p.id} />
            <button
              type="submit"
              disabled={approving || rejecting}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-[13px] text-muted hover:bg-hover hover:text-fg disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Rechazar
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
