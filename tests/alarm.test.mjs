// Tests for the wake-up alarm rules (block between alarm-core:start and alarm-core:end in index.html).
// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = (name) => html.split(`/* ${name}:start`)[1].split(`/* ${name}:end */`)[0].replace(/^[^\n]*\n/, '');
const ctx = {};
vm.runInNewContext(block('alarm-core') + '\nObject.assign(this, {ALARM_DEFAULT, ALARM_MOVES, ALARM_LEVELS, alarmLevelFor, nextAlarmAt, alarmTask, afterAbandon, localDay});', ctx);
const { ALARM_DEFAULT, ALARM_MOVES, ALARM_LEVELS, alarmLevelFor, nextAlarmAt, alarmTask, afterAbandon, localDay } = ctx;
const cfg = p => ({...ALARM_DEFAULT, on:true, ...p});

test('off means no alarm', () => {
  assert.equal(nextAlarmAt({...ALARM_DEFAULT}, new Date(2026, 10, 4, 6, 0)), null);
});

test('rings later today, or tomorrow once the time has passed', () => {
  const a = nextAlarmAt(cfg({time:'07:00'}), new Date(2026, 10, 4, 6, 0));
  assert.equal(localDay(a), '2026-11-04'); assert.equal(a.getHours(), 7);
  const b = nextAlarmAt(cfg({time:'07:00'}), new Date(2026, 10, 4, 7, 30));
  assert.equal(localDay(b), '2026-11-05');
});

test('only on chosen weekdays', () => {
  const a = nextAlarmAt(cfg({days:['mon']}), new Date(2026, 10, 4, 6, 0));   // Wednesday
  assert.equal(localDay(a), '2026-11-09');
});

test('sick or travelling pause skips those days', () => {
  const a = nextAlarmAt(cfg({pausedUntil:'2026-11-06'}), new Date(2026, 10, 4, 6, 0));
  assert.equal(localDay(a), '2026-11-07');
});

test('task: push-ups normally, one easy minute in gentle health mode', () => {
  assert.deepEqual({...alarmTask(cfg({reps:15}), false)}, {move:'pushup', reps:15});
  assert.deepEqual({...alarmTask(cfg({reps:15}), true)}, {move:'mobility', sec:60});
  assert.equal(alarmTask(cfg({reps:500}), false).reps, 50);
});

test('leaving the task: commitment rings again, gentle stops, and it never runs past the cap', () => {
  const first = new Date(2026, 10, 4, 7, 0);
  const r = afterAbandon(cfg({mode:'commit', rearm:5}), first, new Date(2026, 10, 4, 7, 2));
  assert.equal(r.status, 'rearmed'); assert.equal(r.nextRing.getMinutes(), 7);
  assert.equal(afterAbandon(cfg({mode:'gentle'}), first, new Date(2026, 10, 4, 7, 2)).status, 'stopped');
  assert.equal(afterAbandon(cfg({mode:'commit', rearm:5, maxMin:60}), first, new Date(2026, 10, 4, 7, 58)).status, 'expired');
});

test('the alarm task can be squats; anything else falls back to push-ups', () => {
  assert.equal(alarmTask(cfg({move:'squat'}), false).move, 'squat');
  assert.equal(alarmTask(cfg({move:'burpee'}), false).move, 'pushup');
});

test('levels set the reps for each move; your own number works without a level', () => {
  assert.equal(alarmTask(cfg({move:'pushup', level:'easy'}), false).reps, 5);
  assert.equal(alarmTask(cfg({move:'pushup', level:'hard'}), false).reps, 20);
  assert.deepEqual({...alarmTask(cfg({move:'pullup', level:'medium'}), false)}, {move:'pullup', reps:5});
  assert.equal(alarmTask(cfg({move:'jacks', level:'hard'}), false).reps, 60);
  assert.equal(alarmTask(cfg({move:'situp', level:null, reps:12}), false).reps, 12);
  assert.equal(alarmTask(cfg({move:'pullup', level:null, reps:99}), false).reps, 20);
});

test('every alarm move has three levels that get harder', () => {
  for (const [k, m] of Object.entries(ALARM_MOVES)){
    assert.equal(m.reps.length, ALARM_LEVELS.length, k);
    assert.ok(m.reps[0] < m.reps[1] && m.reps[1] < m.reps[2] && m.reps[2] <= m.max, k);
  }
});

test('starting level follows training experience', () => {
  assert.equal(alarmLevelFor(1), 'easy'); assert.equal(alarmLevelFor(2), 'medium'); assert.equal(alarmLevelFor(3), 'hard');
  assert.equal(alarmLevelFor(undefined), 'easy');
});

test('every alarm move can be counted by the camera and checked by the server', () => {
  const all = {};
  vm.runInNewContext(block('pose-core') + block('game-core') + '\nObject.assign(this, {REP_RULES, CUES, POSE_VIEW, GAME});', all);
  for (const k of Object.keys(ALARM_MOVES)){
    assert.ok(all.REP_RULES[k], 'rep rule for ' + k);
    assert.ok(all.CUES[k] && all.CUES[k].start, 'cues for ' + k);
    assert.ok(all.POSE_VIEW[k], 'camera view for ' + k);
    assert.ok(all.GAME.limits.rep[k], 'anti-cheat limits for ' + k);
  }
});
