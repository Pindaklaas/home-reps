import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string };

/**
 * Data Access Layer entry point. Verifies the session JWT (getClaims checks the
 * signature and expiry) and that the account is the configured owner.
 * Returns null for anonymous visitors and for any other account.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Session checks compare the JWT expiry with the current time, so they must
  // run at request time, never in a prerender or a prefetch.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const email = String(data.claims.email ?? "").toLowerCase();
  if (!email || email !== serverEnv().OWNER_EMAIL) return null;

  return { id: data.claims.sub, email };
});

/** For pages and layouts: redirects to /login when there is no owner session. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?error=unauthorized");
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("No autorizado");
  }
}

/** For Server Actions and Route Handlers: returns the user-bound client or throws. */
export async function authedClient() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  const supabase = await createClient();
  return { user, supabase };
}
