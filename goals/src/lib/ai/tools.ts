import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { PRIORITIES, PROJECT_STATUSES, TASK_STATUSES, GOAL_STATUSES } from "@/lib/constants";

/**
 * Claude's only write path: propose_* tools. Each call becomes a row in
 * ai_proposals with status "pending". Nothing is applied until the user
 * approves it in the UI (see lib/ai/proposals.ts).
 *
 * The input schemas below validate what the model sends (with eager input
 * streaming the API does not validate it for us). Ranges and lengths are
 * enforced again by the entity schemas when a proposal is applied.
 */

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha YYYY-MM-DD");
const rationale = z.string().min(1).max(2000).describe("Por qué propones este cambio, en una o dos frases");

export const toolInputSchemas = {
  propose_create_goal: z.strictObject({
    title: z.string().min(1).max(160),
    description: z.string().max(5000).nullable(),
    category: z.string().min(1).max(40),
    target_date: date.nullable(),
    priority: z.enum(PRIORITIES),
    metric_name: z.string().max(80).nullable(),
    metric_unit: z.string().max(20).nullable(),
    metric_target: z.number().nullable(),
    rationale,
  }),
  propose_create_project: z.strictObject({
    title: z.string().min(1).max(160),
    description: z.string().max(5000).nullable(),
    goal_id: z.uuid().nullable(),
    status: z.enum(["idea", "planned", "active"]),
    priority: z.enum(PRIORITIES),
    due_date: date.nullable(),
    rationale,
  }),
  propose_create_tasks: z.strictObject({
    tasks: z
      .array(
        z.strictObject({
          title: z.string().min(1).max(200),
          description: z.string().max(5000).nullable(),
          project_id: z.uuid().nullable(),
          priority: z.enum(PRIORITIES),
          due_date: date.nullable(),
          scheduled_date: date.nullable(),
          estimated_minutes: z.number().int().min(0).max(10000).nullable(),
        }),
      )
      .min(1)
      .max(15),
    rationale,
  }),
  propose_update: z.strictObject({
    entity: z.enum(["goal", "project", "task"]),
    id: z.uuid(),
    changes: z.strictObject({
      title: z.string().min(1).max(200).nullable(),
      description: z.string().max(5000).nullable(),
      status: z.string().nullable(),
      priority: z.enum(PRIORITIES).nullable(),
      due_date: date.nullable(),
      scheduled_date: date.nullable(),
    }),
    rationale,
  }),
  propose_create_idea: z.strictObject({
    title: z.string().min(1).max(160),
    description: z.string().max(10000).nullable(),
    category: z.string().min(1).max(40),
    rationale,
  }),
  propose_record_decision: z.strictObject({
    title: z.string().min(1).max(200),
    context: z.string().max(10000).nullable(),
    options: z.array(z.string().min(1).max(300)).max(10),
    decision: z.string().max(5000),
    rationale,
  }),
  propose_save_memory: z.strictObject({
    kind: z.enum(["fact", "preference", "idea", "recommendation", "decision"]),
    content: z.string().min(1).max(4000),
    rationale,
  }),
} as const;

export type ToolName = keyof typeof toolInputSchemas;
export const TOOL_NAMES = Object.keys(toolInputSchemas) as ToolName[];

const DESCRIPTIONS: Record<ToolName, string> = {
  propose_create_goal:
    "Propone crear un objetivo nuevo. Queda pendiente de aprobación del usuario; no se crea hasta que lo apruebe.",
  propose_create_project:
    "Propone crear un proyecto, opcionalmente vinculado a un objetivo existente (goal_id del contexto). Queda pendiente de aprobación.",
  propose_create_tasks:
    "Propone crear una o varias tareas (máx. 15), por ejemplo al dividir un objetivo o proyecto en pasos. Cada tarea se aprueba por separado. Usa project_id exactos del contexto o null.",
  propose_update:
    "Propone cambiar campos de un objetivo, proyecto o tarea existente (id exacto del contexto). En changes, pon null en los campos que NO cambian. Estados válidos: objetivo active|paused|completed|archived; proyecto idea|planned|active|paused|completed|cancelled; tarea pending|in_progress|completed|cancelled. Proponer «completed» solo si el usuario dice que ya está hecho.",
  propose_create_idea: "Propone guardar una idea en el Ideas Vault.",
  propose_record_decision:
    "Propone registrar una decisión en el registro de decisiones (con contexto, opciones consideradas y la decisión). El usuario la aprueba o rechaza.",
  propose_save_memory:
    "Propone guardar un recuerdo a largo plazo: fact (dato del usuario que él te ha dicho), preference, idea, recommendation (tu consejo) o decision. Solo información útil a futuro; nunca supuestos.",
};

/** JSON Schema without the keywords the tool-input schema dialect doesn't need. */
function toInputSchema(schema: z.ZodType): Anthropic.Beta.BetaTool.InputSchema {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }) as Record<string, unknown>;
  delete json.$schema;
  return json as Anthropic.Beta.BetaTool.InputSchema;
}

export const PROPOSAL_TOOLS: Anthropic.Beta.BetaTool[] = TOOL_NAMES.map((name) => ({
  name,
  description: DESCRIPTIONS[name],
  input_schema: toInputSchema(toolInputSchemas[name]),
  // Streamed requests with client tools: send input fragments as generated.
  // The API then skips its own validation, so every input is parsed with the
  // zod schema above before anything is stored.
  eager_input_streaming: true,
}));

/** Statuses allowed for propose_update, per entity. */
export const UPDATE_STATUSES = {
  goal: GOAL_STATUSES,
  project: PROJECT_STATUSES,
  task: TASK_STATUSES,
} as const;

/** Where the applied entity can be seen in the app. */
export function proposalHref(action: string, entityId: string | null): string | null {
  if (!entityId) return null;
  if (action.endsWith("_goal")) return `/goals/${entityId}`;
  if (action.endsWith("_project")) return `/projects/${entityId}`;
  if (action.endsWith("_task")) return `/tasks`;
  if (action === "create_idea") return `/ideas`;
  if (action === "record_decision" || action === "save_memory") return `/brain/memory`;
  return null;
}
