import Link from "next/link";

/** Ranked horizontal bars with direct labels (name left, value right). */
export function BarList({
  items,
  format = (v) => String(v),
  empty = "Sin datos todavía",
  max: fixedMax,
}: {
  items: { key: string; label: string; value: number; href?: string }[];
  format?: (v: number) => string;
  empty?: string;
  /** Fixed scale (e.g. 100 for percentages); defaults to the largest value. */
  max?: number;
}) {
  if (!items.length) return <p className="py-6 text-center text-sm text-faint">{empty}</p>;
  const max = fixedMax ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((it) => {
        const inner = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate text-fg">{it.label}</span>
              <span className="shrink-0 tabular-nums text-muted">{format(it.value)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-subtle">
              <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${Math.min(100, (it.value / max) * 100)}%` }} />
            </div>
          </>
        );
        return (
          <li key={it.key}>
            {it.href ? (
              <Link href={it.href} className="block rounded-md transition-opacity hover:opacity-80">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
