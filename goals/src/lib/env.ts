import { z } from "zod";

/**
 * Public configuration (safe in the browser). Next.js inlines NEXT_PUBLIC_*
 * at build time, so each variable must be referenced literally.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  // Web Push public key (safe in the browser). Optional: without it push is off.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(20).optional(),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  // The legacy anon key works the same way (some Supabase integrations set only that name).
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
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
  // Web Push (server only).
  VAPID_PRIVATE_KEY: z.string().min(20).optional(),
  VAPID_SUBJECT: z.string().min(5).optional(),
  // Shared with the database dispatcher (app_private.settings.dispatch_secret).
  PUSH_DISPATCH_SECRET: z.string().min(32).optional(),
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
      VAPID_PRIVATE_KEY: blankToUndefined(process.env.VAPID_PRIVATE_KEY),
      VAPID_SUBJECT: blankToUndefined(process.env.VAPID_SUBJECT),
      PUSH_DISPATCH_SECRET: blankToUndefined(process.env.PUSH_DISPATCH_SECRET),
    });
  }
  return cached;
}
