"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Field, Textarea } from "@/components/ui/field";
import { updateProjectNotes } from "@/lib/actions/projects";

export function NotesEditor({ id, notes, outcomes }: { id: string; notes: string; outcomes: string }) {
  const [dirty, setDirty] = useState(false);
  return (
    <ActionForm action={updateProjectNotes} onSuccess={() => setDirty(false)} className="grid gap-4" showMessage>
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Notas" htmlFor="pn-notes" hint="Contexto, enlaces, aprendizajes.">
          <Textarea id="pn-notes" name="notes" rows={8} defaultValue={notes} onChange={() => setDirty(true)} maxLength={20000} />
        </Field>
        <Field label="Resultados" htmlFor="pn-out" hint="Qué se ha conseguido de verdad (cifras, entregables).">
          <Textarea id="pn-out" name="outcomes" rows={8} defaultValue={outcomes} onChange={() => setDirty(true)} maxLength={10000} />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        {dirty ? <span className="text-xs text-faint">Cambios sin guardar</span> : null}
        <SubmitButton variant="secondary" size="sm">
          Guardar notas
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
