#!/usr/bin/env bash
# Full local E2E run against a fresh database and the mock Anthropic API.
# Requires: `npx supabase start` running, the dev server started with
#   ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm run dev
# and `node tests/e2e/mock-anthropic.mjs` running. WIPES the LOCAL database.
set -euo pipefail
cd "$(dirname "$0")/../.."
STATUS=$(npx supabase status -o env 2>/dev/null)
SECRET=$(echo "$STATUS" | grep '^SECRET_KEY=' | cut -d= -f2- | tr -d '"')
API=$(echo "$STATUS" | grep '^API_URL=' | cut -d= -f2- | tr -d '"')
npx supabase db reset >/dev/null
PUBLISHABLE=$(echo "$STATUS" | grep '^PUBLISHABLE_KEY=' | cut -d= -f2- | tr -d '"')
# Auth restarts in the background after a reset: retry until the owner can sign in.
for i in $(seq 1 30); do
  SUPABASE_URL="$API" SUPABASE_SECRET_KEY="$SECRET" OWNER_PASSWORD="local-owner-password-123" \
    node scripts/create-owner.mjs owner@goals.local >/dev/null 2>&1 || true
  TOKEN=$(curl -sf -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $PUBLISHABLE" \
    -H "content-type: application/json" -d '{"email":"owner@goals.local","password":"local-owner-password-123"}' \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).access_token||"")}catch{}})' || true)
  # PostgREST also reloads its schema cache after a reset: wait until the allowlist check answers true.
  if [ -n "$TOKEN" ] && [ "$(curl -sf -X POST "$API/rest/v1/rpc/is_authorized" -H "apikey: $PUBLISHABLE" \
    -H "authorization: Bearer $TOKEN" -H "content-type: application/json" -d '{}' || true)" = "true" ]; then
    break
  fi
  sleep 2
done
node tests/e2e/smoke.cjs
