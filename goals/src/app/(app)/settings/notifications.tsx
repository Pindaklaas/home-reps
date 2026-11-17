"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/lib/actions/push";
import { AiButton } from "@/components/brain/ai-button";
import type { ActionState } from "@/lib/validation";

function toKey(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Status = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

export function NotificationSettings({ publicKey }: { publicKey: string | null }) {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<ActionState>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setStatus(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  const enable = () =>
    start(async () => {
      setMessage(null);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey!) }));
        const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
        setMessage(res);
        if (res?.ok) setStatus("on");
      } catch {
        setMessage({ ok: false, error: "No se pudieron activar. Inténtalo de nuevo." });
      }
    });

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
      setMessage({ ok: true, message: "Notificaciones desactivadas en este dispositivo" });
    });

  if (!publicKey) {
    return <p className="text-sm text-muted">Las notificaciones aún no están configuradas en el servidor.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">
        Las tareas con <strong className="text-fg">hora</strong> te avisan en este dispositivo a esa hora (y antes, si lo eliges al crearlas).
      </p>
      {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin text-faint" /> : null}
      {status === "ios-install" ? (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
          En iPhone, primero añade GOALS a la pantalla de inicio (Compartir → Añadir a pantalla de inicio), ábrela desde ahí y vuelve a esta pantalla.
        </p>
      ) : null}
      {status === "unsupported" ? <p className="text-[13px] text-warning">Este navegador no admite notificaciones push.</p> : null}
      {status === "denied" ? (
        <p className="text-[13px] text-warning">Has bloqueado las notificaciones para esta web. Actívalas en los ajustes del navegador o del móvil.</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {status === "off" ? (
          <button
            type="button"
            onClick={enable}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Activar notificaciones en este dispositivo
          </button>
        ) : null}
        {status === "on" ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm text-success">
              <Bell className="h-4 w-4" /> Activadas en este dispositivo
            </span>
            <AiButton action={sendTestPush as (p: ActionState, f: FormData) => Promise<ActionState>} label="Enviar notificación de prueba" pendingLabel="Enviando…" variant="secondary" />
            <button type="button" onClick={disable} disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted hover:bg-hover hover:text-fg">
              <BellOff className="h-4 w-4" /> Desactivar
            </button>
          </>
        ) : null}
      </div>
      {message ? <p className={message.ok ? "text-[13px] text-success" : "text-[13px] text-danger"}>{message.ok ? message.message : message.error}</p> : null}
    </div>
  );
}
