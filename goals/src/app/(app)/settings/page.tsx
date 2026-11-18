import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarDays, Download, Lock, Workflow } from "lucide-react";
import { getAppContext } from "@/lib/data";
import { serverEnv } from "@/lib/env";
import { aiConfigured, aiModel } from "@/lib/ai/client";
import { Badge, ListSkeleton, PageHeader } from "@/components/ui/primitives";
import { AccountForms, AiSettingsForm, ProfileForm, ThemePicker } from "./forms";
import { NotificationSettings } from "./notifications";
import { NotificationPrefs } from "./notification-prefs";
import { publicEnv } from "@/lib/env";
import { pushConfigured } from "@/lib/push";
import { AiButton } from "@/components/brain/ai-button";
import { checkClaude } from "@/lib/actions/ai";
import { getBrainStatus } from "@/lib/brain";
import { BrainConnect } from "./brain-connect";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Ajustes" />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <Settings />
      </Suspense>
    </>
  );
}

function Block({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-4 border-t border-line py-8 first:border-t-0 first:pt-0 md:grid-cols-[220px_1fr] md:gap-10">
      <div>
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

async function Settings() {
  const { user, profile, supabase } = await getAppContext();
  const env = serverEnv();
  const ai = aiConfigured();
  const brain = ai ? null : await getBrainStatus(supabase);

  return (
    <div className="max-w-4xl">
      <Block id="profile" title="Perfil y preferencias" description="Tu nombre, zona horaria y la capacidad que Claude usa para planificar.">
        <ProfileForm profile={profile} />
      </Block>

      {!ai ? (
        <Block id="claude" title="Chat con Claude" description="Escríbele desde la app y te contesta aquí en 1–3 minutos, con aviso en el móvil. Usa tu plan de Claude, sin clave de pago aparte.">
          <BrainConnect
            status={brain ? { ready: brain.ready, connected: brain.connected, authError: brain.authError, lastFireAt: brain.last_fire_at } : null}
          />
        </Block>
      ) : null}

      <Block id="notifications" title="Notificaciones" description="Avisos en el móvil: tareas con hora y avisos automáticos de lo que se te escapa.">
        <NotificationSettings publicKey={pushConfigured() ? publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null : null} />
        <NotificationPrefs profile={profile} />
      </Block>

      <Block id="theme" title="Tema" description="Se guarda en este dispositivo y en tu perfil.">
        <ThemePicker initial={(profile?.theme as "dark" | "light" | "system") ?? "dark"} />
      </Block>

      <Block id="ai" title="Inteligencia artificial" description="Cómo trabaja Claude contigo.">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Estado:</span>
          {ai ? <Badge tone="success">Conectado</Badge> : <Badge tone="warning">Sin configurar</Badge>}
          <span className="text-faint">· modelo {aiModel()}</span>
        </div>
        {ai ? (
          <div className="mb-5">
            <AiButton action={checkClaude} label="Probar conexión con Claude" pendingLabel="Probando…" />
            <p className="mt-1.5 text-xs text-faint">Hace dos peticiones mínimas con la misma forma que usa la app (coste de céntimos).</p>
          </div>
        ) : null}
        {!ai ? (
          <>
          <p className="mb-5 rounded-lg bg-subtle px-3 py-2 text-[13px] text-muted">
            Sin clave de la API, Claude responde a través de «Chat con Claude» (arriba). Opcional: con <code>ANTHROPIC_API_KEY</code> en Vercel las respuestas son instantáneas, pero se paga aparte por uso. La clave nunca llega al navegador.
          </p>
          </>
        ) : null}
        <AiSettingsForm profile={profile} />
      </Block>

      <Block id="integrations" title="Integraciones" description="Preparadas en la arquitectura; ninguna está activa hasta que la conectes.">
        <ul className="divide-y divide-line rounded-xl border border-line">
          <li className="flex items-start gap-3 p-4">
            <CalendarDays className="mt-0.5 h-4 w-4 text-faint" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                Google Calendar <Badge tone="muted">No conectado</Badge>
              </div>
              <p className="mt-1 text-[13px] text-muted">
                Sincronizará las tareas planificadas con tu calendario. Necesita un proyecto de Google Cloud con OAuth (<code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>) y tu autorización.
                {env.GOOGLE_CLIENT_ID ? " Credenciales detectadas; falta implementar el flujo de autorización." : ""}
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 p-4">
            <Workflow className="mt-0.5 h-4 w-4 text-faint" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                Make <Badge tone="muted">{env.MAKE_WEBHOOK_URL ? "Webhook configurado, sin uso aún" : "No conectado"}</Badge>
              </div>
              <p className="mt-1 text-[13px] text-muted">
                Para automatizaciones (resúmenes diarios, revisiones semanales, recordatorios). Necesita un escenario en Make con un webhook (<code>MAKE_WEBHOOK_URL</code>) y un secreto compartido.
              </p>
            </div>
          </li>
        </ul>
      </Block>

      <Block id="account" title="Cuenta y seguridad" description={`Sesión iniciada como ${user.email}.`}>
        <AccountForms />
      </Block>

      <Block id="privacy" title="Privacidad" description="Tus datos son tuyos.">
        <ul className="mb-5 flex flex-col gap-2 text-[13px] text-muted">
          <li className="flex gap-2">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
            Cada tabla está protegida con Row Level Security: solo tu cuenta autorizada puede leer o escribir sus filas.
          </li>
          <li className="flex gap-2">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
            Claude recibe un resumen de tus objetivos, proyectos, tareas, ideas, decisiones y memoria solo cuando lo usas, desde el servidor. Puedes desactivarlo arriba.
          </li>
          <li className="flex gap-2">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
            Claude nunca modifica datos por su cuenta: todo cambio que propone queda pendiente de tu aprobación.
          </li>
        </ul>
        <a
          href="/api/export"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-subtle px-3.5 text-sm font-medium text-fg hover:bg-hover"
          download
        >
          <Download className="h-4 w-4" /> Exportar todos mis datos (JSON)
        </a>
      </Block>
    </div>
  );
}
