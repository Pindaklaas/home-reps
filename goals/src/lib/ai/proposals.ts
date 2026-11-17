import "server-only";
import { z } from "zod";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import { decisionSchema, goalSchema, ideaSchema, projectSchema, taskSchema } from "@/lib/validation";
import { PRIORITIES } from "@/lib/constants";
import { toolInputSchemas, UPDATE_STATUSES, type ToolName } from "./tools";

type ProposalInsert = TablesInsert<"ai_proposals">;
type Action = ProposalInsert["action"];

/**
 * Turns one validated tool call into proposal rows (create_tasks fans out into
 * one row per task, so each can be approved on its own).
 */
export function proposalsFromToolCall(
  name: ToolName,
  input: unknown,
): { ok: true; rows: Omit<ProposalInsert, "user_id">[] } | { ok: false; error: string } {
  const schema = toolInputSchemas[name];
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const data = parsed.data as Record<string, unknown> & { rationale: string };
  const row = (action: Action, payload: unknown, summary: string, target_id: string | null = null) => ({
    action,
    payload: payload as NonNullable<Json>,
    summary: summary.slice(0, 300),
    rationale: data.rationale,
    target_id,
  });

  switch (name) {
    case "propose_create_goal": {
      const { rationale: _r, ...goal } = data as z.infer<(typeof toolInputSchemas)["propose_create_goal"]>;
      void _r;
      return { ok: true, rows: [row("create_goal", goal, `Crear objetivo «${goal.title}»`)] };
    }
    case "propose_create_project": {
      const { rationale: _r, ...project } = data as z.infer<(typeof toolInputSchemas)["propose_create_project"]>;
      void _r;
      return { ok: true, rows: [row("create_project", project, `Crear proyecto «${project.title}»`)] };
    }
    case "propose_create_tasks": {
      const d = data as z.infer<(typeof toolInputSchemas)["propose_create_tasks"]>;
      return { ok: true, rows: d.tasks.map((t) => row("create_task", t, `Crear tarea «${t.title}»`)) };
    }
    case "propose_update": {
      const d = data as z.infer<(typeof toolInputSchemas)["propose_update"]>;
      const changes = Object.fromEntries(Object.entries(d.changes).filter(([, v]) => v !== null));
      if (!Object.keys(changes).length) return { ok: false, error: "changes: no hay ningún campo que cambiar" };
      if (changes.status && !(UPDATE_STATUSES[d.entity] as readonly string[]).includes(changes.status as string)) {
        return { ok: false, error: `changes.status: estado no válido para ${d.entity}` };
      }
      const label = { goal: "objetivo", project: "proyecto", task: "tarea" }[d.entity];
      const what = Object.keys(changes).join(", ");
      return {
        ok: true,
        rows: [row(`update_${d.entity}` as Action, { entity: d.entity, changes }, `Actualizar ${label}: ${what}`, d.id)],
      };
    }
    case "propose_create_idea": {
      const { rationale: _r, ...idea } = data as z.infer<(typeof toolInputSchemas)["propose_create_idea"]>;
      void _r;
      return { ok: true, rows: [row("create_idea", idea, `Guardar idea «${idea.title}»`)] };
    }
    case "propose_record_decision": {
      const d = data as z.infer<(typeof toolInputSchemas)["propose_record_decision"]>;
      return {
        ok: true,
        rows: [row("record_decision", { title: d.title, context: d.context, options: d.options, decision: d.decision, rationale: d.rationale }, `Registrar decisión «${d.title}»`)],
      };
    }
    case "propose_save_memory": {
      const d = data as z.infer<(typeof toolInputSchemas)["propose_save_memory"]>;
      return { ok: true, rows: [row("save_memory", { kind: d.kind, content: d.content }, `Recordar: ${d.content.slice(0, 120)}`)] };
    }
  }
}

