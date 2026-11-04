// Tests for the wake-up alarm rules (block between alarm-core:start and alarm-core:end in index.html).
// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = (name) => html.split(`/* ${name}:start`)[1].split(`/* ${name}:end */`)[0].replace(/^[^\n]*\n/, '');
const ctx = {};
vm.runInNewContext(block('alarm-core') + '\nObject.assign(this, {ALARM_DEFAULT, nextAlarmAt, alarmTask, afterAbandon, alarmPoints, localDay});', ctx);
const { ALARM_DEFAULT, nextAlarmAt, alarmTask, afterAbandon, alarmPoints, localDay } = ctx;
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
  assert.equal(alarmTask(cfg({reps:500}), false).reps, 30);
});

test('leaving the task: commitment rings again, gentle stops, and it never runs past the cap', () => {
  const first = new Date(2026, 10, 4, 7, 0);
  const r = afterAbandon(cfg({mode:'commit', rearm:5}), first, new Date(2026, 10, 4, 7, 2));
  assert.equal(r.status, 'rearmed'); assert.equal(r.nextRing.getMinutes(), 7);
  assert.equal(afterAbandon(cfg({mode:'gentle'}), first, new Date(2026, 10, 4, 7, 2)).status, 'stopped');
  assert.equal(afterAbandon(cfg({mode:'commit', rearm:5, maxMin:60}), first, new Date(2026, 10, 4, 7, 58)).status, 'expired');
});

test('points: camera-verified earns most, tapping less, emergency stop nothing (never negative)', () => {
  assert.equal(alarmPoints('camera'), 10);
  assert.equal(alarmPoints('tap'), 4);
  assert.equal(alarmPoints('stopped'), 0);
});
