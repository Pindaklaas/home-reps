import { z } from "zod";

/**
 * Public configuration (safe in the browser). Next.js inlines NEXT_PUBLIC_*
 * at build time, so each variable must be referenced literally.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

const serverSchema = z.object({
  // The single account allowed into GOALS. Checked in the app on top of the
  // database allowlist used by RLS.
  OWNER_EMAIL: z.email().transform((v) => v.toLowerCase()),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-opus-5-5"),
  MAKE_WEBHOOK_URL: z.url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/** Server-only configuration. Never import this from a Client Component. */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not run in the browser");
  }
  if (!cached) {
    const blankToUndefined = (v: string | undefined) => (v && v.trim() !== "" ? v : undefined);
    cached = serverSchema.parse({
      OWNER_EMAIL: process.env.OWNER_EMAIL,
      ANTHROPIC_API_KEY: blankToUndefined(process.env.ANTHROPIC_API_KEY),
      ANTHROPIC_MODEL: blankToUndefined(process.env.ANTHROPIC_MODEL),
      MAKE_WEBHOOK_URL: blankToUndefined(process.env.MAKE_WEBHOOK_URL),
      GOOGLE_CLIENT_ID: blankToUndefined(process.env.GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET: blankToUndefined(process.env.GOOGLE_CLIENT_SECRET),
    });
  }
  return cached;
}
