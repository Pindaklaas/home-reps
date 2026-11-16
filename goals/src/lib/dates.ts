/** Date helpers. Calendar dates are plain "YYYY-MM-DD" strings in the user's time zone. */

export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Start (inclusive) and end (inclusive) of the week containing `date`. */
export function weekRange(date: string, weekStartsOn = 1): { start: string; end: string } {
  const offset = (dayOfWeek(date) - weekStartsOn + 7) % 7;
  const start = addDays(date, -offset);
  return { start, end: addDays(start, 6) };
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Calendar date of an ISO timestamp in the given time zone. */
export function dateOf(timestamp: string, timeZone: string): string {
  return todayIn(timeZone, new Date(timestamp));
}

const LOCALE = "es-ES";

export function formatDate(date: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!date) return "";
  return new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}

export function formatLongDate(date: string) {
  const s = formatDate(date, { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDateTime(ts: string, timeZone: string) {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(ts));
}

/** "hoy", "mañana", "hace 3 días", "en 5 días"... relative to `today`. */
export function relativeDay(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  if (diff > 1 && diff < 7) return `en ${diff} días`;
  if (diff < -1 && diff > -7) return `hace ${-diff} días`;
  return formatDate(date);
}

export function formatMinutes(min: number | null | undefined): string {
  const m = Math.max(0, Math.round(min ?? 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function relativeTime(ts: string, now: Date = new Date()): string {
  const sec = Math.round((now.getTime() - new Date(ts).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  if (Math.abs(sec) < 60) return "ahora";
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return rtf.format(-min, "minute");
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return rtf.format(-h, "hour");
  const d = Math.round(h / 24);
  if (Math.abs(d) < 30) return rtf.format(-d, "day");
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" }).format(new Date(ts));
}

/** Offset in minutes of `timeZone` from UTC at the given instant (Madrid in winter: +60). */
export function tzOffsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** UTC instants [start, end) of a local calendar day, as ISO strings. */
export function dayBoundsUtc(date: string, timeZone: string): { start: string; end: string } {
  const toUtc = (d: string) => {
    const midnightUtc = Date.parse(`${d}T00:00:00Z`);
    const offset = tzOffsetMinutes(timeZone, new Date(midnightUtc));
    return new Date(midnightUtc - offset * 60000).toISOString();
  };
  return { start: toUtc(date), end: toUtc(addDays(date, 1)) };
}
