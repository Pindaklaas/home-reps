"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, BellRing, CheckCheck, Loader2, RotateCw, Sparkles, Square } from "lucide-react";
import { Markdown } from "./markdown";
import { ProposalCard, type ProposalView } from "./proposal-card";
import { approveProposals } from "@/lib/actions/ai";
import { nudgeBrain, sendToBrain } from "@/lib/actions/brain";
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
  "No estoy avanzando con mi meta principal. ¿Qué hago?",
  "Tengo varias ideas, ¿cuál debería priorizar?",
  "Quiero empezar un negocio. Ayúdame a plantearlo.",
  "Divide mi meta principal en proyectos y tareas",
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
  bridge = false,
  initialPrompt,
  autoSend = false,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  aiEnabled: boolean;
  /** No API key, but the chat can wake Claude Code (it answers in 1–3 min). */
  bridge?: boolean;
  initialPrompt?: string;
  /** Send initialPrompt right away (a button on another page asked Claude). */
  autoSend?: boolean;
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
  const autoSent = useRef(false);

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

  const canSend = aiEnabled || bridge;
  const last = messages[messages.length - 1];
  const waiting = !aiEnabled && bridge && !busy && last?.role === "user";

  async function sendViaBridge(message: string) {
    setInput("");
    setBusy(true);
    const localUser: ChatMessage = { id: `local-u-${Date.now()}`, role: "user", content: message, proposals: [] };
    setMessages((m) => [...m, localUser]);
    const res = await sendToBrain({ conversationId: convId.current, message });
    setBusy(false);
    if (!res?.ok) {
      setMessages((m) => m.filter((x) => x.id !== localUser.id));
      setInput(message);
      setStatus(res && !res.ok ? res.error : "No se pudo enviar");
      return;
    }
    setStatus(null);
    if (!convId.current && res.id) {
      convId.current = res.id;
      router.replace(`/brain/${res.id}`);
    } else router.refresh();
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy || !canSend) return;
    if (!aiEnabled) return sendViaBridge(message);
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

  useEffect(() => {
    if (!autoSend || autoSent.current || !initialPrompt) return;
    autoSent.current = true;
    void send(initialPrompt);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
            {canSend ? (
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
                El chat todavía no está conectado con Claude.{" "}
                <Link href="/settings#claude" className="font-medium underline">
                  Conéctalo en Ajustes
                </Link>{" "}
                (un código que se pega una vez) y podrás escribirle desde aquí.
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
            {waiting ? <Waiting key={last.id} since={last.id} /> : null}
          </ol>
        )}
        <div ref={bottom} />
      </div>

      {status && !aiEnabled ? <p className="mx-auto mt-2 w-full max-w-3xl text-sm text-danger">{status}</p> : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 mx-auto mt-4 w-full max-w-3xl lg:bottom-4"
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
            disabled={!canSend}
            placeholder={canSend ? "Escribe lo que quieras a Claude…" : "Conecta el chat en Ajustes para escribir a Claude"}
            title="Enter para enviar · Mayús+Enter para nueva línea"
            className="max-h-[220px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[14.5px] text-fg placeholder:text-faint focus:outline-none"
          />
          {busy && aiEnabled ? (
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
              disabled={!input.trim() || !canSend || busy}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg transition-opacity disabled:opacity-30"
              aria-label="Enviar"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13.5px] text-muted">
          {pending.length
            ? `${pending.length === 1 ? "1 cambio" : `${pending.length} cambios`} para ti · nada se hace sin tu «sí»`
            : items.length === 1 ? "1 propuesta" : `${items.length} propuestas`}
        </span>
        {pending.length > 1 && !state?.ok ? (
          <form action={action}>
            {pending.map((p) => (
              <input key={p.id} type="hidden" name="ids" value={p.id} />
            ))}
            <button
              type="submit"
              disabled={approving}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-success px-4 text-[14px] font-semibold text-bg disabled:opacity-50"
            >
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />} Sí a todo ({pending.length})
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

/**
 * Claude Code is answering (bridge mode): refresh until the reply lands. After
 * a few minutes, offer to wake it again.
 */
function Waiting({ since }: { since: string }) {
  const router = useRouter();
  const [slow, setSlow] = useState(false);
  const [nudging, start] = useTransition();
  const [nudged, setNudged] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - started;
      if (elapsed > 30 * 60_000) return clearInterval(tick);
      if (elapsed > 5 * 60_000) setSlow(true);
      router.refresh();
    }, 8000);
    return () => clearInterval(tick);
  }, [since, router]);

  return (
    <li className="flex flex-col items-start" aria-live="polite">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-faint">
        <Sparkles className="h-3.5 w-3.5 text-accent" /> Claude
      </div>
      <div className="flex items-start gap-3 rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3">
        <span className="thinking-dots mt-1.5 flex gap-1" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <div className="text-sm">
          <p className="font-medium text-fg">Claude está leyendo tu mensaje…</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-muted">
            <BellRing className="h-3.5 w-3.5" /> Suele tardar 1–3 minutos. Puedes cerrar la app: te llega un aviso.
          </p>
          {slow ? (
            <button
              type="button"
              disabled={nudging || nudged}
              onClick={() =>
                start(async () => {
                  await nudgeBrain();
                  setNudged(true);
                })
              }
              className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline disabled:opacity-50"
            >
              <RotateCw className={cn("h-3.5 w-3.5", nudging && "animate-spin")} />
              {nudged ? "Avisado otra vez" : "Tarda mucho: volver a avisar a Claude"}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
