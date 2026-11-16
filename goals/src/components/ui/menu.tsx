"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

/** Small popover menu. Items are rendered by the caller (buttons or forms). */
export function Menu({ children, label = "Acciones", align = "right" }: { children: ReactNode; label?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-hover hover:text-fg"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {/* Kept mounted while closed, so dialogs opened from an item survive the menu closing. */}
      <div
          role="menu"
          hidden={!open}
          onClick={(e) => {
            // Close after choosing an item, but let forms submit first.
            if ((e.target as HTMLElement).closest("button")) setTimeout(() => setOpen(false), 0);
          }}
          className={cn(
            "absolute top-8 z-30 min-w-[180px] animate-fade-in overflow-hidden rounded-lg border border-line bg-elevated p-1 shadow-panel",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
    </div>
  );
}

export const menuItemClass =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-muted transition-colors hover:bg-hover hover:text-fg";
