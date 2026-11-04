// Tests for what the server does with each event (supabase/functions/_shared/submit.mjs), with an in-memory database.
// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleEvent } from '../supabase/functions/_shared/submit.mjs';

const T0 = Date.parse('2026-11-04T07:30:00');
function memDb(){
  const m = {profiles:{a:{nickname:'ana_fit', flagged:false}, b:{nickname:'Jorge', flagged:false}, c:{nickname:'Sara', flagged:false}},
    content:{'ab-pushup':{type:'ab', body:{correct:'a'}}, 'tip-sleep':{type:'tip', body:{}}},
    events:[], xp:[], points:[], sessions:[], answers:[], tips:[], leagues:{a:['L'], b:['L'], c:['L']}, tokens:{b:['tok-b'], c:['tok-c']}, pushes:[]};
  const total = uid => m.xp.filter(x => x.user_id === uid).reduce((n, x) => n + x.xp, 0);
  return {m, total, db:{
    profile:async uid => m.profiles[uid] ? {...m.profiles[uid], restDays:[]} : null,
    recentEventTimes:async uid => m.events.filter(e => e.user_id === uid).map(e => e.t),
    content:async id => m.content[id] || null,
    ledger:async uid => m.xp.filter(x => x.user_id === uid).map(x => ({kind:x.kind, xp:x.xp, ref:x.ref, at:x.at})),
    sessions:async uid => m.sessions.filter(s => s.user_id === uid).map(s => ({move:s.move, reps:s.reps, gaps:s.gaps, endedAt:s.ended_at})),
    answered:async uid => m.answers.filter(a => a.user_id === uid).map(a => a.ab_id),
    saveEvent:async row => { m.events.push({...row, t:m.now}); return 'e' + m.events.length; },
    addAnswer:async row => { m.answers.push(row); }, addTipRead:async row => { m.tips.push(row); },
    addSession:async row => { m.sessions.push(row); }, flag:async (uid, why) => { m.profiles[uid].flagged = true; m.profiles[uid].why = why; },
    addXp:async rows => { rows.forEach(r => m.xp.push({...r, at:new Date(m.now).toISOString()})); }, addPoints:async rows => { m.points.push(...rows); },
    leagueMates:async uid => Object.keys(m.leagues).filter(u => m.leagues[u].some(l => m.leagues[uid].includes(l))).map(u => ({user_id:u, xp:total(u), flagged:m.profiles[u].flagged})),
    pushTokens:async uids => uids.flatMap(u => (m.tokens[u] || []).map(token => ({token, user_id:u}))),
    sendPush:async msgs => { m.pushes.push(...msgs); }
  }};
}
const call = async (x, uid, ev, now) => { x.m.now = now || T0; return (await handleEvent(x.db, uid, ev, x.m.now, () => 0)); };
const alarm = (reps, now, gap = 1500) => ({kind:'alarm', verified:true, move:'pushup', reps, repTimes:Array.from({length:reps}, (_, i) => 1000 + i * gap),
  startedAt:new Date(now - reps * gap - 3000).toISOString(), endedAt:new Date(now - 1000).toISOString(), conf:.9});

test('a real alarm session earns XP on the server, with the streak bonus', async () => {
  const x = memDb(), r = await call(x, 'a', alarm(12, T0));
  assert.equal(r.status, 200); assert.equal(r.body.accepted, true); assert.equal(r.body.xp, 52);
  assert.equal(x.total('a'), 52); assert.equal(x.m.sessions.length, 1);
});

test('the app cannot backdate or invent session times', async () => {
  const x = memDb(), ev = alarm(10, T0 - 3600000);
  const r = await call(x, 'a', ev);
  assert.equal(r.body.why, 'bad_times'); assert.equal(x.total('a'), 0);
});

test('a superhuman session is rejected and the account leaves the rankings', async () => {
  const x = memDb(), r = await call(x, 'a', {...alarm(60, T0, 500), startedAt:new Date(T0 - 20000).toISOString()});
  assert.equal(r.body.accepted, false); assert.equal(x.total('a'), 0);
  assert.equal(x.m.profiles.a.flagged, true);
});

test('A/B: the server decides what is correct, one answer per person', async () => {
  const x = memDb(), r = await call(x, 'a', {kind:'ab', id:'ab-pushup', choice:'b'});
  assert.equal(r.body.correct, 'a'); assert.equal(r.body.xp, 5); assert.equal(x.m.answers[0].correct, false);
  const again = await call(x, 'a', {kind:'ab', id:'ab-pushup', choice:'a'}, T0 + 86400000);
  assert.equal(again.body.why, 'already_answered'); assert.equal(x.m.answers.length, 1);
  assert.equal((await call(x, 'a', {kind:'ab', id:'nope', choice:'a'})).status, 404);
});

test('rate limit: the 21st event in a minute is refused', async () => {
  const x = memDb(); let last;
  for (let i = 0; i < 21; i++) last = await call(x, 'a', {kind:'meal', id:'m' + i}, T0 + i);
  assert.equal(last.status, 429);
});

test('level-ups write points once per level', async () => {
  const x = memDb();
  await call(x, 'a', {kind:'challenge', id:'c1', xp:150});
  assert.deepEqual(x.m.points.map(p => [p.level, p.pts]), [[2, 20]]);
});

test('passing league mates sends each of them a push, every time', async () => {
  const x = memDb();
  x.m.xp.push({user_id:'b', kind:'legacy', xp:30, at:new Date(T0).toISOString()}, {user_id:'c', kind:'legacy', xp:500, at:new Date(T0).toISOString()});
  const r = await call(x, 'a', alarm(10, T0));
  assert.equal(r.body.pushed, 1);
  assert.equal(x.m.pushes[0].to, 'tok-b'); assert.match(x.m.pushes[0].body, /^ana_fit /);
});

test('unknown events and missing profiles are refused', async () => {
  const x = memDb();
  assert.equal((await call(x, 'a', {kind:'hack', xp:9999})).status, 400);
  assert.equal((await call(x, 'zz', {kind:'meal'})).status, 403);
});
