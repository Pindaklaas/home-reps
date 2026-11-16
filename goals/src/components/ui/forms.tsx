"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { Loader2, X } from "lucide-react";
import type { ActionState } from "@/lib/validation";
import { Button } from "./button";
import { cn } from "@/lib/cn";

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

/**
 * Runs a Server Action from onSubmit instead of the form's `action` prop.
 * React resets a form after an `action` submission, which would wipe what the
 * user typed when validation fails; submitting this way keeps the values.
 */
export function useFormAction(action: FormAction) {
  const [state, dispatch, actionPending] = useActionState(action, null);
  const [transitionPending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(e.currentTarget, submitter);
    start(() => dispatch(formData));
  };
  return [state, onSubmit, actionPending || transitionPending] as const;
}

export { PendingContext };

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingLabel,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  pendingLabel?: string;
}) {
  const status = useFormStatus();
  const contextPending = useContext(PendingContext);
  const pending = status.pending || contextPending;
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={className} aria-busy={pending}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.ok) {
    return state.message ? (
      <p className="text-sm text-success" role="status">
        {state.message}
      </p>
    ) : null;
  }
  return (
    <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
      {state.error}
    </p>
  );
}

/**
 * A form bound to a Server Action with useActionState. Children may be a
 * function to read field errors.
 */
export function ActionForm({
  action,
  children,
  onSuccess,
  className,
  resetOnSuccess = false,
  showMessage = true,
}: {
  action: FormAction;
  children: ReactNode | ((state: ActionState) => ReactNode);
  onSuccess?: (state: Extract<ActionState, { ok: true }>) => void;
  className?: string;
  resetOnSuccess?: boolean;
  showMessage?: boolean;
}) {
  const [state, onSubmit, pending] = useFormAction(action);
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<ActionState>(null);

  useEffect(() => {
    if (state && state.ok && handled.current !== state) {
      handled.current = state;
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
    }
  }, [state, onSuccess, resetOnSuccess]);

  return (
    <PendingContext value={pending}>
      <form ref={formRef} onSubmit={onSubmit} className={className} noValidate aria-busy={pending}>
        {typeof children === "function" ? children(state) : children}
        {showMessage ? (
          <div className="mt-3 empty:hidden">
            <FormMessage state={state} />
          </div>
        ) : null}
      </form>
    </PendingContext>
  );
}

/** Modal dialog built on the native <dialog> element (focus trap and Esc for free). */
export function Modal({
  trigger,
  title,
  description,
  children,
  wide = false,
}: {
  trigger: (open: () => void) => ReactNode;
  title: string;
  description?: string;
  children: (close: () => void) => ReactNode;
  wide?: boolean;
}) {
  // The element lives in state (callback ref) so open/close can be handed to
  // render props without reading a ref during render.
  const [el, setEl] = useState<HTMLDialogElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const open = () => {
    setMounted(true);
    requestAnimationFrame(() => el?.showModal());
  };
  const close = () => {
    el?.close();
  };

  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const dialog = (
    <dialog
      ref={setEl}
      onClose={() => setMounted(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className={cn(
        "m-auto max-h-[92dvh] w-[calc(100%-24px)] overflow-hidden rounded-xl border border-line bg-elevated p-0 text-fg shadow-panel",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
      aria-label={title}
    >
      {mounted ? (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold">{title}</h2>
              {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={close}
              className="-mr-1 rounded-md p-1 text-faint hover:bg-hover hover:text-fg"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children(close)}</div>
        </div>
      ) : null}
    </dialog>
  );

  return (
    <>
      {trigger(open)}
      {/* Portalled so a modal opened from a menu or a list row is not clipped or unmounted by its parent. */}
      {isClient ? createPortal(dialog, document.body) : null}
    </>
  );
}

/** A small form with a single button, for row actions (complete, delete...). */
export function InlineAction({
  action,
  fields,
  children,
  confirm,
  className,
  title,
}: {
  action: FormAction;
  fields: Record<string, string>;
  children: ReactNode;
  confirm?: string;
  className?: string;
  title?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="inline-flex"
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={pending}
        // Icon-only buttons get their accessible name from title; text buttons keep their visible text.
        title={state && !state.ok ? state.error : title}
        className={cn("disabled:opacity-50", state && !state.ok && "text-danger", className)}
      >
        {children}
      </button>
    </form>
  );
}
