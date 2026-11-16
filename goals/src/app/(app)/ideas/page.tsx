import type { Metadata } from "next";
import { Suspense } from "react";
import { Lightbulb } from "lucide-react";
import { getAppContext, listIdeas } from "@/lib/data";
import { EmptyState, ListSkeleton, PageHeader } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { IdeaDialog } from "@/components/forms/entity-forms";
import { IdeaRow } from "@/components/ideas/idea-row";
import { aiConfigured } from "@/lib/ai/client";
import type { IdeaStatus } from "@/lib/constants";

export const metadata: Metadata = { title: "Ideas" };

const VIEWS: Record<string, { label: string; statuses: IdeaStatus[] }> = {
  open: { label: "Abiertas", statuses: ["new", "exploring", "validated"] },
  parked: { label: "Aparcadas y descartadas", statuses: ["parked", "discarded"] },
  converted: { label: "Convertidas", statuses: ["converted"] },
};

export default function IdeasPage({ searchParams }: PageProps<"/ideas">) {
  return (
    <>
      <PageHeader
        title="Ideas Vault"
        description="Todas tus ideas, sin perder ninguna. Claude puede evaluarlas y compararlas antes de que inviertas tiempo."
      />
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <IdeasContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function score(i: { potential: number | null; difficulty: number | null; ai_evaluation: unknown }) {
  const ai = (i.ai_evaluation as { score?: number } | null)?.score;
  if (typeof ai === "number") return ai;
  if (i.potential && i.difficulty) return i.potential * 20 - i.difficulty * 6;
  return -1;
}

async function IdeasContent({ searchParams }: { searchParams: PageProps<"/ideas">["searchParams"] }) {
  const sp = await searchParams;
  const view = typeof sp.view === "string" && sp.view in VIEWS ? sp.view : "open";
  const { supabase, tz } = await getAppContext();
  const ideas = await listIdeas(supabase);
  const ai = aiConfigured();
  const list = ideas.filter((i) => VIEWS[view].statuses.includes(i.status)).sort((a, b) => score(b) - score(a));

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Tabs
          className="flex-1"
          current={view}
          items={Object.entries(VIEWS).map(([value, v]) => ({
            value,
            label: v.label,
            count: ideas.filter((i) => v.statuses.includes(i.status)).length,
            href: value === "open" ? "/ideas" : `/ideas?view=${value}`,
          }))}
        />
        <div className="-mt-1 shrink-0">
          <IdeaDialog />
        </div>
      </div>
      {list.length ? (
        <>
          <p className="mb-3 text-xs text-faint">Ordenadas por la puntuación de Claude o, si no hay evaluación, por potencial frente a dificultad.</p>
          <ul>{list.map((i) => <IdeaRow key={i.id} idea={i} tz={tz} aiEnabled={ai} />)}</ul>
        </>
      ) : (
        <EmptyState
          icon={<Lightbulb className="h-5 w-5" />}
          title={view === "open" ? "Tu bóveda de ideas está vacía" : "Nada en esta vista"}
          description={view === "open" ? "Apunta cualquier idea en cuanto aparezca. Decidir viene después." : undefined}
          action={view === "open" ? <IdeaDialog /> : undefined}
        />
      )}
    </>
  );
}
