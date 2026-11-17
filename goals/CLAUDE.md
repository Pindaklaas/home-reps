@AGENTS.md

# GOALS: notes for Claude

Private single-user productivity app. Read README.md for the module map and architecture.

## Rules that must not break
- **Every read and write goes through the user's session** (`lib/supabase/server.ts` → RLS). Never add a service-role/secret-key client to the app. `SUPABASE_SECRET_KEY` is only for `scripts/create-owner.mjs`.
- **Verify the owner in every entry point**: pages via `getAppContext()`/`requireUser()`, Server Actions via `runAction()`, Route Handlers via `getCurrentUser()`. `proxy.ts` is only a first gate.
- **Validate input with the zod schemas in `lib/validation.ts`**. AI proposals are applied through the same schemas (`lib/ai/proposals.ts`).
- **Claude never writes directly.** Its only tools are `propose_*` in `lib/ai/tools.ts`; they create `ai_proposals` rows with status `pending`. Do not add delete tools or auto-apply paths. Approval is a user click (`approveProposal`).
- **Chat history is append-only** (`lib/ai/history.ts`): store and replay `api_content` unchanged; close dangling `tool_use` blocks; a mid-conversation `system` message must be last or followed by an assistant turn.
- Never invent integrations: Google Calendar and Make are documented but not connected.
- Ideas are never removed automatically (no cascade reaches `ideas` except deleting the auth user).

## Next.js 16 specifics used here
- `cacheComponents` + `partialPrefetching` are on. Anything that reads cookies, `searchParams`, `params` or `usePathname()` must sit inside a `<Suspense>` **within the page** (a parent layout's `loading.tsx` does not cover client navigations). Pattern: static `PageHeader` + `<Suspense><Content/></Suspense>`.
- `getCurrentUser()` calls `connection()` first (JWT expiry uses the current time).
- Middleware is `src/proxy.ts`. After mutations call `refresh()` (done by `runAction`).
- Server Components cannot pass functions to Client Components (no render props, no `format` callbacks); use serializable props.
- Forms use `useFormAction`/`ActionForm` (submit from `onSubmit`) so React does not reset typed values when validation fails.

## Data
- Schema: `supabase/migrations/*.sql`. After changing it: `npm run db:reset && npm run db:types`, and extend `supabase/tests/rls.test.sql` (RLS on every new table, composite FKs `(x_id, user_id)`).
- Calendar dates are `YYYY-MM-DD` strings in the profile's time zone (`lib/dates.ts`); use `dayBoundsUtc` to compare timestamps with a local day.

## Design
- Dark first. Use the CSS tokens in `globals.css` via Tailwind (`bg-surface`, `text-muted`, `border-line`, `text-accent`…), never literal colors. Check light mode too.
- Prefer lists and sections over cards. Test at ~400 px width.
- Charts are single-series SVG (`components/charts`), one axis, hover tooltip and a hidden data table.

## Production
- Deployed on Vercel (project `goals`) with a Supabase project named «GOALS». Account details live only in the owner's accounts and the «goals» cloud environment, never in this public repo.
- The cloud environment «goals» injects the Supabase and Vercel tokens. Node's fetch needs `NODE_USE_ENV_PROXY=1` there.
- Redeploy / apply new migrations: `NODE_USE_ENV_PROXY=1 OWNER_EMAIL=<owner email> node scripts/deploy-cloud.mjs` (idempotent; ask the owner for the email, do not write it to files).
- Without `ANTHROPIC_API_KEY` the in-app AI is off and **Claude Code acts as the brain** through `scripts/brain.mjs` (skill `goals-brain`). Same rules: read context first, only propose, the owner approves in the app.

## Checks before committing
`npm run typecheck && npm run lint && npm test && npm run test:db && npm run build`, and `npm run test:e2e` for UI or AI changes (see README; it wipes the local DB).
