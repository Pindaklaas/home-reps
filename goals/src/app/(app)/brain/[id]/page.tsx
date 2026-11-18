import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { z } from "zod";
import { getAppContext } from "@/lib/data";
import { aiConfigured } from "@/lib/ai/client";
import { getBrainStatus } from "@/lib/brain";
import { Chat, type ChatMessage } from "@/components/brain/chat";
import { InlineAction } from "@/components/ui/forms";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { deleteConversation } from "@/lib/actions/ai";
import type { ProposalStatus } from "@/lib/constants";

export default function ConversationPage({ params }: PageProps<"/brain/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: { params: PageProps<"/brain/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await getAppContext();
  const ai = aiConfigured();
  const [conv, msgs, proposals, brain] = await Promise.all([
    supabase.from("ai_conversations").select("id, title").eq("id", id).maybeSingle(),
    supabase.from("ai_messages").select("id, role, content, created_at").eq("conversation_id", id).order("created_at"),
    supabase.from("ai_proposals").select("*").eq("conversation_id", id).order("created_at"),
    ai ? null : getBrainStatus(supabase),
  ]);
  if (!conv.data) notFound();

  // Proposals hang off the user message that triggered them; show them under
  // the assistant reply that follows it.
  const byUserMsg = new Map<string, typeof proposals.data>();
  for (const p of proposals.data ?? []) {
    const k = p.message_id ?? "orphan";
    byUserMsg.set(k, [...(byUserMsg.get(k) ?? []), p]);
  }
  const messages: ChatMessage[] = [];
  let lastUser: string | null = null;
  for (const m of msgs.data ?? []) {
    if (m.role === "user") lastUser = m.id;
    const attached = m.role === "assistant" && lastUser ? byUserMsg.get(lastUser) ?? [] : [];
    if (m.role === "assistant" && lastUser) byUserMsg.delete(lastUser);
    messages.push({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      proposals: attached.map((p) => ({
        id: p.id,
        action: p.action,
        summary: p.summary,
        rationale: p.rationale,
        status: p.status as ProposalStatus,
        error: p.error,
        applied_entity_id: p.applied_entity_id,
        payload: p.payload,
      })),
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/brain" className="mb-1 inline-flex items-center gap-1.5 text-[13px] text-faint hover:text-muted xl:hidden">
            <ArrowLeft className="h-3.5 w-3.5" /> Claude
          </Link>
          <h1 className="truncate text-lg font-semibold tracking-tight">{conv.data.title}</h1>
        </div>
        <InlineAction
          action={deleteConversation}
          fields={{ id }}
          confirm="¿Eliminar esta conversación? Las propuestas ya aplicadas se conservan."
          className={buttonClass("ghost", "sm", "hover:text-danger")}
          title="Eliminar conversación"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </InlineAction>
      </div>
      <Chat key={id} conversationId={id} initialMessages={messages} aiEnabled={ai} bridge={!ai && Boolean(brain?.connected)} />
    </>
  );
}
