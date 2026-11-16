"use client";

import { useActionState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { ActionState } from "@/lib/validation";
import { cn } from "@/lib/cn";

/** A button that runs a Claude-backed Server Action and shows its outcome. */
export function AiButton({
  action,
  label,
  pendingLabel,
  disabled,
  fields,
  variant = "secondary",
  className,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  pendingLabel?: string;
  disabled?: boolean;
  fields?: Record<string, string>;
  variant?: "secondary" | "primary" | "ghost";
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      {fields ? Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
      <button
        type="submit"
        disabled={disabled || pending}
        title={disabled ? "Configura ANTHROPIC_API_KEY para usar Claude" : undefined}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium transition-colors disabled:opacity-50",
          variant === "primary" && "bg-accent text-accent-fg hover:brightness-110",
          variant === "secondary" && "border border-line bg-subtle text-fg hover:bg-hover",
          variant === "ghost" && "text-muted hover:bg-hover hover:text-fg",
        )}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className={cn("h-3.5 w-3.5", variant !== "primary" && "text-accent")} />}
        {pending ? pendingLabel ?? "Pensando…" : label}
      </button>
      {state && !state.ok ? <span className="text-xs text-danger">{state.error}</span> : null}
      {state?.ok && state.message ? <span className="text-xs text-success">{state.message}</span> : null}
    </form>
  );
}
