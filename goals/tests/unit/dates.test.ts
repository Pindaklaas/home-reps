import { describe, expect, it } from "vitest";
import { addDays, dayBoundsUtc, daysBetween, relativeDay, todayIn, tzOffsetMinutes, weekRange, formatMinutes } from "@/lib/dates";

describe("dates", () => {
  it("computes today in the user's time zone, not the server's", () => {
    const lateUtc = new Date("2026-11-16T23:30:00Z");
    expect(todayIn("Europe/Madrid", lateUtc)).toBe("2026-11-17");
    expect(todayIn("America/New_York", lateUtc)).toBe("2026-11-16");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("returns Monday-based and Sunday-based weeks", () => {
    expect(weekRange("2026-11-19", 1)).toEqual({ start: "2026-11-16", end: "2026-11-22" });
    expect(weekRange("2026-11-19", 0)).toEqual({ start: "2026-11-15", end: "2026-11-21" });
  });

  it("knows Madrid's offset in winter and summer", () => {
    expect(tzOffsetMinutes("Europe/Madrid", new Date("2026-01-15T12:00:00Z"))).toBe(60);
    expect(tzOffsetMinutes("Europe/Madrid", new Date("2026-07-15T12:00:00Z"))).toBe(120);
  });

  it("gives the UTC bounds of a local day", () => {
    expect(dayBoundsUtc("2026-11-16", "Europe/Madrid")).toEqual({
      start: "2026-11-15T23:00:00.000Z",
      end: "2026-11-16T23:00:00.000Z",
    });
  });

  it("describes relative days in Spanish", () => {
    expect(relativeDay("2026-11-16", "2026-11-16")).toBe("hoy");
    expect(relativeDay("2026-11-17", "2026-11-16")).toBe("mañana");
    expect(relativeDay("2026-11-13", "2026-11-16")).toBe("hace 3 días");
    expect(daysBetween("2026-11-16", "2026-12-16")).toBe(30);
  });

  it("formats minutes", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(95)).toBe("1 h 35 min");
  });
});
