"use client";

import { useActionState, useState, useTransition } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/ui/forms";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { changePassword, saveTheme, signOutEverywhere, updateAiSettings, updateProfile } from "@/lib/actions/settings";
import type { Profile } from "@/lib/data";
import { cn } from "@/lib/cn";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function fieldErr(s: unknown, k: string): string[] | undefined {
  const st = s as { ok?: boolean; fieldErrors?: Record<string, string[] | undefined> } | null;
  return st && st.ok === false ? st.fieldErrors?.[k] : undefined;
}

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [tz, setTz] = useState(profile?.timezone ?? "Europe/Madrid");
  return (
    <ActionForm action={updateProfile} className="grid gap-4">
      {(s) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="s-name">
              <Input id="s-name" name="display_name" defaultValue={profile?.display_name ?? ""} maxLength={80} />
            </Field>
            <Field label="Zona horaria" htmlFor="s-tz" error={fieldErr(s, "timezone")} hint={<button type="button" className="text-accent hover:underline" onClick={() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone)}>Usar la de este dispositivo</button>}>
              <Input id="s-tz" name="timezone" value={tz} onChange={(e) => setTz(e.target.value)} placeholder="Europe/Madrid" />
            </Field>
            <Field label="Capacidad diaria (min)" htmlFor="s-cap" hint="Tiempo que puedes dedicar a tus metas un día normal." error={fieldErr(s, "daily_capacity_minutes")}>
              <Input id="s-cap" name="daily_capacity_minutes" type="number" min={0} max={1440} step={15} defaultValue={profile?.daily_capacity_minutes ?? 360} />
            </Field>
            <Field label="La semana empieza en" htmlFor="s-week">
              <Select id="s-week" name="week_starts_on" defaultValue={profile?.week_starts_on ?? 1}>
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <input type="hidden" name="theme" value={profile?.theme ?? "dark"} />
          <div className="flex justify-end">
            <SubmitButton variant="secondary">Guardar perfil</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

type Theme = "dark" | "light" | "system";

function applyTheme(t: Theme) {
  try {
    localStorage.setItem("goals.theme", t);
  } catch {
    // Private mode: the theme still applies for this page view.
  }
  const resolved = t === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : t;
  document.documentElement.dataset.theme = resolved;
}

export function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [, startTransition] = useTransition();

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "dark", label: "Oscuro", icon: Moon },
    { value: "light", label: "Claro", icon: Sun },
    { value: "system", label: "Sistema", icon: Monitor },
  ];

  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex rounded-lg border border-line bg-bg p-1">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => {
            setTheme(value);
            applyTheme(value);
            // Persist on the profile too; the device setting already applied.
            startTransition(() => {
              void saveTheme(value);
            });
          }}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors",
            theme === value ? "bg-hover text-fg" : "text-muted hover:text-fg",
          )}
        >
          <Icon className="h-3.5 w-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}

export function AiSettingsForm({ profile }: { profile: Profile | null }) {
  return (
    <ActionForm action={updateAiSettings} className="grid gap-4">
      <div className="flex flex-col gap-3">
        <Checkbox name="ai_enabled" defaultChecked={profile?.ai_enabled ?? true} label="Activar Claude en GOALS" />
        <Checkbox name="ai_include_context" defaultChecked={profile?.ai_include_context ?? true} label="Enviar el contexto de mis datos en el chat (recomendado)" />
      </div>
      <Field label="Profundidad de análisis" htmlFor="ai-effort" hint="Más profundidad = respuestas más pensadas, más lentas y con más coste.">
        <Select id="ai-effort" name="ai_effort" defaultValue={profile?.ai_effort ?? "medium"} className="sm:w-64">
          <option value="low">Rápida</option>
          <option value="medium">Equilibrada</option>
          <option value="high">Profunda</option>
        </Select>
      </Field>
      <Field label="Instrucciones personales" htmlFor="ai-instr" hint="Cómo quieres que Claude te hable o qué debe tener siempre en cuenta.">
        <Textarea id="ai-instr" name="ai_instructions" rows={4} maxLength={4000} defaultValue={profile?.ai_instructions ?? ""} placeholder="Ej. Sé directo. Mi prioridad este año es la independencia financiera. No me propongas más de 3 proyectos activos." />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant="secondary">Guardar</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AccountForms() {
  const [globalState, globalAction, pending] = useActionState(signOutEverywhere, null);
  return (
    <div className="grid gap-8">
      <ActionForm action={changePassword} resetOnSuccess className="grid gap-4">
        {(s) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nueva contraseña" htmlFor="pw-new" error={fieldErr(s, "password")}>
                <Input id="pw-new" name="password" type="password" autoComplete="new-password" minLength={12} required />
              </Field>
              <Field label="Repítela" htmlFor="pw-confirm" error={fieldErr(s, "confirm")}>
                <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required />
              </Field>
            </div>
            <div className="flex justify-end">
              <SubmitButton variant="secondary">Cambiar contraseña</SubmitButton>
            </div>
          </>
        )}
      </ActionForm>
      <form action={globalAction} className="flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted">Cierra la sesión en todos tus dispositivos (útil si perdiste uno).</p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 shrink-0 items-center rounded-md bg-danger-soft px-3.5 text-sm font-medium text-danger disabled:opacity-50"
        >
          Cerrar todas las sesiones
        </button>
        <FormMessage state={globalState} />
      </form>
    </div>
  );
}
