import type { Metadata } from "next";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Skeleton } from "@/components/ui/primitives";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(600px circle at 50% 0%, var(--accent-soft), transparent 60%)",
        }}
      />
      <div className="relative w-full max-w-[360px] animate-rise">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-6" />
          <h1 className="text-xl font-semibold tracking-tight">Tu centro de control</h1>
          <p className="mt-1.5 text-sm text-muted">Acceso privado. Solo para el propietario.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5 shadow-panel">
          <Suspense fallback={<Skeleton className="h-52 w-full" />}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-faint">
          <Lock className="h-3 w-3" aria-hidden /> Sesión cifrada · datos protegidos con RLS
        </p>
      </div>
    </main>
  );
}
