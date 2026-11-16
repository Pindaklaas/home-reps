"use client";

import { useEffect, useRef } from "react";
import { useFormAction } from "@/components/ui/forms";
import { CornerDownLeft, Plus } from "lucide-react";
import { createTask } from "@/lib/actions/tasks";

/** One-line capture: type a task and press Enter. */
export function QuickAddTask({
  projectId,
  scheduledDate,
  placeholder = "Añadir tarea y pulsar Enter…",
}: {
  projectId?: string;
  scheduledDate?: string;
  placeholder?: string;
}) {
  const [state, onSubmit, pending] = useFormAction(createTask);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok && input.current) {
      input.current.value = "";
      input.current.focus();
    }
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="mb-2">
      {projectId ? <input type="hidden" name="project_id" value={projectId} /> : null}
      {scheduledDate ? <input type="hidden" name="scheduled_date" value={scheduledDate} /> : null}
      <label className="group flex h-10 items-center gap-2.5 rounded-lg border border-transparent px-2 text-sm transition-colors focus-within:border-line focus-within:bg-surface hover:bg-surface">
        <Plus className="h-4 w-4 text-faint group-focus-within:text-accent" aria-hidden />
        <span className="sr-only">Nueva tarea</span>
        <input
          ref={input}
          name="title"
          required
          maxLength={200}
          disabled={pending}
          placeholder={placeholder}
          className="h-full flex-1 bg-transparent text-fg placeholder:text-faint focus:outline-none"
          autoComplete="off"
        />
        <CornerDownLeft className="h-3.5 w-3.5 text-faint opacity-0 group-focus-within:opacity-100" aria-hidden />
      </label>
      {state && !state.ok ? <p className="mt-1 px-2 text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
