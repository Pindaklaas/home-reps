import { Suspense } from "react";
import { ConversationList } from "@/components/brain/conversation-list";
import { Skeleton } from "@/components/ui/primitives";

export default function BrainLayout({ children }: LayoutProps<"/brain">) {
  return (
    <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
      <aside className="hidden xl:block">
        <div className="sticky top-10">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <ConversationList />
          </Suspense>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
