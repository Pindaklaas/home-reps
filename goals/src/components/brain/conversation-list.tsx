import Link from "next/link";
import { Brain, MessageSquarePlus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConversationLink } from "./conversation-link";

export async function ConversationList() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at")
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(40);

  return (
    <nav aria-label="Conversaciones" className="flex flex-col gap-1">
      <Link
        href="/brain"
        className="mb-1 flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-fg transition-colors hover:bg-hover"
      >
        <MessageSquarePlus className="h-4 w-4 text-accent" /> Nueva conversación
      </Link>
      <Link href="/brain/memory" className="mb-3 flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-muted transition-colors hover:bg-hover hover:text-fg">
        <Brain className="h-4 w-4 text-faint" /> Memoria y decisiones
      </Link>
      <div className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Historial</div>
      {data?.length ? (
        data.map((c) => <ConversationLink key={c.id} id={c.id} title={c.title} />)
      ) : (
        <p className="px-2.5 text-xs text-faint">Aún no hay conversaciones.</p>
      )}
    </nav>
  );
}
