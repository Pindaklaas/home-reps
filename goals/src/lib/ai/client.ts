import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";

/** True when an API key is configured. The key itself never leaves the server. */
export function aiConfigured(): boolean {
  return Boolean(serverEnv().ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  const key = serverEnv().ANTHROPIC_API_KEY;
  if (!key) throw new AiNotConfiguredError();
  client ??= new Anthropic({ apiKey: key, maxRetries: 2 });
  return client;
}

export function aiModel(): string {
  return serverEnv().ANTHROPIC_MODEL;
}

/**
 * Server-side refusal fallback: if the model declines for policy reasons, the
 * API retries on Anthropic's recommended fallback model in the same call.
 */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01" as const;

export class AiNotConfiguredError extends Error {
  constructor() {
    super("Claude no está configurado. Añade ANTHROPIC_API_KEY en las variables de entorno del servidor.");
  }
}

/** Human-readable message for an Anthropic API failure. */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof AiNotConfiguredError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return "La clave de la API de Anthropic no es válida.";
  if (e instanceof Anthropic.PermissionDeniedError) return "La clave de la API no tiene permiso para este modelo.";
  if (e instanceof Anthropic.RateLimitError) return "Límite de uso de Claude alcanzado. Espera un momento y vuelve a intentarlo.";
  if (e instanceof Anthropic.BadRequestError) return "Claude rechazó la petición (petición no válida).";
  if (e instanceof Anthropic.InternalServerError) return "Claude no está disponible ahora mismo. Inténtalo en unos minutos.";
  if (e instanceof Anthropic.APIConnectionError) return "No se pudo conectar con Claude.";
  if (e instanceof Anthropic.APIError) return `Error de Claude (${e.status ?? "?"}).`;
  return "Error inesperado al hablar con Claude.";
}
