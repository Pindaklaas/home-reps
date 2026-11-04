// Tests for set logging, progression, PRs, muscle recovery and streaks (block between training-core:start and training-core:end).
// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = (name) => html.split(`/* ${name}:start`)[1].split(`/* ${name}:end */`)[0].replace(/^[^\n]*\n/, '');
const ctx = {};
vm.runInNewContext(block('training-core') + '\nObject.assign(this, {platesFor, warmupSets, restFor, repRange, e1rm, weightStep, suggestNext, sessionStats, findPRs, isPR, bestsFrom, muscleFatigue, streakInfo, tcDay});', ctx);
const { platesFor, warmupSets, restFor, repRange, e1rm, weightStep, suggestNext, sessionStats, findPRs, muscleFatigue, streakInfo, tcDay } = ctx;
const set = (w, r, done = true) => ({w, r, done});
const sess = (id, sets, at = '2026-11-01T18:00:00') => ({startedAt:at, endedAt:at, exercises:[{id, sets}]});

test('rep ranges follow the goal', () => {
  assert.deepEqual([...repRange('strength')], [4, 6]);
  assert.deepEqual([...repRange('gain')], [8, 12]);
  assert.deepEqual([...repRange('unknown')], [8, 12]);
});

test('estimated 1RM (Epley), zero for empty sets', () => {
  assert.equal(e1rm(100, 1), 103.3);
  assert.equal(e1rm(80, 10), 106.7);
  assert.equal(e1rm(0, 10), 0);
  assert.equal(e1rm(100, 30), e1rm(100, 15));
});

test('weight steps: 5 kg for legs, 2.5 kg for the rest', () => {
  assert.equal(weightStep({groups:['quads','glutes']}), 5);
  assert.equal(weightStep({groups:['chest','triceps']}), 2.5);
});

test('double progression: top of the range on every set adds weight, otherwise one more rep', () => {
  assert.deepEqual({...suggestNext([set(40, 12), set(40, 12), set(40, 12)], [8, 12], 2.5)}, {w:42.5, r:8, why:'up'});
  assert.deepEqual({...suggestNext([set(40, 12), set(40, 10), set(40, 9)], [8, 12], 2.5)}, {w:40, r:12, why:'rep'});
  assert.deepEqual({...suggestNext([set(40, 8), set(40, 8)], [8, 12], 2.5)}, {w:40, r:9, why:'rep'});
  assert.equal(suggestNext([set(40, 10, false)], [8, 12], 2.5), null);
  assert.deepEqual({...suggestNext([set(0, 15), set(0, 14)], [8, 12], 2.5)}, {w:0, r:12, why:'rep'});
});

test('session stats count only finished sets', () => {
  const s = {exercises:[{id:'a', sets:[set(50, 10), set(50, 8), set(50, 8, false)]}, {id:'b', sets:[set(0, 15)]}]};
  assert.deepEqual({...sessionStats(s)}, {volume:900, sets:3, reps:33});
});

test('PRs: better estimated 1RM or more bodyweight reps; a first attempt is not a PR', () => {
  const history = [sess('bench', [set(60, 8), set(60, 8)]), sess('pushup', [set(0, 20)])];
  assert.equal(findPRs([], sess('bench', [set(60, 8)])).length, 0);
  const prs = findPRs(history, {exercises:[{id:'bench', sets:[set(60, 9), set(62.5, 8)]}, {id:'pushup', sets:[set(0, 21)]}]});
  assert.equal(prs.length, 2);
  assert.equal(prs[0].w, 62.5);
  assert.equal(prs[1].kind, 'reps');
  assert.equal(findPRs(history, sess('bench', [set(60, 8)])).length, 0);
});

test('muscle fatigue: recent sets load muscles and fade over 72 hours', () => {
  const cat = {bench:{groups:['chest','triceps']}};
  const now = new Date('2026-11-04T18:00:00');
  const f = muscleFatigue([sess('bench', [set(60, 8), set(60, 8), set(60, 8), set(60, 8)], '2026-11-04T18:00:00')], cat, now);
  assert.equal(f.chest, 0.4); assert.equal(f.triceps, 0.2);
  const old = muscleFatigue([sess('bench', [set(60, 8)], '2026-10-30T18:00:00')], cat, now);
  assert.equal(old.chest, undefined);
  const half = muscleFatigue([sess('bench', Array(10).fill(set(60, 8)), '2026-11-03T06:00:00')], cat, now);
  assert.equal(half.chest, 0.5);
});

test('streak: active days count, planned rest days keep it, today only counts once done', () => {
  const train = ['mon','wed','fri'];
  const active = new Set(['2026-11-02', '2026-11-04']);            // Mon and Wed
  assert.equal(streakInfo(active, train, new Date(2026, 10, 4)).current, 3);   // Mon, Tue (rest), Wed
  assert.equal(streakInfo(active, train, new Date(2026, 10, 5)).current, 3);   // Thursday not over yet
  assert.equal(streakInfo(new Set(), train, new Date(2026, 10, 4)).current, 0);
});

test('streak: up to two missed training days a month are forgiven, the third breaks it', () => {
  const train = ['mon','tue','wed','thu','fri','sat','sun'];
  const days = ['2026-11-01','2026-11-03','2026-11-05','2026-11-07'];   // every other day
  const r = streakInfo(new Set(days), train, new Date(2026, 10, 7), 2);
  assert.equal(r.current, 5);           // 7th back to 3rd: two misses (6th, 4th) forgiven, 2nd breaks it
  assert.equal(r.freezesLeft, 0);
  assert.equal(streakInfo(new Set(days), train, new Date(2026, 10, 7), 3).current, 7);
});

test('day keys use local dates', () => {
  assert.equal(tcDay(new Date(2026, 0, 5)), '2026-01-05');
});

test('plates per side for a 20 kg bar', () => {
  assert.deepEqual([...platesFor(60)], [20]);
  assert.deepEqual([...platesFor(102.5)], [25, 15, 1.25]);
  assert.deepEqual([...platesFor(20)], []);
  assert.equal(platesFor(61), null);
  assert.equal(platesFor(10), null);
});

test('warm-up ramp only for real working weights', () => {
  assert.deepEqual(Array.from(warmupSets(100), x => x.w), [20, 50, 75]);
  assert.equal(warmupSets(30).length, 0);
  assert.deepEqual(Array.from(warmupSets(40), x => x.w), [20, 30]);
});

test('rest: heavy barbell work rests at least 2 minutes', () => {
  assert.equal(restFor('Barbell', 'gain'), 120);
  assert.equal(restFor('Barbell', 'strength'), 150);
  assert.equal(restFor('Cable machine', 'gain'), 90);
  assert.equal(restFor('Dumbbells', 'lose'), 60);
});
