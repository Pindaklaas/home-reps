"use server";

import { dailyLogSchema, type ActionState } from "@/lib/validation";
import { check, parseForm, runAction } from "./helpers";

export async function saveDailyLog(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async ({ supabase }) => {
    const { data, error } = parseForm(dailyLogSchema, formData);
    if (error) return error;
    check(await supabase.from("daily_logs").upsert(data, { onConflict: "user_id,log_date" }));
    return { ok: true, message: "Guardado" };
  });
}
