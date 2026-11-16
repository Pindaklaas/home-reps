import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { Chat } from "@/components/brain/chat";
import { getCurrentUser } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai/client";
import { PageHeader, Skeleton } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "AI Brain" };

export default function BrainPage({ searchParams }: PageProps<"/brain">) {
  return (
    <>
      <PageHeader
        title="AI Brain"
        description="Piensa en voz alta. Claude analiza con tus datos reales y te propone cambios que tú apruebas."
        actions={
          <Link href="/brain/history" className={buttonClass("ghost", "sm", "xl:hidden")}>
            <History className="h-3.5 w-3.5" /> Historial
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <NewChat searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewChat({ searchParams }: { searchParams: PageProps<"/brain">["searchParams"] }) {
  await getCurrentUser();
  const sp = await searchParams;
  const prompt = typeof sp.prompt === "string" ? sp.prompt.slice(0, 2000) : undefined;
  return <Chat key={prompt ?? "new"} conversationId={null} initialMessages={[]} aiEnabled={aiConfigured()} initialPrompt={prompt} />;
}
