// What the server does with one event from the app. Plain JavaScript with no Deno or database code,
// so it runs in the submit-event function and in the Node tests (tests/submit.test.mjs).
// `db` is the data layer (see submit-event/index.ts for the Supabase version).
import { GAME, awardFor, checkSession, levelInfo, levelUps, isSuspicious, overtakeLine, rateOk, sumXp } from './game-core.mjs';

const KINDS = ['alarm', 'tip', 'ab', 'questionnaire', 'workout', 'meal', 'challenge'];
const MAX_AGE_MS = 15 * 60000;      // an alarm session must have ended in the last 15 minutes
const MAX_SESSION_MS = 2 * 3600000;

// Keep only the fields each kind needs; the server sets the time.
function clean(ev, now){
  const at = new Date(now).toISOString(), id = String(ev.id || '').slice(0, 80) || null;
  if (ev.kind === 'alarm'){
    const verified = !!ev.verified, reps = Math.max(0, Math.floor(+ev.reps || 0));
    return {kind:'alarm', id, at, verified, move:ev.move === 'squat' ? 'squat' : ev.move === 'pushup' ? 'pushup' : String(ev.move || ''), reps:verified ? reps : 0,
      repTimes:verified && Array.isArray(ev.repTimes) ? ev.repTimes.slice(0, 500).map(x => Math.round(+x)) : [],
      startedAt:String(ev.startedAt || ''), endedAt:String(ev.endedAt || ''), conf:ev.conf == null ? null : +ev.conf};
  }
  if (ev.kind === 'ab') return {kind:'ab', id, at, choice:['a', 'b', 'c'].includes(ev.choice) ? ev.choice : 'a'};
  if (ev.kind === 'challenge') return {kind:'challenge', id, at, xp:Math.max(0, Math.floor(+ev.xp || 0))};
  return {kind:ev.kind, id, at};
}

export async function handleEvent(db, uid, raw, now, rand){
  now = now == null ? Date.now() : now; rand = rand || Math.random;
  if (!raw || !KINDS.includes(raw.kind)) return {status:400, body:{error:'unknown event'}};
  const profile = await db.profile(uid);
  if (!profile) return {status:403, body:{error:'make a profile first'}};
  if (!rateOk(await db.recentEventTimes(uid), now)) return {status:429, body:{error:'too many events, slow down'}};
  const ev = clean(raw, now);

  // Times claimed by the app must make sense against the server clock.
  if (ev.kind === 'alarm' && ev.verified){
    const s = Date.parse(ev.startedAt), e = Date.parse(ev.endedAt);
    if (!(s < e) || e > now + 60000 || now - e > MAX_AGE_MS || e - s > MAX_SESSION_MS){
      await db.saveEvent({user_id:uid, kind:ev.kind, payload:ev, accepted:false, why:'bad_times', flags:['bad_times']});
      return {status:200, body:{accepted:false, why:'bad_times', xp:0}};
    }
  }
  // Tips and A/B challenges must exist; the server decides what's correct.
  let item = null;
  if (ev.kind === 'tip' || ev.kind === 'ab'){
    item = await db.content(ev.id);
    if (!item || item.type !== ev.kind) return {status:404, body:{error:'no such ' + ev.kind}};
  }

  const ledger = await db.ledger(uid), before = sumXp(ledger);
  const r = awardFor(ev, {ledger, sessions:await db.sessions(uid), answered:await db.answered(uid), restDays:profile.restDays || []});
  const accepted = r.rows.length > 0;
  const eventId = await db.saveEvent({user_id:uid, kind:ev.kind, payload:ev, accepted, why:r.why, flags:r.flags});

  if (ev.kind === 'ab' && r.why !== 'already_answered') await db.addAnswer({user_id:uid, ab_id:ev.id, choice:ev.choice, correct:ev.choice === (item.body || {}).correct});
  if (ev.kind === 'tip' && r.why !== 'already_read') await db.addTipRead({user_id:uid, tip_id:ev.id});
  if (ev.kind === 'alarm' && ev.verified) await db.addSession({user_id:uid, move:ev.move, reps:ev.reps, gaps:checkSession(ev, []).gaps, ended_at:ev.endedAt});
  if (isSuspicious(r.flags) && !profile.flagged){ await db.flag(uid, r.flags.join(',')); profile.flagged = true; }

  if (accepted) await db.addXp(r.rows.map(x => ({user_id:uid, kind:x.kind, xp:x.xp, ref:x.ref == null ? null : String(x.ref), event_id:eventId})));
  const after = before + sumXp(r.rows), ups = levelUps(before, after, ev.at);
  if (ups.length) await db.addPoints(ups.map(u => ({user_id:uid, pts:u.pts, reason:u.reason, level:u.level})));

  // Everyone in my leagues I just passed gets a push. No limit: every overtake is news.
  let pushed = 0;
  if (after > before && !profile.flagged){
    const mates = (await db.leagueMates(uid)).filter(m => m.user_id !== uid && !m.flagged && m.xp >= before && m.xp < after);
    if (mates.length){
      const tokens = await db.pushTokens(mates.map(m => m.user_id));
      const msgs = tokens.map(t => ({to:t.token, title:'Home Reps', body:overtakeLine(profile.nickname, rand()), sound:'default', data:{type:'overtake', by:profile.nickname}}));
      if (msgs.length){ await db.sendPush(msgs); pushed = msgs.length; }
    }
  }
  const L = levelInfo(after);
  return {status:200, body:{accepted, why:r.why, xp:after - before, total:after, level:L.level, into:L.into, need:L.need,
    levelUps:ups.map(u => ({level:u.level, points:u.pts})), correct:ev.kind === 'ab' ? (item.body || {}).correct : undefined, pushed}};
}

export { GAME };
