import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Pin, PinOff, Trash2 } from "lucide-react";
import { getAppContext, listDecisions, listMemory, listPendingProposals } from "@/lib/data";
import { Badge, EmptyState, ListSkeleton, PageHeader, Section } from "@/components/ui/primitives";
import { InlineAction } from "@/components/ui/forms";
import { ProposalCard } from "@/components/brain/proposal-card";
import { AiButton } from "@/components/brain/ai-button";
import { DecisionDialog, MemoryDialog } from "./forms";
import { confirmMemory, deleteDecision, deleteMemory, setDecisionStatus, togglePinMemory } from "@/lib/actions/memory";
import { generateWeeklyReview } from "@/lib/actions/ai";
import { aiConfigured } from "@/lib/ai/client";
import { claudeMode } from "@/lib/brain";
import { AskClaude } from "@/components/brain/ask-claude";
import { DECISION_STATUS_LABEL, DECISION_STATUS_TONE, MEMORY_KIND_LABEL, type MemoryKind, type ProposalStatus } from "@/lib/constants";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Memoria" };

const GROUPS: { title: string; description: string; kinds: MemoryKind[] }[] = [
  { title: "Información confirmada", description: "Datos y preferencias que Claude puede tratar como ciertos.", kinds: ["fact", "preference"] },
  { title: "Decisiones aprobadas", description: "Compromisos que ya tomaste.", kinds: ["decision"] },
  { title: "Ideas", description: "Aún no son compromisos.", kinds: ["idea"] },
  { title: "Recomendaciones y resúmenes", description: "Opiniones de Claude, no hechos.", kinds: ["recommendation", "summary"] },
];

export default function MemoryPage() {
  return (
    <>
      <Link href="/brain" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-faint hover:text-muted">
        <ArrowLeft className="h-3.5 w-3.5" /> Claude
      </Link>
      <PageHeader
        title="Lo que Claude sabe de ti"
        description="Lo que recuerda, lo que has decidido y los cambios que te propone. Puedes editarlo todo."
      />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <MemoryContent />
      </Suspense>
    </>
  );
}

const iconBtn = "flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-hover hover:text-fg";

async function MemoryContent() {
  const { supabase, tz } = await getAppContext();
  const ai = aiConfigured();
  const [memory, decisions, pending, mode] = await Promise.all([listMemory(supabase), listDecisions(supabase), listPendingProposals(supabase), claudeMode(supabase, ai)]);

  return (
    <div className="flex flex-col gap-10">
      {pending.length ? (
        <Section title={`Claude te propone · ${pending.length}`} description="Nada se hace hasta que digas que sí.">
          <div className="grid gap-2 sm:grid-cols-2">
            {pending.map((p) => (
              <ProposalCard
                key={p.id}
                p={{ id: p.id, action: p.action, summary: p.summary, rationale: p.rationale, status: p.status as ProposalStatus, payload: p.payload, error: p.error }}
              />
            ))}
          </div>
        </Section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <MemoryDialog />
        <DecisionDialog />
        {ai ? (
          <AiButton action={generateWeeklyReview} label="Revisión de la semana" pendingLabel="Revisando la semana…" />
        ) : (
          <AskClaude mode={mode} label="Revisión de la semana" prompt="Hazme la revisión de esta semana: qué hice, cuánto dinero llevo, qué falló y qué cambio para la próxima. Corto y claro." />
        )}
      </div>

      {GROUPS.map((g) => {
        const items = memory.filter((m) => g.kinds.includes(m.kind));
        if (!items.length) return null;
        return (
          <Section key={g.title} title={`${g.title} · ${items.length}`} description={g.description}>
            {items.length ? (
              <ul className="divide-y divide-line">
                {items.map((m) => (
                  <li key={m.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-line text-sm text-fg">{m.content}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
                        <span>{MEMORY_KIND_LABEL[m.kind]}</span>
                        <span>· {m.source === "ai" ? "propuesto por Claude" : "escrito por ti"}</span>
                        <span>· {formatDateTime(m.created_at, tz)}</span>
                        {m.pinned ? <Badge tone="accent">Fijado</Badge> : null}
                        {!m.confirmed && (m.kind === "fact" || m.kind === "preference" || m.kind === "decision") ? <Badge tone="warning">Sin confirmar</Badge> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      {!m.confirmed && (m.kind === "fact" || m.kind === "preference" || m.kind === "decision") ? (
                        <InlineAction action={confirmMemory} fields={{ id: m.id }} className={iconBtn} title="Confirmar">
                          <Check className="h-3.5 w-3.5" />
                        </InlineAction>
                      ) : null}
                      <InlineAction action={togglePinMemory} fields={{ id: m.id }} className={iconBtn} title={m.pinned ? "Desfijar" : "Fijar"}>
                        {m.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </InlineAction>
                      <InlineAction action={deleteMemory} fields={{ id: m.id }} confirm="¿Olvidar este recuerdo?" className={`${iconBtn} hover:text-danger`} title="Eliminar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </InlineAction>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-faint">Nada todavía.</p>
            )}
          </Section>
        );
      })}

      <Section title={`Mis decisiones · ${decisions.length}`} description="Qué decidiste, entre qué opciones y por qué.">
        {decisions.length ? (
          <ul className="divide-y divide-line">
            {decisions.map((d) => (
              <li key={d.id} className="py-3.5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-fg">{d.title}</span>
                      <Badge tone={DECISION_STATUS_TONE[d.status]}>{DECISION_STATUS_LABEL[d.status]}</Badge>
                      {d.source === "ai" ? <span className="text-xs text-faint">vía Claude</span> : null}
                    </div>
                    {d.decision ? <p className="mt-1 text-sm text-muted">{d.decision}</p> : null}
                    {Array.isArray(d.options) && d.options.length ? (
                      <p className="mt-1 text-xs text-faint">Opciones: {(d.options as string[]).join(" · ")}</p>
                    ) : null}
                    {d.rationale ? <p className="mt-1 text-xs text-faint">Motivo: {d.rationale}</p> : null}
                    <p className="mt-1 text-xs text-faint">{formatDateTime(d.decided_at ?? d.created_at, tz)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {d.status === "proposed" ? (
                      <>
                        <InlineAction action={setDecisionStatus} fields={{ id: d.id, status: "approved" }} className="rounded-md px-2 py-1 text-xs text-success hover:bg-success-soft">
                          Aprobar
                        </InlineAction>
                        <InlineAction action={setDecisionStatus} fields={{ id: d.id, status: "rejected" }} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-hover">
                          Rechazar
                        </InlineAction>
                      </>
                    ) : d.status === "approved" ? (
                      <InlineAction action={setDecisionStatus} fields={{ id: d.id, status: "revisited" }} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-hover">
                        Revisar
                      </InlineAction>
                    ) : null}
                    <InlineAction action={deleteDecision} fields={{ id: d.id }} confirm="¿Eliminar esta decisión del registro?" className={`${iconBtn} hover:text-danger`} title="Eliminar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </InlineAction>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Sin decisiones registradas" description="Registrar decisiones importantes te evita repetir debates contigo mismo." />
        )}
      </Section>
    </div>
  );
}
