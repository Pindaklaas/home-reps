// Tests for XP, levels, points, caps, anti-cheat checks and rankings (game-core) and the hidden MÁSTER unlock (master-core).
// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = (name) => html.split(`/* ${name}:start`)[1].split(`/* ${name}:end */`)[0].replace(/^[^\n]*\n/, '');
const ctx = {};
vm.runInNewContext(block('game-core') + block('master-core') + '\nObject.assign(this, {GAME, xpForLevel, levelInfo, levelUps, pointsForLevel, gDay, weekKey, activeStreak, checkSession, rateOk, awardFor, rankPlayers, around, whoPassed, overtakeLine, nickOk, sumXp, weekXp, MASTER, masterUnlocks});', ctx);
const { GAME, xpForLevel, levelInfo, levelUps, gDay, weekKey, activeStreak, checkSession, rateOk, awardFor, rankPlayers, around, whoPassed, overtakeLine, nickOk, sumXp, weekXp, MASTER, masterUnlocks } = ctx;
const J = x => JSON.parse(JSON.stringify(x));
const at = (d, h = 8) => new Date(2026, 10, d, h, 0, 0).toISOString();   // November 2026
// A believable camera session: one rep every 1.5 s with a little jitter.
const session = (reps, d = 4, jitter = 0) => {
  const repTimes = Array.from({length:reps}, (_, i) => 1200 + i * 1500 + (i % 3) * jitter);
  return {kind:'alarm', verified:true, move:'pushup', reps, repTimes, startedAt:at(d), endedAt:new Date(new Date(at(d)).getTime() + reps * 1500 + 2000).toISOString(), conf:.9, at:at(d), id:'s' + d};
};

test('level curve: 100 × level^1.5 per level, growing smoothly', () => {
  assert.equal(xpForLevel(1), 100);
  assert.equal(xpForLevel(2), 283);
  assert.equal(xpForLevel(4), 800);
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(99).level, 1);
  assert.equal(levelInfo(100).level, 2);
  assert.equal(levelInfo(383).level, 3);
  assert.equal(levelInfo(150).into, 50);
});

test('points: 10 × level for every level crossed, one ledger row each', () => {
  const rows = levelUps(90, 400, 'x');
  assert.deepEqual(J(rows.map(r => [r.level, r.pts])), [[2, 20], [3, 30]]);
  assert.equal(levelUps(100, 150, 'x').length, 0);
});

test('alarm: 30 XP + 1 per valid rep, only once a day, plus the streak bonus', () => {
  const r = awardFor(session(12), {ledger:[]});
  assert.deepEqual(J(r.rows.map(x => [x.kind, x.xp])), [['alarm', 42], ['streak', 10]]);
  const again = awardFor({...session(12), id:'b'}, {ledger:r.rows});
  assert.equal(again.why, 'daily_cap');
  assert.equal(again.rows.length, 0);
});

test('alarm counted by tapping (no camera) earns the small base only', () => {
  const r = awardFor({kind:'alarm', verified:false, reps:10, at:at(4)}, {ledger:[]});
  assert.equal(r.rows[0].xp, GAME.xp.alarmTap);
});

test('streak bonus: +10 per day in a row, capped at +50, rest days do not break it', () => {
  assert.equal(activeStreak(['2026-11-02', '2026-11-03', '2026-11-04'], '2026-11-04'), 3);
  assert.equal(activeStreak(['2026-11-01', '2026-11-03', '2026-11-04'], '2026-11-04'), 2);
  // 2026-11-02 is a Monday: as a rest day it bridges Sunday to Tuesday.
  assert.equal(activeStreak(['2026-11-01', '2026-11-03'], '2026-11-03', [1]), 2);
  let ledger = [];
  for (let d = 1; d <= 8; d++) ledger = ledger.concat(awardFor(session(10, d, d), {ledger}).rows);
  const bonus = ledger.filter(e => e.kind === 'streak').map(e => e.xp);
  assert.deepEqual(J(bonus), [10, 20, 30, 40, 50, 50, 50, 50]);
});

test('tips: 2 XP, 3 a day, each tip once', () => {
  let ledger = [];
  ['a', 'b', 'c', 'd'].forEach(id => { ledger = ledger.concat(awardFor({kind:'tip', id, at:at(4)}, {ledger}).rows); });
  assert.equal(sumXp(ledger), 6);
  assert.equal(awardFor({kind:'tip', id:'a', at:at(5)}, {ledger}).why, 'already_read');
  assert.equal(awardFor({kind:'tip', id:'d', at:at(5)}, {ledger}).rows[0].xp, 2);
});

test('A/B challenges: 5 XP right or wrong, 3 a day, never twice', () => {
  let ledger = [];
  ['a', 'b', 'c'].forEach(id => { ledger = ledger.concat(awardFor({kind:'ab', id, at:at(4)}, {ledger}).rows); });
  assert.equal(sumXp(ledger), 15);
  assert.equal(awardFor({kind:'ab', id:'d', at:at(4)}, {ledger}).why, 'daily_cap');
  assert.equal(awardFor({kind:'ab', id:'a', at:at(6)}, {ledger}).why, 'already_answered');
  assert.equal(awardFor({kind:'ab', id:'z', at:at(6)}, {ledger, answered:['z']}).why, 'already_answered');
});

