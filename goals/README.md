# GOALS

Centro de control personal y privado: objetivos, proyectos, tareas, ideas, planificación diaria y analíticas, con Claude como cerebro estratégico. Una sola persona autorizada; no es un SaaS.

- **Stack:** Next.js 16 (App Router, Server Actions, Cache Components) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, RLS) · Claude API (`@anthropic-ai/sdk`) · PWA · Vercel.
- **Principios:** datos reales en base de datos, seguridad por defecto, y Claude **propone** pero nunca cambia nada sin tu aprobación explícita.

## Módulos

| Ruta | Qué hace |
|---|---|
| `/` Dashboard | Objetivo principal, prioridades de hoy, pendientes, proyectos activos, indicadores de la semana, actividad reciente y la recomendación diaria de Claude. |
| `/brain` AI Brain | Chat persistente con Claude que conoce tus datos. Propone crear o cambiar objetivos, proyectos, tareas, ideas, decisiones y recuerdos; cada propuesta se aprueba o rechaza una a una. |
| `/brain/memory` | Memoria a largo plazo separada por certeza (información confirmada · ideas · recomendaciones · decisiones aprobadas), registro de decisiones, propuestas pendientes y revisión semanal. |
| `/goals` | Objetivos con categoría, prioridad, estado, fecha, métrica con historial (check-ins) y progreso por proyectos, métrica o manual. Crear, editar, pausar, completar. |
| `/projects` | Proyectos (idea → planificado → activo → pausado → completado/cancelado) con objetivo, tareas, progreso, tiempo, notas y resultados. |
| `/tasks` | Tareas por urgencia, hoy, semana y proyecto; captura rápida, tiempo estimado e invertido. |
| `/planner` | El día: tres prioridades, objetivos del día, tareas programadas y completadas, tiempo, intención y resumen. Claude propone un plan realista que tú aplicas o descartas. |
| `/ideas` | Ideas Vault: potencial, dificultad, coste, estado y evaluación estructurada de Claude. Nunca se borran solas; convertir una idea en proyecto la conserva vinculada. |
| `/analytics` | Evolución semanal y mensual, últimos 30 días, horas por semana, tiempo por proyecto y progreso por objetivo, todo calculado desde la base de datos. |
| `/settings` | Perfil, zona horaria, capacidad diaria, tema, IA, integraciones, cuenta (contraseña, cerrar todas las sesiones) y exportación de todos tus datos. |

## Arquitectura

```
src/
  proxy.ts                  Primer filtro: refresca la sesión y redirige a /login
  app/(auth)/login          Acceso (contraseña o enlace mágico), solo el propietario
  app/(app)/…               Pantallas privadas (cada una con su <Suspense>)
  app/api/ai/chat           Chat en streaming (NDJSON) con bucle de herramientas
  app/api/export            Descarga JSON de todos tus datos
  lib/auth.ts               Data Access Layer: verifica JWT + email del propietario
  lib/data.ts               Consultas (siempre como el usuario → RLS)
  lib/actions/*             Server Actions: auth → zod → escritura → refresh()
  lib/validation.ts         Esquemas zod compartidos por formularios y propuestas de IA
  lib/ai/                   Cliente, contexto, prompts, herramientas, propuestas, historial
supabase/migrations         Esquema SQL completo con RLS
supabase/tests              Tests pgTAP de RLS e integridad
tests/unit                  Vitest
tests/e2e                   Prueba de extremo a extremo + API de Anthropic simulada
```

### Seguridad

- **Autenticación obligatoria** (Supabase Auth). Registro cerrado; un único `OWNER_EMAIL`.
- **Tres cerrojos independientes:** `proxy.ts` (redirige sin sesión) → `lib/auth.ts` en cada página, Server Action y Route Handler (JWT verificado con `getClaims()` + email del propietario) → **RLS** en todas las tablas: una fila solo es visible para su dueño *y* si su email está en `app_private.authorized_users`, un esquema que la API no expone.
- Integridad entre tablas con claves foráneas compuestas `(id, user_id)`: una tarea no puede apuntar a un proyecto ajeno.
- Validación con zod en servidor de toda entrada (formularios y propuestas de Claude).
- La clave de Anthropic solo existe en el servidor; el navegador nunca habla con la API de Claude.
- Cabeceras: CSP, `X-Frame-Options: DENY`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `noindex`.
- Cierre de sesión y demás mutaciones como Server Actions (comprobación de origen de Next, sin CSRF).
- El service worker **no** cachea páginas privadas ni respuestas de la API.

