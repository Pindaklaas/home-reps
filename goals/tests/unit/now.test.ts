import { describe, expect, it } from "vitest";
import { pickNow, type NowTask } from "@/lib/now";

const t = (id: string, date: string | null, time: string | null, minutes: number | null = 60, status = "pending"): NowTask => ({
  id,
  title: id,
  status,
  scheduled_date: date,
  scheduled_time: time,
  estimated_minutes: minutes,
});
const today = "2026-11-19";

describe("pickNow (Ahora toca)", () => {
  const tasks = [t("jorge", today, "16:00:00", 60), t("vender", today, "17:15:00", 105), t("libre", today, null)];

  it("shows the task whose slot covers now", () => {
    const p = pickNow(tasks, today, "16:20");
    expect(p.kind).toBe("now");
    expect(p.task?.id).toBe("jorge");
  });

  it("shows the next timed task between slots, and remembers the missed one", () => {
    const p = pickNow(tasks, today, "17:05");
    expect(p.kind).toBe("next");
    expect(p.task?.id).toBe("vender");
    expect(p.missed.map((m) => m.id)).toEqual(["jorge"]);
  });

  it("falls back to an untimed task once timed ones are over", () => {
    const p = pickNow(tasks, today, "21:00");
    expect(p.task?.id).toBe("libre");
    expect(p.missed).toHaveLength(2);
  });

  it("ignores completed tasks and looks at later days when today is empty", () => {
    const p = pickNow([t("hecha", today, "10:00:00", 60, "completed"), t("viernes", "2026-11-20", "16:30:00"), t("jueves-tarde", "2026-11-21", "10:30:00")], today, "09:00");
    expect(p.kind).toBe("later");
    expect(p.task?.id).toBe("viernes");
  });

  it("says free when nothing is left", () => {
    expect(pickNow([], today, "12:00").kind).toBe("free");
  });
});
