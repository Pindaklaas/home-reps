import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const TABLES = [
  "profiles", "goals", "goal_checkins", "projects", "tasks", "time_entries", "ideas", "decisions",
  "daily_logs", "ai_conversations", "ai_messages", "ai_proposals", "ai_memory", "notifications", "activity_log",
] as const;

/** Downloads every row the owner has, as JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();

  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), account: user.email };
  for (const table of TABLES) {
    const res = await supabase.from(table).select("*");
    if (res.error) return NextResponse.json({ error: `export_failed:${table}` }, { status: 500 });
    out[table] = res.data;
  }
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="goals-export-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
