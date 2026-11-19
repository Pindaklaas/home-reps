"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { sendToBrain } from "@/lib/actions/brain";
import { cn } from "@/lib/cn";

/** How Claude is reachable: API key (instant), chat bridge (1–3 min) or not connected. */
export type ClaudeMode = "api" | "bridge" | "off";

/**
 * Sends a ready-made request to Claude and opens the conversation where the
 * answer will appear. With an API key it opens the chat and sends it there.
 */
export function useAskClaude(mode: ClaudeMode) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ask = (message: string) => {
    setError(null);
    if (mode === "api") {
      router.push(`/brain?prompt=${encodeURIComponent(message)}&send=1`);
      return;
    }
    if (mode === "off") {
      router.push("/settings#claude");
      return;
    }
    start(async () => {
      const res = await sendToBrain({ conversationId: null, message });
      if (res?.ok && res.id) router.push(`/brain/${res.id}`);
      else setError(res && !res.ok ? res.error : "No se pudo enviar");
    });
  };
  return { ask, pending, error };
}

/** A button that asks Claude something specific (evaluate an idea, plan a day…). */
export function AskClaude({
  mode,
  prompt,
  label,
  className,
  size = "sm",
}: {
  mode: ClaudeMode;
  prompt: string;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const { ask, pending, error } = useAskClaude(mode);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => ask(prompt)}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft font-medium text-accent transition-colors hover:border-accent disabled:opacity-60",
          size === "sm" ? "h-9 px-3 text-[13.5px]" : "h-11 px-4 text-[15px]",
          className,
        )}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {pending ? "Enviando a Claude…" : label}
      </button>
      {mode === "off" ? <span className="text-xs text-faint">Primero conecta el chat en Ajustes.</span> : null}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}

/**
 * "Dime todo lo que quieres hacer": Claude answers each thing with yes / later /
 * no and proposes tasks with a day and time that the owner approves.
 */
export function OrganizeBox({ mode, context }: { mode: ClaudeMode; context?: string }) {
  const [text, setText] = useState("");
  const { ask, pending, error } = useAskClaude(mode);
  const items = text
    .split("\n")
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);

  const submit = () => {
    if (!items.length) return;
    ask(`Organízame esto${context ? ` (${context})` : ""}:\n${items.map((i) => `- ${i}`).join("\n")}`);
  };

  return (
    <section aria-labelledby="organize-title" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="organize-title" className="flex items-center gap-2 text-[17px] font-semibold text-fg">
        <Wand2 className="h-5 w-5 text-accent" aria-hidden /> ¿Qué quieres hacer?
      </h2>
      <p className="mt-1 text-[15px] text-muted">Escríbelo todo, una cosa por línea. Claude te dice qué sí, qué no y cuándo hacerlo.</p>
      <label htmlFor="organize-input" className="sr-only">
        Cosas que quieres hacer
      </label>
      <textarea
        id="organize-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={"Comprar más tarjetas NFC\nHacer 3 miniaturas de GTA 6\nIr al gimnasio"}
        className="mt-3 w-full resize-y rounded-xl border border-line-strong bg-bg px-3.5 py-3 text-[15px] leading-relaxed text-fg placeholder:text-faint focus:border-accent focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !items.length}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-semibold text-accent-fg transition-transform active:scale-[0.97] disabled:opacity-40"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {pending ? "Enviando…" : items.length > 1 ? `Organízame estas ${items.length}` : "Organízamelo"}
        </button>
        {mode === "off" ? (
          <Link href="/settings#claude" className="text-sm text-accent underline">
            Conecta el chat para usarlo
          </Link>
        ) : mode === "bridge" ? (
          <span className="text-sm text-faint">Contesta en 1–3 min, con aviso.</span>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </section>
  );
}
