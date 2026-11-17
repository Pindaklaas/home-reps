"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleTask } from "@/lib/actions/tasks";
import { celebrate } from "@/components/ui/celebrate";
import { cn } from "@/lib/cn";

/** The round checkbox of a task. Completing it plays a short celebration. */
export function TaskToggle({ id, title, done }: { id: string; title: string; done: boolean }) {
  const [shown, setShown] = useOptimistic(done);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      const completing = !shown;
      setShown(completing);
      const fd = new FormData();
      fd.set("id", id);
      const res = await toggleTask(null, fd);
      if (res?.ok) {
        setError(null);
        if (completing) celebrate(title);
      } else {
        setError(res && !res.ok ? res.error : "No se pudo guardar");
      }
    });

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={error ?? (shown ? "Marcar como pendiente" : "Marcar como completada")}
      aria-label={shown ? "Marcar como pendiente" : "Marcar como completada"}
      aria-pressed={shown}
      className={cn(
        "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-all duration-200",
        shown ? "check-pop border-success bg-success text-bg" : "border-line-strong hover:scale-110 hover:border-accent",
        error && "border-danger",
      )}
    >
      {shown ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </button>
  );
}
