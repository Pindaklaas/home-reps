import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
export type Priority = Enums["priority_level"];
export type GoalStatus = Enums["goal_status"];
export type GoalProgressMode = Enums["goal_progress_mode"];
export type ProjectStatus = Enums["project_status"];
export type TaskStatus = Enums["task_status"];
export type IdeaStatus = Enums["idea_status"];
export type DecisionStatus = Enums["decision_status"];
export type MemoryKind = Enums["memory_kind"];
export type ProposalStatus = Enums["proposal_status"];

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "muted";

export const PRIORITIES = ["critical", "high", "medium", "low"] as const satisfies readonly Priority[];
export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};
export const PRIORITY_TONE: Record<Priority, Tone> = {
  critical: "danger",
  high: "warning",
  medium: "neutral",
  low: "muted",
};
export const PRIORITY_WEIGHT: Record<Priority, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export const GOAL_STATUSES = ["active", "paused", "completed", "archived"] as const satisfies readonly GoalStatus[];
export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  active: "Activo",
  paused: "Pausado",
  completed: "Completado",
  archived: "Archivado",
};
export const GOAL_STATUS_TONE: Record<GoalStatus, Tone> = {
  active: "accent",
  paused: "warning",
  completed: "success",
  archived: "muted",
};
export const GOAL_PROGRESS_MODE_LABEL: Record<GoalProgressMode, string> = {
  projects: "Según sus proyectos",
  metric: "Según la métrica",
  manual: "Manual",
};
export const GOAL_PROGRESS_MODES = ["projects", "metric", "manual"] as const satisfies readonly GoalProgressMode[];
export const GOAL_CATEGORIES = ["personal", "económico", "profesional", "salud", "aprendizaje", "relaciones"] as const;

export const PROJECT_STATUSES = [
  "idea",
  "planned",
  "active",
  "paused",
  "completed",
  "cancelled",
] as const satisfies readonly ProjectStatus[];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  idea: "Idea",
  planned: "Planificado",
  active: "Activo",
  paused: "Pausado",
  completed: "Completado",
  cancelled: "Cancelado",
};
export const PROJECT_STATUS_TONE: Record<ProjectStatus, Tone> = {
  idea: "muted",
  planned: "neutral",
  active: "accent",
  paused: "warning",
  completed: "success",
  cancelled: "muted",
};

export const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const satisfies readonly TaskStatus[];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada",
};
export const TASK_STATUS_TONE: Record<TaskStatus, Tone> = {
  pending: "neutral",
  in_progress: "accent",
  completed: "success",
  cancelled: "muted",
};

export const IDEA_STATUSES = [
  "new",
  "exploring",
  "validated",
  "converted",
  "parked",
  "discarded",
] as const satisfies readonly IdeaStatus[];
export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  new: "Nueva",
  exploring: "Explorando",
  validated: "Validada",
  converted: "Convertida en proyecto",
  parked: "Aparcada",
  discarded: "Descartada",
};
export const IDEA_STATUS_TONE: Record<IdeaStatus, Tone> = {
  new: "neutral",
  exploring: "accent",
  validated: "success",
  converted: "success",
  parked: "warning",
  discarded: "muted",
};
export const IDEA_CATEGORIES = ["negocio", "producto", "inversión", "contenido", "personal", "general"] as const;

export const DECISION_STATUSES = ["proposed", "approved", "rejected", "revisited"] as const satisfies readonly DecisionStatus[];
export const MEMORY_KINDS = ["fact", "preference", "idea", "recommendation", "decision", "summary"] as const satisfies readonly MemoryKind[];

export const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = {
  proposed: "Propuesta",
  approved: "Aprobada",
  rejected: "Rechazada",
  revisited: "Revisada",
};
export const DECISION_STATUS_TONE: Record<DecisionStatus, Tone> = {
  proposed: "warning",
  approved: "success",
  rejected: "muted",
  revisited: "neutral",
};

export const MEMORY_KIND_LABEL: Record<MemoryKind, string> = {
  fact: "Dato confirmado",
  preference: "Preferencia",
  idea: "Idea",
  recommendation: "Recomendación",
  decision: "Decisión",
  summary: "Resumen",
};

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  pending: "Pendiente de tu aprobación",
  approved: "Aprobada",
  rejected: "Rechazada",
  applied: "Aplicada",
  failed: "Error al aplicar",
};
