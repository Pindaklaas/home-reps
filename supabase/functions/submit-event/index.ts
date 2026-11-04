// POST /functions/v1/submit-event  (Authorization: Bearer <user's access token>)
// Body: one event, e.g. {kind:'alarm', verified:true, move:'pushup', reps:12, repTimes:[...], startedAt, endedAt, conf}
// The rules live in ../_shared/submit.mjs and ../_shared/game-core.mjs (the same game-core as the app).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleEvent } from '../_shared/submit.mjs';

const url = Deno.env.get('SUPABASE_URL')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, service, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey' };
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function must<T>(r: { data: T; error: unknown }): T { if (r.error) throw r.error; return r.data; }

// The data layer handleEvent needs, on top of Supabase (service role: it is the only writer of ledgers).
const db = {
  async profile(uid: string) {
    const p = must(await admin.from('profiles').select('nickname, flagged, answers').eq('id', uid).maybeSingle());
    if (!p) return null;
    const days: string[] = (p.answers && p.answers.days) || [];
    return { nickname: p.nickname, flagged: p.flagged, restDays: days.length ? [0, 1, 2, 3, 4, 5, 6].filter(i => !days.includes(DAYS[i])) : [] };
  },
  async recentEventTimes(uid: string) {
    const rows = must(await admin.from('events').select('created_at').eq('user_id', uid).gte('created_at', new Date(Date.now() - 60000).toISOString()));
    return rows.map((r: { created_at: string }) => Date.parse(r.created_at));
  },
  async content(id: string) { return must(await admin.from('content').select('type, body').eq('id', id).eq('published', true).maybeSingle()); },
  async ledger(uid: string) {
    const rows = must(await admin.from('xp_ledger').select('kind, xp, ref, created_at').eq('user_id', uid).order('created_at'));
    return rows.map((r: { kind: string; xp: number; ref: string | null; created_at: string }) => ({ kind: r.kind, xp: r.xp, ref: r.ref, at: r.created_at }));
  },
  async sessions(uid: string) {
    const rows = must(await admin.from('sessions').select('move, reps, gaps, ended_at').eq('user_id', uid).order('ended_at', { ascending: false }).limit(60));
    return rows.map((r: { move: string; reps: number; gaps: number[]; ended_at: string }) => ({ move: r.move, reps: r.reps, gaps: r.gaps, endedAt: r.ended_at }));
  },
  async answered(uid: string) { return must(await admin.from('ab_answers').select('ab_id').eq('user_id', uid)).map((r: { ab_id: string }) => r.ab_id); },
  async saveEvent(row: Record<string, unknown>) { return must(await admin.from('events').insert(row).select('id').single()).id; },
  async addAnswer(row: Record<string, unknown>) { await admin.from('ab_answers').insert(row); },
  async addTipRead(row: Record<string, unknown>) { await admin.from('tips_read').upsert(row, { ignoreDuplicates: true }); },
  async addSession(row: Record<string, unknown>) { must(await admin.from('sessions').insert(row)); },
  async flag(uid: string, reason: string) { must(await admin.from('profiles').update({ flagged: true, flagged_reason: reason }).eq('id', uid)); },
  async addXp(rows: Record<string, unknown>[]) { must(await admin.from('xp_ledger').insert(rows)); },
  async addPoints(rows: Record<string, unknown>[]) { must(await admin.from('points_ledger').insert(rows)); },
  async leagueMates(uid: string) {
    const mine = must(await admin.from('league_members').select('league_id').eq('user_id', uid)).map((r: { league_id: string }) => r.league_id);
    if (!mine.length) return [];
    const ids = [...new Set(must(await admin.from('league_members').select('user_id').in('league_id', mine)).map((r: { user_id: string }) => r.user_id))];
    const scores = must(await admin.rpc('scores')) as { user_id: string; xp_total: number }[];
    const flagged = new Set(must(await admin.from('profiles').select('id').in('id', ids).eq('flagged', true)).map((r: { id: string }) => r.id));
    return ids.map(id => ({ user_id: id, xp: (scores.find(s => s.user_id === id) || { xp_total: 0 }).xp_total, flagged: flagged.has(id) }));
  },
  async pushTokens(uids: string[]) { return must(await admin.from('push_tokens').select('token, user_id').in('user_id', uids)); },
  async sendPush(messages: unknown[]) {
    // Expo push service: works for both iOS and Android once the app registers its Expo push token.
    for (let i = 0; i < messages.length; i += 100)
      await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(messages.slice(i, i + 100)) });
  },
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return Response.json({ error: 'sign in first' }, { status: 401, headers: cors });
  let ev: unknown; try { ev = await req.json(); } catch { return Response.json({ error: 'bad json' }, { status: 400, headers: cors }); }
  try {
    const r = await handleEvent(db, user.id, ev, Date.now(), Math.random);
    return Response.json(r.body, { status: r.status, headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'server error' }, { status: 500, headers: cors });
  }
});
