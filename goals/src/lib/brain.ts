import "server-only";
import { z } from "zod";
import type { ServerSupabase } from "@/lib/supabase/server";

const statusSchema = z.object({
  ready: z.boolean(),
  connected: z.boolean(),
  working: z.boolean(),
  last_fire_at: z.string().nullable(),
  last_status: z.number().nullable(),
  waiting: z.number(),
});
export type BrainStatus = z.infer<typeof statusSchema> & { authError: boolean };

/** State of the chat bridge (Claude Code scheduled task). Null if unavailable. */
export async function getBrainStatus(supabase: ServerSupabase): Promise<BrainStatus | null> {
  const res = await supabase.rpc("brain_status");
  if (res.error) {
    console.error("[brain_status]", res.error);
    return null;
  }
  const parsed = statusSchema.safeParse(res.data);
  if (!parsed.success) return null;
  const s = parsed.data;
  return { ...s, authError: s.last_status === 401 || s.last_status === 403 || s.last_status === 404 };
}
