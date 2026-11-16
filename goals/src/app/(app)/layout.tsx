import { Suspense } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { MobileNav, MobileNavView, SidebarNav, SidebarNavView } from "@/components/layout/nav";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/session";

async function PendingProposalsBadge() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { count } = await supabase
    .from("ai_proposals")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (!count) return null;
  return (
    <span
      className="rounded-full bg-accent-soft px-1.5 text-[10px] font-semibold leading-4 text-accent tabular-nums"
      title={`${count} propuestas pendientes de aprobación`}
    >
      {count}
    </span>
  );
}

async function AccountFooter() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-semibold uppercase text-muted">
        {user.email.slice(0, 1)}
      </div>
      <span className="min-w-0 flex-1 truncate text-xs text-muted" title={user.email}>
        {user.email}
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md p-1.5 text-faint transition-colors hover:bg-hover hover:text-fg"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:pl-[232px]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-elevated focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-line bg-bg px-3 py-4 lg:flex">
        <Link href="/" className="mb-6 px-2.5 py-1" aria-label="GOALS, inicio">
          <Logo />
        </Link>
        <div className="flex-1 overflow-y-auto">
          {/* The active link depends on the URL (request data), so it streams in. */}
          <Suspense fallback={<SidebarNavView pathname="" />}>
            <SidebarNav
              badges={
                <Suspense fallback={null}>
                  <PendingProposalsBadge />
                </Suspense>
              }
            />
          </Suspense>
        </div>
        <div className="border-t border-line px-1 pt-3">
          <Suspense fallback={<div className="h-7" />}>
            <AccountFooter />
          </Suspense>
        </div>
      </aside>

      <header
        className="sticky top-0 z-30 flex h-12 items-center border-b border-line bg-bg/85 px-4 backdrop-blur-xl lg:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <Link href="/" aria-label="GOALS, inicio">
          <Logo />
        </Link>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1120px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
        {children}
      </main>

      <Suspense fallback={<MobileNavView pathname="" />}>
        <MobileNav
          footer={
            <Suspense fallback={<div className="h-7" />}>
              <AccountFooter />
            </Suspense>
          }
        />
      </Suspense>
    </div>
  );
}
