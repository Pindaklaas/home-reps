// Tests for the daily battery and the 4-week block in index.html (block between habits-core:start and habits-core:end).
// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = (name) => html.split(`/* ${name}:start`)[1].split(`/* ${name}:end */`)[0].replace(/^[^\n]*\n/, '');
const ctx = {};
vm.runInNewContext(block('safety-core') + '\n' + block('habits-core') +
  '\nObject.assign(this, {factorScores, batteryScore, batteryColor, blockWeek, phaseFor, sessionSets, weekPlanning});', ctx);
const { factorScores, batteryScore, batteryColor, blockWeek, phaseFor, sessionSets, weekPlanning } = ctx;

test('battery: nothing logged means no score', () => {
  assert.equal(batteryScore({}), null);
  assert.equal(batteryColor(null), 'none');
});

test('battery: 8 hours of sleep is green, less is never green, under 6 is always red', () => {
  assert.equal(batteryColor(batteryScore({sleep:'8+'})), 'green');
  const best = {food:'yes', water:8, move:'8+'};
  assert.equal(batteryColor(batteryScore({sleep:'7-8', ...best})), 'yellow');
  assert.equal(batteryColor(batteryScore({sleep:'6-7', ...best})), 'yellow');
  assert.equal(batteryColor(batteryScore({sleep:'lt6', ...best})), 'red');
});

test('battery: other factors can pull a good night down', () => {
  const s = batteryScore({sleep:'8+', food:'no', water:0, move:'lt5'});
  assert.ok(s < 75, `expected below green, got ${s}`);
  assert.equal(batteryScore({sleep:'8+', food:'yes', water:8, move:'8+'}), 100);
});

test('battery: water counts towards 8 glasses and never above 100 %', () => {
  assert.equal(factorScores({water:4}).water, 50);
  assert.equal(factorScores({water:12}).water, 100);
  assert.equal(factorScores({water:0}).water, 0);
});

test('block: weeks run 1 to 4 from the start day, then repeat', () => {
  const start = '2026-11-02';
  assert.equal(blockWeek(start, new Date(2026, 10, 2)), 1);
  assert.equal(blockWeek(start, new Date(2026, 10, 8)), 1);
  assert.equal(blockWeek(start, new Date(2026, 10, 9)), 2);
  assert.equal(blockWeek(start, new Date(2026, 10, 30)), 1);
  assert.equal(blockWeek(start, new Date(2026, 10, 1)), 1);
});

test('block: new lifters start with two weeks of habits, others follow base-build-push-deload', () => {
  assert.equal(phaseFor('start', 1).name, 'Foundations');
  assert.equal(phaseFor('start', 2).name, 'Foundations');
  assert.equal(phaseFor('start', 3).name, 'Build');
  assert.deepEqual([1,2,3,4].map(w => phaseFor('regular', w).name), ['Base','Build','Push','Deload']);
  assert.equal(phaseFor('regular', 4).delta, -1);
});

test('sets: week change and a red battery adjust sets within bounds', () => {
  assert.equal(sessionSets(3, 0, 'green', 4), 3);
  assert.equal(sessionSets(3, 1, 'green', 4), 4);
  assert.equal(sessionSets(3, 1, 'red', 4), 3);
  assert.equal(sessionSets(4, 1, 'yellow', 4), 4);
  assert.equal(sessionSets(1, -1, 'red', 4), 1);
});

test('planning: every day of the week, training days carry time and length', () => {
  const rows = weekPlanning([{day:'mon', title:'Push', exercises:[1,2,3]}, {day:'thu', title:'Pull', exercises:[1,2]}], '18:30', 60);
  assert.equal(rows.length, 7);
  assert.deepEqual({...rows[0]}, {day:'mon', type:'train', title:'Push', time:'18:30', minutes:60, count:3});
  assert.equal(rows[1].type, 'rest');
  assert.equal(rows[3].title, 'Pull');
});
