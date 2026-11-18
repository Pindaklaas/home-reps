import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { Chat } from "@/components/brain/chat";
import { getAppContext } from "@/lib/data";
import { getBrainStatus } from "@/lib/brain";
import { aiConfigured } from "@/lib/ai/client";
import { PageHeader, Skeleton } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Claude" };

export default function BrainPage({ searchParams }: PageProps<"/brain">) {
  return (
    <>
      <PageHeader
        title="Habla con Claude"
        description="Escríbele lo que quieras. Te contesta con tus datos y te propone cambios: tú decides con un toque."
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
  const { supabase } = await getAppContext();
  const sp = await searchParams;
  const prompt = typeof sp.prompt === "string" ? sp.prompt.slice(0, 2000) : undefined;
  const ai = aiConfigured();
  const bridge = !ai && Boolean((await getBrainStatus(supabase))?.connected);
  return <Chat key={prompt ?? "new"} conversationId={null} initialMessages={[]} aiEnabled={ai} bridge={bridge} initialPrompt={prompt} />;
}
