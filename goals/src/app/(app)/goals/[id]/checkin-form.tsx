"use client";

import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Input } from "@/components/ui/field";
import { addGoalCheckin } from "@/lib/actions/goals";

export function CheckinForm({ goalId, unit, current }: { goalId: string; unit: string | null; current: number }) {
  return (
    <ActionForm action={addGoalCheckin} resetOnSuccess className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="goal_id" value={goalId} />
      <label className="sr-only" htmlFor="ck-value">
        Nuevo valor
      </label>
      <div className="flex items-center gap-2">
        <Input id="ck-value" name="value" type="number" step="any" required placeholder={String(current)} className="w-36" />
        {unit ? <span className="text-sm text-faint">{unit}</span> : null}
      </div>
      <label className="sr-only" htmlFor="ck-note">
        Nota
      </label>
      <Input id="ck-note" name="note" placeholder="Nota (opcional)" maxLength={1000} className="sm:flex-1" />
      <SubmitButton variant="secondary">Registrar valor</SubmitButton>
    </ActionForm>
  );
}
