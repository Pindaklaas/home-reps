import { describe, expect, it } from "vitest";
import { formToObject, goalSchema, ideaSchema, taskSchema, validationError } from "@/lib/validation";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
};

describe("validation", () => {
  it("turns empty and missing optional fields into null", () => {
    const r = taskSchema.parse(formToObject(fd({ title: "Llamar", due_date: "", estimated_minutes: "" })));
    expect(r).toMatchObject({ title: "Llamar", due_date: null, estimated_minutes: null, description: null, project_id: null, priority: "medium", status: "pending" });
  });

  it("rejects an empty title with a Spanish message", () => {
    const r = taskSchema.safeParse(formToObject(fd({ title: "   " })));
    expect(r.success).toBe(false);
    if (!r.success) expect(validationError(r.error)).toMatchObject({ ok: false, error: "El nombre es obligatorio" });
  });

  it("rejects malformed dates and ids", () => {
    expect(taskSchema.safeParse({ title: "x", due_date: "16/11/2026" }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "x", project_id: "not-a-uuid" }).success).toBe(false);
  });

  it("requires a target different from the start for metric goals", () => {
    expect(goalSchema.safeParse({ title: "Ahorrar", progress_mode: "metric", metric_start: "0", metric_target: "" }).success).toBe(false);
    expect(goalSchema.safeParse({ title: "Ahorrar", progress_mode: "metric", metric_start: "0", metric_target: "10000" }).success).toBe(true);
  });

  it("accepts a task time only with a day, and normalizes it to HH:MM", () => {
    expect(taskSchema.parse({ title: "Jorge", scheduled_date: "2026-11-19", scheduled_time: "16:00:00", remind_before_minutes: "30" }))
      .toMatchObject({ scheduled_time: "16:00", remind_before_minutes: 30 });
    expect(taskSchema.safeParse({ title: "Jorge", scheduled_time: "16:00" }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "Jorge", scheduled_date: "2026-11-19", scheduled_time: "25:00" }).success).toBe(false);
    expect(taskSchema.parse({ title: "Sin hora" })).toMatchObject({ scheduled_time: null, remind_before_minutes: 0 });
  });

  it("parses checkboxes", () => {
    expect(goalSchema.parse({ title: "A", is_primary: "on" }).is_primary).toBe(true);
    expect(goalSchema.parse({ title: "A" }).is_primary).toBe(false);
  });

  it("keeps idea scores in range", () => {
    expect(ideaSchema.safeParse({ title: "Idea", potential: "6" }).success).toBe(false);
    expect(ideaSchema.parse({ title: "Idea", potential: "4", estimated_cost: "250.5" })).toMatchObject({ potential: 4, estimated_cost: 250.5 });
  });

  it("collects [] fields as arrays and ignores Next action fields", () => {
    const o = formToObject(fd({ "options[]": "A", $ACTION_ID_x: "1" }));
    expect(o).toEqual({ options: ["A"] });
  });
});
