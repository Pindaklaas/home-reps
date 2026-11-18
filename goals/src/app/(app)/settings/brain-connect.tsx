"use client";

import { CheckCircle2, CircleAlert, ExternalLink } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Input } from "@/components/ui/field";
import { saveBrainToken } from "@/lib/actions/brain";

type Status = { ready: boolean; connected: boolean; authError: boolean; lastFireAt: string | null };

/** Connects the in-app chat to the Claude Code scheduled task (paste its API token once). */
export function BrainConnect({ status }: { status: Status | null }) {
  if (!status?.ready) {
    return (
      <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
        Falta preparar la tarea de Claude en el servidor. Pídeselo a Claude Code: «conecta el chat de GOALS».
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {status.connected && !status.authError ? (
        <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" /> Conectado: escribe a Claude desde el chat y te contesta aquí.
        </p>
      ) : status.authError ? (
        <p className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
          <CircleAlert className="h-4 w-4" /> El código ya no funciona. Genera uno nuevo (paso 2) y pégalo otra vez.
        </p>
      ) : null}

      {!status.connected || status.authError ? (
        <ol className="flex flex-col gap-3 text-sm">
          <Step n={1}>
            Abre{" "}
            <a href="https://claude.ai/code/routines" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent underline">
              tus tareas de Claude <ExternalLink className="h-3 w-3" />
            </a>{" "}
            y entra en <b>«GOALS: responder en el chat»</b>.
          </Step>
          <Step n={2}>
            Pulsa <b>Editar</b> → en <b>Trigger</b> toca <b>+</b> → <b>API</b> → <b>Generate token</b>. Copia el código (solo se ve una vez).
          </Step>
          <Step n={3}>Pégalo aquí abajo y pulsa «Conectar».</Step>
        </ol>
      ) : null}

      <ActionForm action={saveBrainToken} resetOnSuccess className="flex flex-col gap-2">
        <label htmlFor="brain-token" className="text-[13px] font-medium text-muted">
          {status.connected ? "Cambiar el código" : "Código de la tarea"}
        </label>
        <div className="flex gap-2">
          <Input id="brain-token" name="token" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" className="min-w-0 flex-1" />
          <SubmitButton pendingLabel="Guardando…">{status.connected ? "Cambiar" : "Conectar"}</SubmitButton>
        </div>
        <p className="text-xs text-faint">Se guarda en tu base de datos privada y nunca se vuelve a mostrar. Déjalo vacío y pulsa para desconectar.</p>
      </ActionForm>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-fg">{n}</span>
      <span className="pt-0.5 text-fg">{children}</span>
    </li>
  );
}
