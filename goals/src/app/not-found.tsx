import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-faint">404</p>
      <h1 className="mt-2 text-lg font-semibold">No existe o no tienes acceso</h1>
      <p className="mt-1 text-sm text-muted">El elemento puede haberse eliminado.</p>
      <Link href="/" className="mt-5 text-sm text-accent hover:underline">
        Volver al inicio
      </Link>
    </main>
  );
}