test('questionnaire pays 20 XP once', () => {
  const r = awardFor({kind:'questionnaire', at:at(1)}, {ledger:[]});
  assert.equal(r.rows[0].xp, 20);
  assert.equal(awardFor({kind:'questionnaire', at:at(9)}, {ledger:r.rows}).why, 'once');
});

test('anti-cheat: a believable session passes', () => {
  assert.equal(checkSession(session(15), []).ok, true);
});

test('anti-cheat: too fast, too short, wrong count, low confidence and too much volume are flagged', () => {
  const s = session(10);
  assert.ok(checkSession({...s, repTimes:s.repTimes.map((t, i) => i * 200)}, []).flags.includes('rep_too_fast'));
  assert.ok(checkSession({...s, endedAt:new Date(new Date(s.startedAt).getTime() + 2000).toISOString()}, []).flags.includes('session_too_short'));
  assert.ok(checkSession({...s, reps:11}, []).flags.includes('rep_times_mismatch'));
  assert.ok(checkSession({...s, conf:.2}, []).flags.includes('low_confidence'));
  assert.ok(checkSession(s, [{move:'pushup', reps:595, endedAt:s.endedAt}]).flags.includes('daily_volume'));
  assert.ok(checkSession({...s, move:'jump'}, []).flags.includes('unknown_move'));
});

test('anti-cheat: replaying the same session rhythm is caught', () => {
  const a = session(10, 3), b = session(10, 4);
  const first = checkSession(a, []);
  assert.ok(checkSession(b, [{move:'pushup', reps:10, endedAt:a.endedAt, gaps:first.gaps}]).flags.includes('replay'));
});

test('a rejected session earns nothing and says why', () => {
  const s = session(10); const r = awardFor({...s, repTimes:s.repTimes.map((t, i) => i * 100)}, {ledger:[]});
  assert.equal(r.why, 'rejected'); assert.equal(r.rows.length, 0); assert.ok(r.flags.length);
});

test('rate limit: no more than 20 events a minute', () => {
  assert.equal(rateOk(Array(19).fill(1000), 2000), true);
  assert.equal(rateOk(Array(20).fill(1000), 2000), false);
  assert.equal(rateOk(Array(20).fill(1000), 70000), true);
});

test('weeks start on Monday', () => {
  assert.equal(weekKey(at(4)), '2026-11-02');
  assert.equal(weekKey(at(8)), '2026-11-02');
  assert.equal(weekKey(at(9)), '2026-11-09');
  assert.equal(weekXp([{xp:5, at:at(3)}, {xp:7, at:at(9)}], at(10)), 7);
});

test('rankings: by sector or league, weekly or total, flagged accounts left out', () => {
  const P = [
    {uid:'a', sector:'gym', xp:500, wk:'2026-11-02', wxp:50, leagues:['L1']},
    {uid:'b', sector:'gym', xp:300, wk:'2026-11-02', wxp:200, leagues:['L1']},
    {uid:'c', sector:'home', xp:900, wk:'2026-10-26', wxp:400, leagues:['L1']},
    {uid:'d', sector:'gym', xp:9999, flagged:true, leagues:['L1']}
  ];
  assert.deepEqual(Array.from(rankPlayers(P, {sector:'gym'}), p => p.uid), ['a', 'b']);
  assert.deepEqual(Array.from(rankPlayers(P, {sector:'gym', period:'week', week:'2026-11-02'}), p => p.uid), ['b', 'a']);
  const lg = rankPlayers(P, {league:'L1', period:'week', week:'2026-11-02'});
  assert.deepEqual(J(Array.from(lg, p => [p.uid, p.score])), [['b', 200], ['a', 50], ['c', 0]]);
  assert.equal(around(lg, 'c', 1).near.length, 2);
});

test('overtakes: who went from behind you to ahead of you', () => {
  assert.deepEqual(Array.from(whoPassed({me:100, a:90, b:150, c:100}, {me:100, a:120, b:160, c:101}, 'me')), ['a', 'c']);
  assert.deepEqual(Array.from(whoPassed({me:100}, {me:100, a:200}, 'me')), []);
  assert.match(overtakeLine('Jorge', 0), /^Jorge /);
});

test('nicknames: 3 to 16 simple characters', () => {
  assert.equal(nickOk('jorge_88'), true);
  assert.equal(nickOk('jo'), false);
  assert.equal(nickOk('jorge lópez'), false);
});

test('MÁSTER: only the last push-up of the alarm held at the bottom for 10 s', () => {
  const task = {move:'pushup', reps:10};
  assert.equal(masterUnlocks(task, 10, MASTER.holdMs), true);
  assert.equal(masterUnlocks(task, 9, 20000), false);
  assert.equal(masterUnlocks(task, 10, MASTER.holdMs - 1), false);
  assert.equal(masterUnlocks({move:'squat', reps:10}, 10, 20000), false);
});

test('the Supabase functions run the same rules as the app', () => {
  const copy = readFileSync(new URL('../supabase/functions/_shared/game-core.mjs', import.meta.url), 'utf8');
  assert.ok(copy.includes(block('game-core').trim()), 'run: node scripts/sync-game-core.mjs');
});
