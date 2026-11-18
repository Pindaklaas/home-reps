"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Plus, Undo2 } from "lucide-react";
import { toggleTask } from "@/lib/actions/tasks";
import { addIncome } from "@/lib/actions/goals";
import { celebrate } from "@/components/ui/celebrate";

/** The big "¡Hecho!" button of the "Ahora toca" card. */
export function BigDoneButton({ id, title }: { id: string; title: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (completing: boolean) =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const res = await toggleTask(null, fd);
      if (res?.ok) {
        setError(null);
        setDone(completing);
        if (completing) celebrate(title);
      } else setError(res && !res.ok ? res.error : "No se pudo guardar");
    });

  if (done) {
    return (
      <div className="flex items-center gap-3">
        <span className="check-pop inline-flex h-12 items-center gap-2 rounded-xl bg-success px-5 text-base font-semibold text-bg">
          <Check className="h-5 w-5" strokeWidth={3} /> ¡Hecho!
        </span>
        <button type="button" onClick={() => run(false)} disabled={pending} className="inline-flex items-center gap-1 text-sm text-faint hover:text-muted">
          <Undo2 className="h-3.5 w-3.5" /> Deshacer
        </button>
      </div>
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => run(true)}
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-success px-6 text-base font-semibold text-bg transition-transform active:scale-[0.97] disabled:opacity-60 sm:w-auto"
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" strokeWidth={3} />}
        Lo he hecho
      </button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

/** "He ganado dinero": adds an amount to the money goal. */
export function AddIncome({ goalId, unit }: { goalId: string; unit: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await addIncome(null, fd);
      if (res?.ok) {
        setResult({ ok: true, text: res.message ?? "¡Sumado!" });
        setOpen(false);
        celebrate(res.message ?? "¡Dinero sumado!");
      } else setResult({ ok: false, text: res && !res.ok ? res.error : "No se pudo guardar" });
    });
  };

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setOpen(true);
          }}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-semibold text-accent-fg transition-transform active:scale-[0.97]"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} /> He ganado dinero
        </button>
        {result?.ok ? <p className="text-sm font-medium text-success">{result.text}</p> : null}
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:max-w-sm">
      <input type="hidden" name="goal_id" value={goalId} />
      <label htmlFor="income-amount" className="text-sm font-medium text-fg">
        ¿Cuánto has ganado?
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={input}
            id="income-amount"
            name="amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            placeholder="50"
            className="h-11 w-full rounded-xl border border-line-strong bg-bg pl-3 pr-10 text-lg font-semibold tabular-nums text-fg focus:border-accent focus:outline-none"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">{unit}</span>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-accent px-4 font-semibold text-accent-fg disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />} Sumar
        </button>
      </div>
      <input
        name="note"
        maxLength={200}
        placeholder="¿De qué? (opcional, p. ej. «2 tarjetas NFC al bar»)"
        className="h-10 rounded-xl border border-line bg-bg px-3 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
      />
      <button type="button" onClick={() => setOpen(false)} className="self-start text-sm text-faint hover:text-muted">
        Cancelar
      </button>
      {result && !result.ok ? <p className="text-sm text-danger">{result.text}</p> : null}
    </form>
  );
}
