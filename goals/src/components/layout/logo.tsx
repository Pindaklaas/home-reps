import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-5 w-5", className)} aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="var(--accent)" />
      <circle cx="12" cy="12" r="6.2" fill="none" stroke="var(--accent-fg)" strokeWidth="1.8" opacity="0.9" />
      <circle cx="12" cy="12" r="2.2" fill="var(--accent-fg)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-[0.14em] text-fg", className)}>
      <LogoMark />
      <span className="text-[13px]">GOALS</span>
    </span>
  );
}
