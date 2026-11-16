#!/usr/bin/env bash
# One-shot setup of a Supabase project for GOALS. Run it on your machine, once.
#
#   DATABASE_URL='postgresql://postgres.<ref>:<db-password>@<host>:5432/postgres' \
#   SUPABASE_URL='https://<ref>.supabase.co' \
#   SUPABASE_PUBLISHABLE_KEY='sb_publishable_...' \
#   SUPABASE_SECRET_KEY='sb_secret_...' \
#   OWNER_EMAIL='you@example.com' \
#   ./scripts/setup-production.sh
#
# Where to find them (Supabase dashboard):
#   DATABASE_URL       → Connect → "Session pooler" connection string (with your DB password)
#   SUPABASE_URL, keys → Project Settings → API Keys
#
# It: applies supabase/migrations, authorizes OWNER_EMAIL in the database
# allowlist, creates (or resets the password of) the owner account, and checks
# that the owner can sign in and passes the RLS allowlist. It is idempotent.
# The secret key and DB URL are only used here; never put them in Vercel.
set -euo pipefail
cd "$(dirname "$0")/.."

for v in DATABASE_URL SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY OWNER_EMAIL; do
  if [ -z "${!v:-}" ]; then echo "Falta la variable $v (ver cabecera del script)." >&2; exit 1; fi
done
EMAIL=$(echo "$OWNER_EMAIL" | tr '[:upper:]' '[:lower:]')

if [ -z "${OWNER_PASSWORD:-}" ]; then
  read -r -s -p "Contraseña para $EMAIL (mín. 12 caracteres): " OWNER_PASSWORD; echo
fi
if [ "${#OWNER_PASSWORD}" -lt 12 ]; then echo "La contraseña debe tener al menos 12 caracteres." >&2; exit 1; fi

echo "1/4 Aplicando migraciones…"
npx --yes supabase db push --remote="$DATABASE_URL" --yes

echo "2/4 Autorizando $EMAIL en la base de datos…"
SQL="insert into app_private.authorized_users (email) values (lower(:'email')) on conflict do nothing;"
if command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v email="$EMAIL" -q -c "$SQL" 2>/dev/null \
    || echo "$SQL" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v email="$EMAIL" -q
else
  echo "   psql no está instalado. Ejecuta esto en Supabase → SQL Editor y vuelve a lanzar el script:"
  echo "   insert into app_private.authorized_users (email) values ('$EMAIL') on conflict do nothing;"
  exit 1
fi

echo "3/4 Creando la cuenta del propietario…"
SUPABASE_URL="$SUPABASE_URL" SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" OWNER_PASSWORD="$OWNER_PASSWORD" \
  node scripts/create-owner.mjs "$EMAIL" | head -1

echo "4/4 Comprobando acceso…"
TOKEN=$(curl -sf -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "content-type: application/json" \
  --data "$(node -e 'console.log(JSON.stringify({email:process.argv[1],password:process.argv[2]}))' "$EMAIL" "$OWNER_PASSWORD")" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).access_token||"")}catch{}})') || true
if [ -z "$TOKEN" ]; then echo "   ✗ El propietario no pudo iniciar sesión." >&2; exit 1; fi
AUTH=$(curl -sf -X POST "$SUPABASE_URL/rest/v1/rpc/is_authorized" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" -d '{}' || true)
if [ "$AUTH" != "true" ]; then echo "   ✗ La cuenta inicia sesión pero RLS no la reconoce (respuesta: $AUTH)." >&2; exit 1; fi
echo "   ✓ $EMAIL entra y está autorizado por RLS."

cat <<EOF

Listo. Quedan dos ajustes en el panel de Supabase (Authentication):
  • Sign In / Providers → desactiva «Allow new users to sign up» y sube la longitud mínima de contraseña a 12.
  • URL Configuration → Site URL = la URL de tu despliegue, y añade <esa URL>/auth/callback a Redirect URLs.
Variables para Vercel: NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
                       NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
                       OWNER_EMAIL=$EMAIL
                       ANTHROPIC_API_KEY=<tu clave>   (opcional)
EOF
