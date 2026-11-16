import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Sin conexión" };

/** Static page the service worker shows when there is no network. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <WifiOff className="mb-4 h-6 w-6 text-faint" aria-hidden />
      <h1 className="text-lg font-semibold">Sin conexión</h1>
      <p className="mt-1 max-w-xs text-sm text-muted">
        GOALS no guarda tus datos privados en el dispositivo. Vuelve a intentarlo cuando tengas conexión.
      </p>
    </main>
  );
}
