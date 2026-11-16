"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, PendingContext, SubmitButton, useFormAction } from "@/components/ui/forms";
import { sendMagicLink, signInWithPassword } from "./actions";

const ERRORS: Record<string, string> = {
  unauthorized: "Tu sesión no es válida o ha caducado. Vuelve a entrar.",
  link: "El enlace de acceso no es válido o ha caducado.",
};

export function LoginForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [pwState, pwSubmit, pwPending] = useFormAction(signInWithPassword);
  const [mlState, mlSubmit, mlPending] = useFormAction(sendMagicLink);
  const urlError = ERRORS[params.get("error") ?? ""];
  const next = params.get("next") ?? "/";

  return (
    <div className="w-full">
      {urlError && !pwState && !mlState ? (
        <p className="mb-4 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning" role="alert">
          {urlError}
        </p>
      ) : null}

      {mode === "password" ? (
        <PendingContext value={pwPending}>
        <form onSubmit={pwSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </Field>
          <Field label="Contraseña" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <FormMessage state={pwState} />
          <SubmitButton className="w-full" pendingLabel="Entrando…">
            Entrar
          </SubmitButton>
        </form>
        </PendingContext>
      ) : (
        <PendingContext value={mlPending}>
        <form onSubmit={mlSubmit} className="flex flex-col gap-4">
          <Field label="Email" htmlFor="email-magic" hint="Te enviaremos un enlace de un solo uso.">
            <Input id="email-magic" name="email" type="email" autoComplete="username" required autoFocus />
          </Field>
          <FormMessage state={mlState} />
          <SubmitButton className="w-full" pendingLabel="Enviando…">
            Enviar enlace de acceso
          </SubmitButton>
        </form>
        </PendingContext>
      )}

      <button
        type="button"
        onClick={() => setMode(mode === "password" ? "magic" : "password")}
        className="mt-5 w-full text-center text-[13px] text-muted transition-colors hover:text-fg"
      >
        {mode === "password" ? "Entrar con un enlace por email" : "Entrar con contraseña"}
      </button>
    </div>
  );
}
