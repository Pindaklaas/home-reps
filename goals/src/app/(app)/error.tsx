"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-line px-6 py-16 text-center">
      <AlertTriangle className="mb-3 h-5 w-5 text-warning" aria-hidden />
      <h1 className="text-base font-semibold">Algo ha fallado al cargar esta pantalla</h1>
      <p className="mt-1 max-w-md text-sm text-muted">
        {error.message || "Error inesperado."} Tus datos no se han modificado.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-faint">ref: {error.digest}</p> : null}
      <Button className="mt-5" onClick={() => retry()}>
        Reintentar
      </Button>
    </div>
  );
}
