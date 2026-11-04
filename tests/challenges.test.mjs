// Tests for the challenge catalog and progression rules in index.html (block between challenge-core:start and challenge-core:end).
// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = (name) => html.split(`/* ${name}:start`)[1].split(`/* ${name}:end */`)[0].replace(/^[^\n]*\n/, '');
const ctx = {};
vm.runInNewContext(block('safety-core') + '\n' + block('challenge-core') +
  '\nObject.assign(this, {safetyLimits, MOVES, MEDALS, CHALLENGES, CH, partsTotal, medalFor, isBetter, xpFor, xpToReach, levelFromXp, rankFor, nextTarget, unlockedLevel, challengeAllowed});', ctx);
const { safetyLimits, MOVES, CHALLENGES, CH, partsTotal, medalFor, isBetter, xpFor, xpToReach, levelFromXp, rankFor, nextTarget, unlockedLevel, challengeAllowed } = ctx;

test('catalog: unique ids, known moves, every level has at least two challenges', () => {
  assert.equal(new Set(CHALLENGES.map(c => c.id)).size, CHALLENGES.length);
  for (const c of CHALLENGES){
    for (const m of c.moves) assert.ok(MOVES[m], `${c.id} uses unknown move ${m}`);
    for (const [m] of (c.parts || [])) assert.ok(MOVES[m], `${c.id} part uses unknown move ${m}`);
    for (const [m] of (c.round || [])) assert.ok(MOVES[m], `${c.id} round uses unknown move ${m}`);
    assert.equal(c.tiers.length, 4);
    if (c.fmt === 'fortime') assert.ok(partsTotal(c) > 0);
    if (c.fmt === 'amrap' || c.fmt === 'emom') assert.ok([180, 300].includes(c.dur), `${c.id} should last 3 or 5 minutes`);
  }
  for (let n = 1; n <= 5; n++) assert.ok(CHALLENGES.filter(c => c.level === n).length >= 2, `level ${n}`);
});

test('catalog: medal tiers get strictly harder', () => {
  for (const c of CHALLENGES){
    for (let i = 1; i < 4; i++){
      if (c.better === 'lower') assert.ok(c.tiers[i] < c.tiers[i - 1], `${c.id} times must drop`);
      else assert.ok(c.tiers[i] > c.tiers[i - 1], `${c.id} scores must rise`);
    }
  }
});

test('catalog: ladder totals are right', () => {
  assert.equal(partsTotal(CH['thirty-twenty-ten']), 180);
  assert.equal(partsTotal(CH['pyramid']), 165);
  assert.equal(partsTotal(CH['centurion']), 100);
});

test('medals: higher-is-better and lower-is-better', () => {
  const squat = CH['squat-sprint'], race = CH['the-hundred'];
  assert.equal(medalFor(squat, 39), null);
  assert.equal(medalFor(squat, 40), 'bronze');
  assert.equal(medalFor(squat, 85), 'gold');
  assert.equal(medalFor(squat, 120), 'legend');
  assert.equal(medalFor(race, 400), null);
  assert.equal(medalFor(race, 360), 'bronze');
  assert.equal(medalFor(race, 200), 'gold');
  assert.equal(medalFor(race, 0), null);
});

test('personal bests: compare in the right direction', () => {
  assert.equal(isBetter(CH['squat-sprint'], 50, 45), true);
  assert.equal(isBetter(CH['squat-sprint'], 40, 45), false);
  assert.equal(isBetter(CH['the-hundred'], 250, 300), true);
  assert.equal(isBetter(CH['the-hundred'], 320, 300), false);
  assert.equal(isBetter(CH['squat-sprint'], 10, undefined), true);
  assert.equal(isBetter(CH['squat-sprint'], 0, undefined), false);
});

test('XP: harder levels, medals and personal bests pay more; easier version pays less', () => {
  const l1 = CH['squat-sprint'], l3 = CH['burpee-storm'];
  assert.equal(xpFor(l1, 30, false, false), 20);
  assert.equal(xpFor(l1, 60, false, false), 20 + 20);
  assert.equal(xpFor(l1, 60, true, false), 20 + 20 + 15);
  assert.ok(xpFor(l3, 30, false, false) > xpFor(l1, 60, false, false) - 5);
  assert.equal(xpFor(l1, 60, true, true), Math.round(55 * 0.6));
  assert.equal(xpFor(l1, 0, true, false), 0);
});

test('levels: smooth curve, each level a bit further than the last', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(xpToReach(2)), 2);
  assert.equal(levelFromXp(xpToReach(2) - 1), 1);
  for (let l = 2; l < 30; l++) assert.ok(xpToReach(l + 1) - xpToReach(l) > xpToReach(l) - xpToReach(l - 1));
  assert.equal(rankFor(1), 'Rookie');
  assert.equal(rankFor(5), 'Grinder');
  assert.equal(rankFor(16), 'Beast');
  assert.equal(rankFor(40), 'Legend');
});

test('next target: next medal first, then 5 % better', () => {
  const squat = CH['squat-sprint'], race = CH['the-hundred'];
  assert.deepEqual({...nextTarget(squat, undefined)}, {medal:'bronze', value:40});
  assert.deepEqual({...nextTarget(squat, 65)}, {medal:'gold', value:80});
  assert.deepEqual({...nextTarget(squat, 110)}, {medal:null, value:116});
  assert.deepEqual({...nextTarget(race, 150)}, {medal:null, value:142});
});

test('unlocking: two medals in a level open the next one', () => {
  assert.equal(unlockedLevel({}, CHALLENGES), 1);
  assert.equal(unlockedLevel({'squat-sprint':45}, CHALLENGES), 1);
  assert.equal(unlockedLevel({'squat-sprint':45, 'plank-clock':60}, CHALLENGES), 2);
  assert.equal(unlockedLevel({'squat-sprint':45, 'plank-clock':60, 'the-hundred':300, 'core-grinder':60}, CHALLENGES), 3);
  assert.equal(unlockedLevel({'squat-sprint':10, 'plank-clock':20}, CHALLENGES), 1);
});

test('safety: gentle mode locks high-impact challenges, injuries lock matching ones', () => {
  const gentle = safetyLimits({healthChecked:false});
  assert.equal(challengeAllowed(CH['burpee-storm'], gentle).ok, false);
  assert.equal(challengeAllowed(CH['jack-attack'], gentle).ok, false);
  assert.equal(challengeAllowed(CH['plank-clock'], gentle).ok, true);
  const clear = {heart:false, chest:false, dizzy:false, chronic:false, meds:false, joint:false, supervised:false, pregnant:false};
  const knee = safetyLimits({health:{parq:clear}, healthChecked:true, level:2, injuries:['knee']});
  assert.equal(challengeAllowed(CH['lunge-line'], knee).ok, false);
  assert.equal(challengeAllowed(CH['burpee-storm'], knee).ok, false);
  assert.equal(challengeAllowed(CH['pushup-pressure'], knee).ok, true);
  const ok = safetyLimits({health:{parq:clear}, healthChecked:true, level:2});
  assert.equal(challengeAllowed(CH['burpee-storm'], ok).ok, true);
});