### Claude

- Modelo por defecto `claude-opus-5-5` (cambiable con `ANTHROPIC_MODEL`), pensamiento adaptativo, esfuerzo configurable en Ajustes, `fallbacks: "default"` (si el modelo declina por política, la API reintenta en el modelo de respaldo recomendado).
- **Contexto:** en cada mensaje se envía un resumen de tus datos, etiquetado por certeza (1 información confirmada · 2 ideas · 3 recomendaciones previas · 4 decisiones). Va como mensaje de sistema a mitad de conversación para que el prompt fijo y el historial se sirvan desde la caché.
- **Solo propone:** las únicas herramientas son `propose_*`. Cada llamada crea una fila en `ai_proposals` con estado `pending`; no hay herramientas de borrado. Al aprobar, la propuesta pasa por los mismos esquemas zod que los formularios y se aplica con tu sesión (RLS).
- **Respuestas estructuradas validadas** (evaluación de ideas, recomendación diaria, plan del día, revisión semanal): esquema zod enviado como formato de salida y validado de nuevo al recibir. Los IDs de tareas que devuelve Claude se comprueban contra la base de datos antes de usarlos.
- **Historial *append-only*:** cada turno se guarda tal cual (incluidos bloques de razonamiento y llamadas a herramientas) y se reenvía sin cambios; si un turno se corta, las llamadas pendientes se cierran con un resultado de error para que el historial siga siendo válido.

## Instalación local

Requisitos: Node 20.9+ y Docker (para Supabase local).

```bash
cd goals
npm install
cp .env.example .env.local
npm run db:start            # arranca Supabase local y aplica supabase/migrations
npx supabase status         # copia API_URL y PUBLISHABLE_KEY a .env.local
```

En `.env.local` pon `OWNER_EMAIL=owner@goals.local` (el seed local ya lo autoriza) y crea la cuenta:

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY=<SECRET_KEY de supabase status> \
  npm run db:create-owner -- owner@goals.local
npm run dev                 # http://localhost:3000
```

Para usar Claude añade `ANTHROPIC_API_KEY` a `.env.local`. Sin ella, todo funciona salvo las funciones de IA, que lo indican.

## Pruebas

```bash
npm run typecheck && npm run lint
npm test                    # Vitest: validación, fechas/zonas horarias, propuestas, historial
npm run test:db             # pgTAP: RLS (propietario, intruso con cuenta, anónimo) e integridad
```

La CI (`.github/workflows/ci.yml`) ejecuta todo esto, la compilación de producción y la prueba de extremo a extremo en cada push.

Prueba de extremo a extremo (26 pasos a 400 px, incluido el flujo de IA con aprobación). Usa una **API de Anthropic simulada** que también rechaza historiales inválidos, así que no gasta dinero ni necesita clave. **Borra la base de datos local.**

```bash
npm run mock:ai                                    # terminal 1
ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm run dev   # terminal 2
npm i -D playwright && npx playwright install chromium   # una vez
npm run test:e2e                                   # terminal 3
```

## Despliegue rápido (≈10 minutos)

1. **Supabase:** crea un proyecto gratuito en [supabase.com](https://supabase.com) (región Frankfurt, por ejemplo). Guarda la contraseña de la base de datos.
2. **Base de datos y cuenta, con un solo comando** desde esta carpeta. El script está probado: aplica el esquema, autoriza tu email en RLS, crea tu cuenta y comprueba que puedes entrar. Puedes repetirlo sin riesgo.
   ```bash
   npm install
   DATABASE_URL='<Connect → Session pooler>' SUPABASE_URL='https://<ref>.supabase.co' \
   SUPABASE_PUBLISHABLE_KEY='sb_publishable_…' SUPABASE_SECRET_KEY='sb_secret_…' \
   OWNER_EMAIL='tu@email.com' ./scripts/setup-production.sh
   ```
3. **Vercel:** este botón crea **un repositorio nuevo en tu GitHub solo con GOALS** y lo despliega. Te pedirá las 3 variables que imprime el script:

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FPindaklaas%2Fhome-reps%2Ftree%2Fccr-67ad940b-2udifo%2Fgoals&project-name=goals&repository-name=goals&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,OWNER_EMAIL&envDescription=URL%20y%20publishable%20key%20de%20tu%20proyecto%20Supabase%2C%20y%20el%20email%20del%20propietario&envLink=https%3A%2F%2Fgithub.com%2FPindaklaas%2Fhome-reps%2Fblob%2Fccr-67ad940b-2udifo%2Fgoals%2F.env.example)

   Después añade `ANTHROPIC_API_KEY` en Project Settings → Environment Variables y vuelve a desplegar.
4. **Supabase → Authentication:** desactiva el registro de usuarios nuevos, pon la URL de Vercel como *Site URL* y añade `<url>/auth/callback` a *Redirect URLs*.
5. Abre la URL en el móvil → «Añadir a pantalla de inicio».

El paso a paso manual equivalente está en la sección siguiente.

## Despliegue paso a paso (Supabase + Vercel)

1. **Supabase:** crea un proyecto en supabase.com (región cercana, p. ej. Frankfurt). Luego:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push        # aplica supabase/migrations
   ```
