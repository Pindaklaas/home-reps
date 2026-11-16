import Link from "next/link";
import { cn } from "@/lib/cn";

export function Tabs({
  items,
  current,
  className,
}: {
  items: { value: string; label: string; href: string; count?: number }[];
  current: string;
  className?: string;
}) {
  return (
    <nav aria-label="Vistas" className={cn("-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1", className)}>
      {items.map((it) => {
        const active = it.value === current;
        return (
          <Link
            key={it.value}
            href={it.href}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative -mb-px flex h-9 shrink-0 items-center gap-1.5 px-2.5 text-[13px] transition-colors",
              active ? "text-fg after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-accent" : "text-faint hover:text-muted",
            )}
          >
            {it.label}
            {typeof it.count === "number" ? <span className="tabular-nums text-[11px] text-faint">{it.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
