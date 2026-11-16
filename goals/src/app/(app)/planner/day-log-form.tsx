"use client";

import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { saveDailyLog } from "@/lib/actions/planner";
import type { DailyLog } from "@/lib/data";

export function DayLogForm({ date, log }: { date: string; log: DailyLog | null }) {
  return (
    <ActionForm action={saveDailyLog} className="grid gap-3" key={date}>
      <input type="hidden" name="log_date" value={date} />
      <Field label="Intención del día" htmlFor="dl-int">
        <Input id="dl-int" name="intention" defaultValue={log?.intention ?? ""} maxLength={1000} placeholder="Si solo hago una cosa, será…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Disponible (min)" htmlFor="dl-min">
          <Input id="dl-min" name="available_minutes" type="number" min={0} max={1440} step={15} defaultValue={log?.available_minutes ?? ""} inputMode="numeric" />
        </Field>
        <Field label="Energía" htmlFor="dl-energy">
          <Select id="dl-energy" name="energy" defaultValue={log?.energy ?? ""}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Resumen del día" htmlFor="dl-sum" hint="Qué salió bien, qué no, qué aprendiste.">
        <Textarea id="dl-sum" name="summary" rows={4} defaultValue={log?.summary ?? ""} maxLength={5000} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant="secondary" size="sm">
          Guardar
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
