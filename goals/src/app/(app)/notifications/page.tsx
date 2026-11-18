import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getAppContext } from "@/lib/data";
import { EmptyState, ListSkeleton, PageHeader } from "@/components/ui/primitives";
import { InlineAction } from "@/components/ui/forms";
import { AiButton } from "@/components/brain/ai-button";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Avisos" };

export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="Avisos" description="Todo lo que GOALS te ha avisado: tareas, fechas, metas y propuestas de Claude." />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const { supabase, tz } = await getAppContext();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, scheduled_for, read_at")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: false })
    .limit(60);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  if (!items.length) {
    return <EmptyState icon={<Bell className="h-5 w-5" />} title="Sin avisos todavía" description="Cuando algo necesite tu atención, aparecerá aquí y en tu móvil." />;
  }
  return (
    <>
      {unread ? (
        <div className="mb-3 flex justify-end">
          <AiButton action={markAllNotificationsRead} label={`Marcar ${unread} como leídos`} variant="ghost" />
        </div>
      ) : null}
      <ul className="divide-y divide-line">
        {items.map((n) => (
          <li key={n.id} className="flex items-start gap-3 py-3">
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-accent")} aria-hidden />
            <div className="min-w-0 flex-1">
              <Link href={n.link ?? "/"} className={cn("text-sm hover:underline", n.read_at ? "text-muted" : "font-medium text-fg")}>
                {n.title}
              </Link>
              {n.body ? <p className="mt-0.5 text-[13px] text-muted">{n.body}</p> : null}
              <p className="mt-0.5 text-xs text-faint">{formatDateTime(n.scheduled_for ?? "", tz)}</p>
            </div>
            {!n.read_at ? (
              <InlineAction action={markNotificationRead} fields={{ id: n.id }} className="rounded-md px-2 py-1 text-xs text-faint hover:bg-hover hover:text-fg" title="Marcar como leído">
                Leído
              </InlineAction>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
