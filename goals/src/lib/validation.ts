import { z } from "zod";
import {
  DECISION_STATUSES,
  GOAL_PROGRESS_MODES,
  GOAL_STATUSES,
  IDEA_STATUSES,
  MEMORY_KINDS,
  PRIORITIES,
  PROJECT_STATUSES,
  TASK_STATUSES,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Primitives. Forms send "" for empty fields; these turn that into null.
// ---------------------------------------------------------------------------
const blank = (v: unknown) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v);

const text = (max: number) =>
  z.preprocess(blank, z.string().trim().max(max, `Máximo ${max} caracteres`).nullable());
const requiredText = (max: number, label = "Este campo") =>
  z.string().trim().min(1, `${label} es obligatorio`).max(max, `Máximo ${max} caracteres`);
const isoDate = z.preprocess(
  blank,
  z.iso.date({ error: "Fecha no válida" }).nullable(),
);
const optionalInt = (min: number, max: number) =>
  z.preprocess(blank, z.coerce.number().int().min(min).max(max).nullable());
const optionalNumber = z.preprocess(blank, z.coerce.number().finite().nullable());
/** "HH:MM" (24 h) or null. */
const timeOfDay = z.preprocess(
  blank,
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Hora no válida (HH:MM)").transform((v) => v.slice(0, 5)).nullable(),
);
const uuidOrNull = z.preprocess(blank, z.uuid().nullable());
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const prioritySchema = z.enum(PRIORITIES);

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------
export const goalSchema = z
  .object({
    title: requiredText(160, "El nombre"),
    description: text(5000),
    category: z.string().trim().min(1).max(40).default("personal"),
    target_date: isoDate,
    priority: prioritySchema.default("medium"),
    status: z.enum(GOAL_STATUSES).default("active"),
    is_primary: checkbox.default(false),
    progress_mode: z.enum(GOAL_PROGRESS_MODES).default("projects"),
    manual_progress: z.preprocess(blank, z.coerce.number().min(0).max(100).nullable()).transform((v) => v ?? 0),
    metric_name: text(80),
    metric_unit: text(20),
    metric_start: optionalNumber.transform((v) => v ?? 0),
    metric_target: optionalNumber,
  })
  .refine((g) => g.progress_mode !== "metric" || (g.metric_target !== null && g.metric_target !== g.metric_start), {
    message: "Para medir por métrica indica un objetivo distinto del valor inicial",
    path: ["metric_target"],
  });
export type GoalInput = z.infer<typeof goalSchema>;

export const goalCheckinSchema = z.object({
  goal_id: z.uuid(),
  value: z.coerce.number().finite(),
  note: text(1000),
});

export const projectSchema = z.object({
  title: requiredText(160, "El nombre"),
  description: text(5000),
  goal_id: uuidOrNull,
  status: z.enum(PROJECT_STATUSES).default("planned"),
  priority: prioritySchema.default("medium"),
  due_date: isoDate,
  notes: text(20000),
  outcomes: text(10000),
});
export type ProjectInput = z.infer<typeof projectSchema>;

export const taskSchema = z.object({
  title: requiredText(200, "El nombre"),
  description: text(5000),
  project_id: uuidOrNull,
  priority: prioritySchema.default("medium"),
  status: z.enum(TASK_STATUSES).default("pending"),
  due_date: isoDate,
  scheduled_date: isoDate,
  scheduled_time: timeOfDay,
  remind_before_minutes: z.preprocess(blank, z.coerce.number().int().min(0).max(1440).nullable()).transform((v) => v ?? 0),
  estimated_minutes: optionalInt(0, 10000),
}).refine((t) => !t.scheduled_time || t.scheduled_date, {
  message: "Para poner hora, elige también el día",
  path: ["scheduled_time"],
});
export type TaskInput = z.infer<typeof taskSchema>;

export const timeEntrySchema = z.object({
  task_id: z.uuid(),
  minutes: z.coerce.number().int().min(1, "Mínimo 1 minuto").max(1440, "Máximo 24 h"),
  note: text(500),
});

export const ideaSchema = z.object({
  title: requiredText(160, "El título"),
  description: text(10000),
  category: z.string().trim().min(1).max(40).default("general"),
  potential: optionalInt(1, 5),
  difficulty: optionalInt(1, 5),
  estimated_cost: z.preprocess(blank, z.coerce.number().min(0).max(9_999_999_999).nullable()),
  status: z.enum(IDEA_STATUSES).default("new"),
});
export type IdeaInput = z.infer<typeof ideaSchema>;

export const decisionSchema = z.object({
  title: requiredText(200, "El título"),
  context: text(10000),
  decision: text(5000),
  rationale: text(10000),
  options: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  status: z.enum(DECISION_STATUSES).default("proposed"),
  goal_id: uuidOrNull.optional(),
  project_id: uuidOrNull.optional(),
  idea_id: uuidOrNull.optional(),
  review_on: isoDate.optional(),
});
export type DecisionInput = z.infer<typeof decisionSchema>;

export const memorySchema = z.object({
  kind: z.enum(MEMORY_KINDS),
  content: requiredText(4000, "El contenido"),
  confirmed: checkbox.default(false),
  pinned: checkbox.default(false),
});

export const dailyLogSchema = z.object({
  log_date: z.iso.date(),
  intention: text(1000),
  available_minutes: optionalInt(0, 1440),
  energy: optionalInt(1, 5),
  summary: text(5000),
});

export const profileSchema = z.object({
  display_name: text(80),
  timezone: z.string().trim().min(1).max(64).refine(isValidTimeZone, "Zona horaria no válida"),
  daily_capacity_minutes: z.coerce.number().int().min(0).max(1440),
  week_starts_on: z.coerce.number().int().min(0).max(6),
  theme: z.enum(["dark", "light", "system"]),
});

export const aiSettingsSchema = z.object({
  ai_enabled: checkbox,
  ai_effort: z.enum(["low", "medium", "high"]),
  ai_include_context: checkbox,
  ai_instructions: text(4000),
});

function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers for Server Actions
// ---------------------------------------------------------------------------
export type FieldErrors = Record<string, string[] | undefined>;
export type ActionState =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors }
  | null;

export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (typeof value !== "string") continue;
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      (out[k] as string[] | undefined) ??= [];
      if (value.trim()) (out[k] as string[]).push(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function validationError(error: z.ZodError): Extract<ActionState, { ok: false }> {
  const flat = z.flattenError(error) as { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> };
  const first = Object.values(flat.fieldErrors).flat()[0] ?? flat.formErrors[0];
  return {
    ok: false,
    error: first ?? "Revisa los datos del formulario",
    fieldErrors: flat.fieldErrors,
  };
}
