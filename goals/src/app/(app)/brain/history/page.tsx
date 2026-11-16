import type { Metadata } from "next";
import { Suspense } from "react";
import { ConversationList } from "@/components/brain/conversation-list";
import { PageHeader, Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Conversaciones" };

/** Conversation list for small screens (the sidebar shows it on desktop). */
export default function HistoryPage() {
  return (
    <>
      <PageHeader title="Conversaciones" />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ConversationList />
      </Suspense>
    </>
  );
}
