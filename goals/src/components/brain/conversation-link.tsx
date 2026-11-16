"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function ConversationLink({ id, title }: { id: string; title: string }) {
  const active = usePathname() === `/brain/${id}`;
  return (
    <Link
      href={`/brain/${id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block truncate rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
        active ? "bg-hover text-fg" : "text-muted hover:bg-hover/60 hover:text-fg",
      )}
      title={title}
    >
      {title}
    </Link>
  );
}
