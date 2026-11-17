"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, CheckCheck, Loader2, Sparkles, Square } from "lucide-react";
import { Markdown } from "./markdown";
import { ProposalCard, type ProposalView } from "./proposal-card";
import { approveProposals } from "@/lib/actions/ai";
import { cn } from "@/lib/cn";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposals: ProposalView[];
  pending?: boolean;
  error?: string;
};

const SUGGESTIONS = [
  "Organízame mañana",
  "¿Estoy perdiendo el tiempo con algo?",
  "No estoy avanzando con mi objetivo principal. ¿Qué hago?",
  "Tengo varias ideas, ¿cuál debería priorizar?",
  "Quiero empezar un negocio. Ayúdame a plantearlo.",
  "Divide mi objetivo principal en proyectos y tareas",
];

type Event =
  | { type: "conversation"; id: string; title: string }
  | { type: "text"; delta: string }
  | { type: "status"; text: string }
  | { type: "proposals"; items: { id: string; action: string; summary: string; rationale: string | null }[] }
  | { type: "done"; messageId: string | null }
  | { type: "error"; message: string };

export function Chat({
  conversationId,
  initialMessages,
  aiEnabled,
  initialPrompt,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  aiEnabled: boolean;
  initialPrompt?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const convId = useRef<string | null>(conversationId);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Server data wins whenever it changes (after refresh/approval).
  useEffect(() => {
    if (!busy) setMessages(initialMessages);
  }, [initialMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  useEffect(() => {
    const t = textarea.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 220)}px`;
  }, [input]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy || !aiEnabled) return;
    setInput("");
    setBusy(true);
    setStatus(null);
    const localUser: ChatMessage = { id: `local-u-${Date.now()}`, role: "user", content: message, proposals: [] };
    const localAssistant: ChatMessage = { id: `local-a-${Date.now()}`, role: "assistant", content: "", proposals: [], pending: true };
    setMessages((m) => [...m, localUser, localAssistant]);
    const update = (fn: (m: ChatMessage) => ChatMessage) =>
      setMessages((all) => all.map((m) => (m.id === localAssistant.id ? fn(m) : m)));

    const controller = new AbortController();
    abort.current = controller;
    let isNew = !convId.current;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: convId.current, message }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as Event;
          if (ev.type === "conversation") {
            isNew = isNew && convId.current !== ev.id;
            convId.current = ev.id;
          } else if (ev.type === "text") {
            setStatus(null);
            update((m) => ({ ...m, content: m.content + ev.delta }));
          } else if (ev.type === "status") {
            setStatus(ev.text);
          } else if (ev.type === "proposals") {
            update((m) => ({ ...m, proposals: [...m.proposals, ...ev.items.map((p) => ({ ...p, status: "pending" as const }))] }));
          } else if (ev.type === "error") {
            update((m) => ({ ...m, error: ev.message }));
          }
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) update((m) => ({ ...m, error: e instanceof Error ? e.message : "Error de conexión" }));
    } finally {
      update((m) => ({ ...m, pending: false }));
      setBusy(false);
      setStatus(null);
      abort.current = null;
      if (isNew && convId.current) router.replace(`/brain/${convId.current}`);
      else router.refresh();
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex min-h-[calc(100dvh-220px)] flex-col lg:min-h-[calc(100dvh-180px)]">
      <div className="flex-1">
        {empty ? (
          <div className="mx-auto flex max-w-xl flex-col items-center pt-10 text-center sm:pt-16">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">¿En qué piensas?</h2>
            <p className="mt-1 text-sm text-muted">
              Claude conoce tus objetivos, proyectos, tareas e ideas. Propone cambios; tú decides si se aplican.
            </p>
            {aiEnabled ? (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-line-strong hover:bg-surface hover:text-fg"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-6 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
                El chat integrado necesita <code>ANTHROPIC_API_KEY</code>. Mientras tanto, Claude Code es tu cerebro: en una sesión del entorno «goals» pídele «actúa como el cerebro de GOALS». Sus respuestas y propuestas aparecen aquí, en la conversación «Claude Code», y las apruebas tú.
              </p>
            )}
          </div>
        ) : (
          <ol className="mx-auto flex max-w-3xl flex-col gap-6 pb-6" aria-live="polite">
            {messages.map((m) => (
              <li key={m.id} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-subtle px-4 py-2.5 text-[14.5px] text-fg">{m.content}</div>
                ) : (
                  <div className="w-full">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs text-faint">
                      <Sparkles className="h-3.5 w-3.5 text-accent" /> Claude
                    </div>
                    {m.content ? <Markdown text={m.content} /> : null}
                    {m.pending && !m.content ? (
                      <div className="flex items-center gap-2 text-sm text-faint">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {status ?? "Pensando…"}
                      </div>
                    ) : null}
                    {m.pending && m.content && status ? <div className="mt-2 text-xs text-faint">{status}</div> : null}
                    {m.error ? <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{m.error}</p> : null}
                    {m.proposals.length ? <Proposals items={m.proposals} /> : null}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 mx-auto mt-4 w-full max-w-3xl lg:bottom-4"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-elevated p-2 shadow-panel focus-within:border-accent/60">
          <label htmlFor="chat-input" className="sr-only">
            Mensaje para Claude
          </label>
          <textarea
            id="chat-input"
            ref={textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={8000}
            disabled={!aiEnabled}
            placeholder={aiEnabled ? "Escribe con naturalidad…" : "Chat integrado sin clave: usa Claude Code como cerebro"}
            title="Enter para enviar · Mayús+Enter para nueva línea"
            className="max-h-[220px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[14.5px] text-fg placeholder:text-faint focus:outline-none"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-subtle text-fg hover:bg-hover"
              aria-label="Detener"
            >
              <Square className="h-3.5 w-3.5" fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !aiEnabled}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg transition-opacity disabled:opacity-30"
              aria-label="Enviar"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Proposals({ items }: { items: ProposalView[] }) {
  const pending = items.filter((p) => p.status === "pending");
  const [state, action, approving] = useActionState(approveProposals, null);
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted">
          {items.length === 1 ? "1 propuesta" : `${items.length} propuestas`} · nada se aplica sin tu aprobación
        </span>
        {pending.length > 1 && !state?.ok ? (
          <form action={action}>
            {pending.map((p) => (
              <input key={p.id} type="hidden" name="ids" value={p.id} />
            ))}
            <button type="submit" disabled={approving} className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50">
              {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />} Aprobar las {pending.length}
            </button>
          </form>
        ) : null}
      </div>
      {state && !state.ok ? <p className="mb-2 text-xs text-danger">{state.error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((p) => (
          <ProposalCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}
