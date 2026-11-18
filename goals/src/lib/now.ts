/**
 * Picks the task for the "Ahora toca" card.
 * - a timed task whose slot covers `nowHm` is "now";
 * - otherwise the next timed task today is "next";
 * - otherwise the first untimed open task today is "next";
 * - otherwise the earliest open task on a later day is "later";
 * - nothing left today and nothing ahead is "free".
 * Timed tasks whose slot already ended stay "missed" (shown as a reminder).
 */
export type NowTask = {
  id: string;
  title: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_minutes: number | null;
};

export type NowPick<T extends NowTask> =
  | { kind: "now" | "next"; task: T; missed: T[] }
  | { kind: "later"; task: T; missed: T[] }
  | { kind: "free"; task: null; missed: T[] };

const isOpen = (t: NowTask) => t.status === "pending" || t.status === "in_progress";
const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

export function pickNow<T extends NowTask>(tasks: T[], today: string, nowHm: string): NowPick<T> {
  const now = toMin(nowHm);
  const todays = tasks.filter((t) => isOpen(t) && t.scheduled_date === today);
  const timed = todays
    .filter((t) => t.scheduled_time)
    .sort((a, b) => a.scheduled_time!.localeCompare(b.scheduled_time!));
  const missed: T[] = [];
  for (const t of timed) {
    const start = toMin(t.scheduled_time!);
    const end = start + Math.max(t.estimated_minutes ?? 30, 15);
    if (start <= now && now < end) return { kind: "now", task: t, missed };
    if (end <= now) missed.push(t);
    else return { kind: "next", task: t, missed };
  }
  const untimed = todays.find((t) => !t.scheduled_time);
  if (untimed) return { kind: "next", task: untimed, missed };
  const later = tasks
    .filter((t) => isOpen(t) && t.scheduled_date && t.scheduled_date > today)
    .sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!) || (a.scheduled_time ?? "99").localeCompare(b.scheduled_time ?? "99"))[0];
  if (later) return { kind: "later", task: later, missed };
  return { kind: "free", task: null, missed };
}