2. **Cierra el registro:** Authentication → Sign In / Providers → desactiva *Allow new users to sign up*. Sube la longitud mínima de contraseña a 12.
3. **Crea tu cuenta:** Authentication → Users → *Add user* (con contraseña y *Auto Confirm*), o `npm run db:create-owner` con la URL y la *secret key* del proyecto, desde tu máquina.
4. <a id="autorizar"></a>**Autorizar al propietario** (SQL Editor):
   ```sql
   insert into app_private.authorized_users (email) values ('tu-email@ejemplo.com');
   ```
5. **URLs de Auth:** Authentication → URL Configuration → *Site URL* `https://tu-dominio` y *Redirect URLs* `https://tu-dominio/auth/callback`.
6. **Vercel:** importa el repositorio, *Root Directory* = `goals` si sigue dentro de este repo, y define `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `OWNER_EMAIL` y, si quieres IA, `ANTHROPIC_API_KEY`. No añadas la *secret key* de Supabase.
7. Abre la web en el móvil y usa «Añadir a pantalla de inicio» para instalarla como app.

> El chat usa `maxDuration = 300` s; en el plan Hobby de Vercel el máximo efectivo puede ser menor.

## Claude Code como cerebro (sin clave de Anthropic)

Mientras no haya `ANTHROPIC_API_KEY`, una sesión de Claude Code en el entorno «goals» hace de cerebro: pídele «actúa como el cerebro de GOALS» (skill `.claude/skills/goals-brain`). Usa `scripts/brain.mjs` para leer tus datos y escribir en la app la recomendación del día, planes, evaluaciones de ideas, revisiones semanales y **propuestas** que apruebas tú en AI Brain → conversación «Claude Code». Valida con los mismos esquemas que la app y nunca cambia tus datos directamente.

## Integraciones (preparadas, no activas)

Nada de esto está conectado ni simulado; Ajustes muestra su estado real.

| Integración | Para qué | Qué hará falta |
|---|---|---|
| Google Calendar | Llevar tareas planificadas al calendario | Proyecto en Google Cloud, pantalla de consentimiento OAuth, `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, URI de redirección `/api/integrations/google/callback`, y tu autorización. Los tokens irían cifrados (Supabase Vault), nunca en el navegador. |
| Make | Resúmenes diarios, revisión semanal, recordatorios | Escenario en Make con webhook (`MAKE_WEBHOOK_URL`) y un secreto compartido para firmar las llamadas en ambos sentidos. |
| Notificaciones | Recordatorios | La tabla `notifications` ya existe (canales `in_app`, `email`, `push`). Para push: claves VAPID y el evento `push` en `public/sw.js`. Para email: un proveedor (p. ej. Resend) y su clave. |
| Tareas programadas | Resumen diario / revisión semanal automáticos | Vercel Cron o Make llamando a una ruta protegida con `CRON_SECRET`. |