const updateChanges = {
  goal: z.strictObject({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().max(5000).optional(),
    status: z.enum(UPDATE_STATUSES.goal).optional(),
    priority: z.enum(PRIORITIES).optional(),
    due_date: z.iso.date().optional(),
  }),
  project: z.strictObject({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().max(5000).optional(),
    status: z.enum(UPDATE_STATUSES.project).optional(),
    priority: z.enum(PRIORITIES).optional(),
    due_date: z.iso.date().optional(),
  }),
  task: z.strictObject({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    status: z.enum(UPDATE_STATUSES.task).optional(),
    priority: z.enum(PRIORITIES).optional(),
    due_date: z.iso.date().optional(),
    scheduled_date: z.iso.date().optional(),
    scheduled_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    remind_before_minutes: z.number().int().min(0).max(1440).optional(),
  }),
};

export class ProposalError extends Error {}

function ensure<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new ProposalError(res.error.message);
  if (res.data === null || res.data === undefined) throw new ProposalError("No se pudo guardar");
  return res.data as NonNullable<T>;
}

/**
 * Applies an approved proposal as the signed-in user (RLS applies). The payload
 * is validated again with the same schemas the forms use. Returns the id of
 * the created or updated row.
 */
export async function applyProposal(supabase: ServerSupabase, p: Tables<"ai_proposals">): Promise<string> {
  const payload = (p.payload ?? {}) as Record<string, unknown>;
  const parse = <S extends z.ZodType>(schema: S, value: unknown): z.infer<S> => {
    const r = schema.safeParse(value);
    if (!r.success) throw new ProposalError(`Datos no válidos: ${r.error.issues[0]?.message ?? "revisa la propuesta"}`);
    return r.data;
  };

  switch (p.action) {
    case "create_goal": {
      const g = parse(goalSchema, {
        ...payload,
        progress_mode: payload.metric_target !== null && payload.metric_target !== undefined && payload.metric_name ? "metric" : "projects",
        is_primary: false,
        status: "active",
      });
      return ensure(await supabase.from("goals").insert(g).select("id").single()).id;
    }
    case "create_project": {
      const pr = parse(projectSchema, payload);
      return ensure(await supabase.from("projects").insert(pr).select("id").single()).id;
    }
    case "create_task": {
      const t = parse(taskSchema, payload);
      return ensure(await supabase.from("tasks").insert(t).select("id").single()).id;
    }
    case "create_idea": {
      const i = parse(ideaSchema, payload);
      return ensure(await supabase.from("ideas").insert(i).select("id").single()).id;
    }
    case "record_decision": {
      const d = parse(decisionSchema, { ...payload, status: "approved" });
      return ensure(await supabase.from("decisions").insert({ ...d, source: "ai" }).select("id").single()).id;
    }
    case "save_memory": {
      const m = parse(
        z.object({ kind: z.enum(["fact", "preference", "idea", "recommendation", "decision"]), content: z.string().trim().min(1).max(4000) }),
        payload,
      );
      // Approving it is the user's confirmation, except for ideas and
      // recommendations, which stay what they are.
      const confirmed = m.kind === "fact" || m.kind === "preference" || m.kind === "decision";
      return ensure(await supabase.from("ai_memory").insert({ ...m, confirmed, source: "ai" }).select("id").single()).id;
    }
    case "update_goal":
    case "update_project":
    case "update_task": {
      if (!p.target_id) throw new ProposalError("Falta el elemento a actualizar");
      const entity = p.action.replace("update_", "") as "goal" | "project" | "task";
      const changes = parse(updateChanges[entity], payload.changes) as Record<string, unknown>;
      const patch =
        entity === "goal" && "due_date" in changes
          ? { ...Object.fromEntries(Object.entries(changes).filter(([k]) => k !== "due_date")), target_date: changes.due_date }
          : changes;
      const res =
        entity === "goal"
          ? await supabase.from("goals").update(patch as TablesUpdate<"goals">).eq("id", p.target_id).select("id")
          : entity === "project"
            ? await supabase.from("projects").update(patch as TablesUpdate<"projects">).eq("id", p.target_id).select("id")
            : await supabase.from("tasks").update(patch as TablesUpdate<"tasks">).eq("id", p.target_id).select("id");
      const rows = ensure(res);
      if (!rows.length) throw new ProposalError("El elemento ya no existe");
      return p.target_id;
    }
    default:
      throw new ProposalError(`Acción desconocida: ${p.action}`);
  }
}
