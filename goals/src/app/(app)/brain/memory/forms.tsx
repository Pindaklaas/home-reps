"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/forms";
import { createDecision, createMemory } from "@/lib/actions/memory";

export function MemoryDialog() {
  return (
    <Modal
      title="Añadir a la memoria"
      description="Algo que Claude debería saber siempre sobre ti."
      trigger={(open) => (
        <Button onClick={open}>
          <Plus className="h-4 w-4" /> Recuerdo
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={createMemory} onSuccess={close} className="grid gap-4">
          <Field label="Tipo" htmlFor="m-kind">
            <Select id="m-kind" name="kind" defaultValue="fact">
              <option value="fact">Dato sobre mí</option>
              <option value="preference">Preferencia</option>
              <option value="decision">Decisión tomada</option>
              <option value="idea">Idea</option>
            </Select>
          </Field>
          <Field label="Contenido" htmlFor="m-content">
            <Textarea id="m-content" name="content" rows={4} required maxLength={4000} placeholder="Ej. Trabajo por cuenta ajena hasta las 17:00; solo tengo tardes y fines de semana." />
          </Field>
          <div className="flex justify-end">
            <SubmitButton>Guardar</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Modal>
  );
}

export function DecisionDialog() {
  return (
    <Modal
      title="Registrar decisión"
      wide
      trigger={(open) => (
        <Button onClick={open}>
          <Plus className="h-4 w-4" /> Decisión
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={createDecision} onSuccess={close} className="grid gap-4">
          {(s) => (
            <>
              <Field label="Qué hay que decidir" htmlFor="d-title" error={s && !s.ok ? s.fieldErrors?.title : undefined}>
                <Input id="d-title" name="title" required maxLength={200} />
              </Field>
              <Field label="Contexto" htmlFor="d-context">
                <Textarea id="d-context" name="context" rows={3} />
              </Field>
              <div className="grid gap-2 sm:grid-cols-3">
                {[1, 2, 3].map((n) => (
                  <Field key={n} label={`Opción ${n}`} htmlFor={`d-opt-${n}`}>
                    <Input id={`d-opt-${n}`} name="options[]" maxLength={300} />
                  </Field>
                ))}
              </div>
              <Field label="Decisión" htmlFor="d-decision">
                <Textarea id="d-decision" name="decision" rows={2} />
              </Field>
              <Field label="Por qué" htmlFor="d-rationale">
                <Textarea id="d-rationale" name="rationale" rows={2} />
              </Field>
              <Field label="Estado" htmlFor="d-status">
                <Select id="d-status" name="status" defaultValue="approved">
                  <option value="approved">Aprobada (ya lo he decidido)</option>
                  <option value="proposed">Propuesta (aún lo estoy pensando)</option>
                </Select>
              </Field>
              <div className="flex justify-end">
                <SubmitButton>Registrar</SubmitButton>
              </div>
            </>
          )}
        </ActionForm>
      )}
    </Modal>
  );
}
