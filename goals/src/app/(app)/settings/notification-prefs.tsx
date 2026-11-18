"use client";

import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { saveNotificationPrefs } from "@/lib/actions/notifications";
import type { Profile } from "@/lib/data";

const KINDS: { key: string; label: string; hint: string }[] = [
  { key: "briefing", label: "Resumen del día", hint: "Al salir del instituto (o a las 9:30 los días libres): qué toca hoy." },
  { key: "overdue", label: "¿Lo hiciste?", hint: "Si una tarea con hora lleva 30 min sin marcarse." },
  { key: "deadline", label: "Fechas límite", hint: "Lo que vence mañana y lo que ya está vencido." },
  { key: "proposals", label: "Propuestas de Claude", hint: "Si llevan horas sin revisar." },
  { key: "goal", label: "Meta principal", hint: "Actualizar tus ingresos y el ritmo semanal (domingos)." },
  { key: "inactivity", label: "Sin avanzar", hint: "Si pasas 2 días sin completar nada." },
  { key: "evening", label: "Cierre del día", hint: "A las 21:00: hechas, pendientes y qué toca mañana." },
];
const DAYS = ["D", "L", "M", "X", "J", "V", "S"];

type Block = { days: number[]; start: string; end: string; label?: string };

export function NotificationPrefs({ profile }: { profile: Profile | null }) {
  const prefs = (profile?.notify_prefs ?? {}) as Record<string, boolean>;
  const block = ((profile?.busy_blocks ?? []) as Block[])[0];
  return (
    <ActionForm action={saveNotificationPrefs} className="mt-6 grid gap-5 border-t border-line pt-5">
      <fieldset className="grid gap-2.5">
        <legend className="mb-2 text-[13px] font-medium text-muted">Avisos automáticos</legend>
        {KINDS.map((k) => (
          <div key={k.key}>
            <Checkbox name={`notify_${k.key}`} defaultChecked={prefs[k.key] ?? true} label={k.label} />
            <p className="ml-6 text-xs text-faint">{k.hint}</p>
          </div>
        ))}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-[13px] font-medium text-muted">No molestar</legend>
        <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
          <Field label="Desde" htmlFor="q-start">
            <Input id="q-start" name="quiet_start" type="time" defaultValue={profile?.quiet_start?.slice(0, 5) ?? "22:30"} />
          </Field>
          <Field label="Hasta" htmlFor="q-end">
            <Input id="q-end" name="quiet_end" type="time" defaultValue={profile?.quiet_end?.slice(0, 5) ?? "08:00"} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-[13px] font-medium text-muted">Horario ocupado (sin avisos automáticos ni tareas de Claude)</legend>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días">
          {DAYS.map((d, i) => (
            <label key={i} className="cursor-pointer">
              <input type="checkbox" name="busy_days" value={i} defaultChecked={block?.days.includes(i) ?? false} className="peer sr-only" />
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-xs text-muted peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                {d}
              </span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          <Field label="Qué" htmlFor="b-label">
            <Input id="b-label" name="busy_label" defaultValue={block?.label ?? "Instituto"} maxLength={40} />
          </Field>
          <Field label="Desde" htmlFor="b-start">
            <Input id="b-start" name="busy_start" type="time" defaultValue={block?.start ?? ""} />
          </Field>
          <Field label="Hasta" htmlFor="b-end">
            <Input id="b-end" name="busy_end" type="time" defaultValue={block?.end ?? ""} />
          </Field>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <SubmitButton variant="secondary">Guardar avisos</SubmitButton>
      </div>
    </ActionForm>
  );
}
