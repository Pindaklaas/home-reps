"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  CalendarCheck2,
  CheckSquare,
  FolderKanban,
  House,
  Lightbulb,
  Menu,
  MessageCircle,
  Settings,
  Target,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: typeof Target };

export const NAV: Item[][] = [
  [
    { href: "/", label: "Inicio", icon: House },
    { href: "/planner", label: "Mi día", icon: CalendarCheck2 },
    { href: "/brain", label: "Claude", icon: MessageCircle },
    { href: "/tasks", label: "Tareas", icon: CheckSquare },
  ],
  [
    { href: "/goals", label: "Metas", icon: Target },
    { href: "/projects", label: "Proyectos", icon: FolderKanban },
    { href: "/ideas", label: "Ideas", icon: Lightbulb },
  ],
  [
    { href: "/analytics", label: "Números", icon: BarChart3 },
    { href: "/settings", label: "Ajustes", icon: Settings },
  ],
];

const MOBILE_TABS: Item[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/planner", label: "Mi día", icon: CalendarCheck2 },
  { href: "/brain", label: "Claude", icon: MessageCircle },
  { href: "/goals", label: "Metas", icon: Target },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ badges }: { badges?: ReactNode }) {
  return <SidebarNavView pathname={usePathname()} badges={badges} />;
}

/** Same markup without the active state: the prerendered fallback for SidebarNav. */
export function SidebarNavView({ pathname, badges }: { pathname: string; badges?: ReactNode }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-5">
      {NAV.map((group, i) => (
        <ul key={i} className="flex flex-col gap-0.5">
          {group.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors",
                    active ? "bg-hover text-fg" : "text-muted hover:bg-hover/60 hover:text-fg",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-accent" : "text-faint group-hover:text-muted")} aria-hidden />
                  <span className="flex-1">{label}</span>
                  {href === "/brain" ? badges : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ))}
    </nav>
  );
}

export function MobileNav({ footer }: { footer?: ReactNode }) {
  return <MobileNavView pathname={usePathname()} footer={footer} />;
}

export function MobileNavView({ pathname, footer }: { pathname: string; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = sheet.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-around">
          {MOBILE_TABS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
                    active ? "text-accent" : "text-muted",
                  )}
                >
                  <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-accent-soft")}>
                    <Icon className="h-[22px] w-[22px]" aria-hidden />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-semibold text-muted"
              aria-haspopup="dialog"
            >
              <span className="flex h-7 w-12 items-center justify-center">
                <Menu className="h-[22px] w-[22px]" aria-hidden />
              </span>
              Más
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={sheet}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === sheet.current && setOpen(false)}
        className="mb-0 mt-auto w-full max-w-none rounded-t-2xl border border-line bg-elevated p-0 text-fg lg:hidden"
        aria-label="Navegación"
      >
        <div className="px-4 pb-6 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-base font-semibold text-fg">¿Adónde quieres ir?</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-faint hover:bg-hover" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="grid grid-cols-3 gap-2">
            {NAV.flat().map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border border-line px-2 py-4 text-sm font-medium",
                    isActive(pathname, href) ? "bg-hover text-fg" : "text-muted",
                  )}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          {footer ? <div className="mt-4 border-t border-line pt-4">{footer}</div> : null}
        </div>
      </dialog>
    </>
  );
}
