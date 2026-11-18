"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

const EVENT = "goals:celebrate";

/** Fires a short, quiet celebration (toast + burst + tiny vibration). */
export function celebrate(title: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { title } }));
  try {
    navigator.vibrate?.(25);
  } catch {
    // Not supported: fine.
  }
}

const PHRASES = ["¡Hecho!", "¡Una menos!", "¡Bien!", "¡Sigue así!", "¡Avanzando!"];

export function CelebrationHost() {
  const [toast, setToast] = useState<{ id: number; title: string; phrase: string } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onCelebrate = (e: Event) => {
      const title = (e as CustomEvent<{ title: string }>).detail?.title ?? "";
      const id = Date.now();
      setToast({ id, title, phrase: PHRASES[id % PHRASES.length] });
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 2200);
    };
    window.addEventListener(EVENT, onCelebrate);
    return () => {
      window.removeEventListener(EVENT, onCelebrate);
      clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-8"
    >
      <div className="celebrate-pop relative flex max-w-sm items-center gap-3 rounded-full border border-success/30 bg-elevated py-2 pl-2 pr-4 shadow-panel">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-bg">
          <Check className="h-4 w-4" strokeWidth={3} />
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="celebrate-spark" style={{ ["--a" as string]: `${i * 45}deg` }} />
          ))}
        </span>
        <span className="min-w-0 text-sm">
          <span className="font-semibold text-fg">{toast.phrase}</span>{" "}
          <span className="truncate text-muted">{toast.title}</span>
        </span>
      </div>
    </div>
  );
}
