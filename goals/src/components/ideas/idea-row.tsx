"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowUpRight, ChevronDown, FolderPlus, Loader2, Pencil, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { InlineAction } from "@/components/ui/forms";
import { Menu, menuItemClass } from "@/components/ui/menu";
import { IdeaDialog } from "@/components/forms/entity-forms";
import { convertIdeaToProject, deleteIdea, setIdeaStatus } from "@/lib/actions/ideas";
import { evaluateIdea } from "@/lib/actions/ai";
import { IDEA_STATUS_LABEL, IDEA_STATUS_TONE } from "@/lib/constants";
import { ideaEvaluationSchema, VERDICT_LABEL, VERDICT_TONE } from "@/lib/ai/schemas";
import { formatDateTime } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/cn";
import { AskClaude, type ClaudeMode } from "@/components/brain/ask-claude";

function Meter({ value, label, invert = false }: { value: number | null; label: string; invert?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`${label}: ${value ?? "sin valorar"}/5`}>
      <span className="text-faint">{label}</span>
      <span className="flex gap-0.5" aria-label={`${label} ${value ?? 0} de 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              value && n <= value ? (invert ? "bg-warning" : "bg-accent") : "bg-subtle",
            )}
          />
        ))}
      </span>
    </span>
  );
}

export function IdeaRow({ idea, tz, mode }: { idea: Tables<"ideas">; tz: string; mode: ClaudeMode }) {
  const [open, setOpen] = useState(false);
  const [evalState, evalAction, evaluating] = useActionState(evaluateIdea, null);
  const parsed = ideaEvaluationSchema.safeParse(idea.ai_evaluation);
  const evaluation = parsed.success ? parsed.data : null;

  return (
    <li className="border-b border-line py-3.5">
      <div className="flex items-start gap-3 px-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-fg">{idea.title}</span>
            {idea.status !== "new" ? <Badge tone={IDEA_STATUS_TONE[idea.status]}>{IDEA_STATUS_LABEL[idea.status]}</Badge> : null}
            {evaluation ? (
              <Badge tone={VERDICT_TONE[evaluation.verdict]}>
                <Sparkles className="h-3 w-3" /> {VERDICT_LABEL[evaluation.verdict]} · {evaluation.score}
              </Badge>
            ) : null}
            <ChevronDown className={cn("h-3.5 w-3.5 text-faint transition-transform", open && "rotate-180")} aria-hidden />
          </div>
          {evaluation ? <p className="mt-1 line-clamp-2 text-[13.5px] text-muted">{evaluation.summary}</p> : null}
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="capitalize text-faint">{idea.category}</span>
            {idea.potential ? <Meter value={idea.potential} label="Potencial" /> : null}
            {idea.difficulty ? <Meter value={idea.difficulty} label="Dificultad" invert /> : null}
            {idea.estimated_cost !== null ? (
              <span className="tabular-nums text-faint">
                {Number(idea.estimated_cost).toLocaleString("es-ES", { style: "currency", currency: idea.currency, maximumFractionDigits: 0 })}
              </span>
            ) : null}
          </div>
        </button>
        <Menu label={`Acciones de ${idea.title}`}>
          <IdeaDialog
            idea={idea}
            trigger={(o) => (
              <button type="button" className={menuItemClass} onClick={o}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            )}
          />
          {!idea.converted_project_id ? (
            <InlineAction
              action={convertIdeaToProject}
              fields={{ id: idea.id }}
              confirm={`¿Crear un proyecto a partir de «${idea.title}»? La idea se conserva vinculada.`}
              className={menuItemClass}
            >
              <FolderPlus className="h-3.5 w-3.5" /> Convertir en proyecto
            </InlineAction>
          ) : null}
          {idea.status !== "parked" && idea.status !== "converted" ? (
            <InlineAction action={setIdeaStatus} fields={{ id: idea.id, status: "parked" }} className={menuItemClass}>
              Aparcar
            </InlineAction>
          ) : null}
          {idea.status === "parked" || idea.status === "discarded" ? (
            <InlineAction action={setIdeaStatus} fields={{ id: idea.id, status: "exploring" }} className={menuItemClass}>
              Volver a explorar
            </InlineAction>
          ) : null}
          <div className="my-1 h-px bg-line" />
          <InlineAction
            action={deleteIdea}
            fields={{ id: idea.id }}
            confirm={`¿Eliminar definitivamente la idea «${idea.title}»? Si solo quieres apartarla, usa «Aparcar».`}
            className={cn(menuItemClass, "hover:text-danger")}
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </InlineAction>
        </Menu>
      </div>

      {open ? (
        <div className="mt-3 animate-fade-in px-1 pl-1 sm:pl-1">
          {idea.description ? <p className="mb-4 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted">{idea.description}</p> : null}
          {idea.converted_project_id ? (
            <Link href={`/projects/${idea.converted_project_id}`} className="mb-4 inline-flex items-center gap-1 text-[13px] text-accent hover:underline">
              Ver el proyecto creado <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}

          {evaluation ? (
            <div className="rounded-lg border border-line bg-surface p-4 text-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted">
                  <Sparkles className="h-3.5 w-3.5 text-accent" /> Evaluación de Claude · recomendación, no un hecho
                </span>
                {idea.ai_evaluated_at ? <span className="text-xs text-faint">{formatDateTime(idea.ai_evaluated_at, tz)}</span> : null}
              </div>
              <p className="text-fg">{evaluation.summary}</p>
              <p className="mt-2 text-muted">
                <span className="text-faint">Encaje con tus metas: </span>
                {evaluation.fit_with_goals}
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <EvalList title="A favor" items={evaluation.strengths} />
                <EvalList title="Riesgos" items={evaluation.risks} />
                <EvalList title="Siguientes pasos" items={evaluation.next_steps} />
              </div>
              {evaluation.missing_information.length ? (
                <p className="mt-3 text-xs text-faint">Falta información: {evaluation.missing_information.join(" · ")}</p>
              ) : null}
              <p className="mt-2 text-xs text-faint">Confianza: {{ low: "baja", medium: "media", high: "alta" }[evaluation.confidence]}</p>
            </div>
          ) : null}

          {mode === "api" ? (
            <form action={evalAction} className="mt-3 flex items-center gap-3">
              <input type="hidden" name="id" value={idea.id} />
              <button
                type="submit"
                disabled={evaluating}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 text-[13.5px] font-medium text-accent disabled:opacity-50"
              >
                {evaluating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {evaluating ? "Evaluando…" : evaluation ? "Volver a evaluar" : "¿Merece la pena? Pregunta a Claude"}
              </button>
              {evalState && !evalState.ok ? <span className="text-xs text-danger">{evalState.error}</span> : null}
            </form>
          ) : (
            <div className="mt-3">
              <AskClaude
                mode={mode}
                prompt={`Evalúa mi idea «${idea.title}» (id ${idea.id}): ¿merece la pena para mi meta? Dime sí o no, por qué y el primer paso.`}
                label={evaluation ? "Volver a preguntar a Claude" : "¿Merece la pena? Pregunta a Claude"}
              />
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

function EvalList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-1 text-xs text-faint">{title}</div>
      <ul className="list-disc space-y-1 pl-4 text-[13px] text-muted">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
