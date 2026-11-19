import { z } from "zod";

/**
 * Schemas for Claude's structured outputs. They are sent to the API as the
 * output format (so the model must follow them) and validated again on our side
 * before anything is stored or shown.
 */

export const ideaEvaluationSchema = z.object({
  verdict: z.enum(["pursue", "explore", "park", "discard"]).describe(
    "pursue = convertir en proyecto ya; explore = validar antes; park = aparcar; discard = descartar",
  ),
  score: z.number().int().min(0).max(100).describe("Atractivo global 0-100 teniendo en cuenta potencial, esfuerzo, coste y encaje con los objetivos"),
  summary: z.string().describe("Dos o tres frases con la conclusión"),
  fit_with_goals: z.string().describe("Cómo encaja (o no) con los objetivos activos del usuario"),
  strengths: z.array(z.string()).describe("Puntos fuertes"),
  risks: z.array(z.string()).describe("Riesgos y supuestos sin validar"),
  next_steps: z.array(z.string()).describe("Pasos concretos y baratos para validar o empezar"),
  confidence: z.enum(["low", "medium", "high"]).describe("Confianza en la evaluación según la información disponible"),
  missing_information: z.array(z.string()).describe("Datos que faltan para evaluar mejor; vacío si no falta nada"),
});
export type IdeaEvaluation = z.infer<typeof ideaEvaluationSchema>;

export const dailyRecommendationSchema = z.object({
  headline: z.string().describe("Una frase: lo más importante que hacer hoy"),
  why: z.string().describe("Por qué, conectándolo con un objetivo concreto"),
  focus_task_ids: z.array(z.string()).describe("IDs de tareas existentes recomendadas para hoy (máximo 3), tomadas del contexto"),
  warnings: z.array(z.string()).describe("Contradicciones o riesgos detectados (tareas atrasadas, proyectos sin objetivo, dispersión...)"),
  avoid: z.string().describe("Una cosa concreta que conviene NO hacer hoy, o cadena vacía"),
});
export type DailyRecommendation = z.infer<typeof dailyRecommendationSchema>;

export const dayPlanSchema = z.object({
  summary: z.string().describe("Resumen del plan en una o dos frases"),
  priorities: z
    .array(
      z.object({
        task_id: z.string().describe("ID de una tarea existente del contexto"),
        reason: z.string(),
      }),
    )
    .describe("Hasta tres prioridades del día, en orden"),
  blocks: z
    .array(
      z.object({
        start: z.string().describe("Hora de inicio HH:MM"),
        minutes: z.number().int().min(5).max(480),
        task_id: z.string().nullable().describe("ID de tarea existente, o null para descansos/bloques genéricos"),
        label: z.string().describe("Qué se hace en este bloque"),
      }),
    )
    .describe("Bloques de tiempo realistas que no superen el tiempo disponible"),
  total_minutes: z.number().int().min(0),
  deferred_task_ids: z.array(z.string()).describe("Tareas que conviene mover a otro día"),
  notes: z.string().describe("Advertencias o consejos breves; cadena vacía si no hay"),
});
export type DayPlan = z.infer<typeof dayPlanSchema>;

export const weeklyReviewSchema = z.object({
  summary: z.string().describe("Resumen honesto de la semana en 3-5 frases basado solo en los datos"),
  wins: z.array(z.string()),
  misses: z.array(z.string()),
  patterns: z.array(z.string()).describe("Patrones o contradicciones entre objetivos y actividad"),
  focus_next_week: z.array(z.string()).describe("Hasta tres focos para la próxima semana"),
});
export type WeeklyReview = z.infer<typeof weeklyReviewSchema>;

export const VERDICT_LABEL: Record<IdeaEvaluation["verdict"], string> = {
  pursue: "Sí, adelante",
  explore: "Probar primero",
  park: "Más adelante",
  discard: "Mejor no",
};
export const VERDICT_TONE = { pursue: "success", explore: "accent", park: "warning", discard: "muted" } as const;
