// POST /functions/v1/delete-account  (Authorization: Bearer <user's access token>)
// Deletes the signed-in account and, through the foreign keys, every row that belongs to it. Required by the App Store and GDPR.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey' };

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });
  const { data: { user } } = await admin.auth.getUser((req.headers.get('Authorization') || '').replace(/^Bearer /, ''));
  if (!user) return Response.json({ error: 'sign in first' }, { status: 401, headers: cors });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return Response.json({ error: 'could not delete' }, { status: 500, headers: cors });
  return Response.json({ deleted: true }, { headers: cors });
});
