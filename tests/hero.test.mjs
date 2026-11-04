// Tests for the RPG hero (hero-core): muscle levels, stats, balance, class and level-ups.
// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = (name) => html.split(`/* ${name}:start`)[1].split(`/* ${name}:end */`)[0].replace(/^[^\n]*\n/, '');
const ctx = {};
vm.runInNewContext(block('hero-core') + '\nObject.assign(this, {HERO, heroLevel, heroTier, actPoints, heroFrom, heroClass, heroUps, heroSnap});', ctx);
const { heroLevel, heroTier, actPoints, heroFrom, heroUps, heroSnap } = ctx;
const G = ['chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'traps', 'upperback', 'lowerback', 'glutes', 'quads', 'hamstrings', 'calves'];
const reps = (id, groups, n, times = 1, w = 0) => Array.from({length:times}, () => ({id, groups, reps:n, w}));

test('a new hero starts at level 1 everywhere, as a Rookie', () => {
  const h = heroFrom([], {}, G);
  assert.equal(h.muscles.chest.level, 1); assert.equal(h.stats.str.level, 1); assert.equal(h.stats.bal.level, 1);
  assert.equal(h.cls.name, 'The Rookie');
});

test('levels grow with the square root of the work, capped at 99', () => {
  assert.equal(heroLevel(0, 15), 1); assert.equal(heroLevel(15, 15), 2); assert.equal(heroLevel(60, 15), 3); assert.equal(heroLevel(1e9, 15), 99);
  assert.equal(heroTier(1), 'none'); assert.equal(heroTier(3), 'bronze'); assert.equal(heroTier(10), 'gold'); assert.equal(heroTier(20), 'legend');
});

test('weight multiplies the work; seconds count a third', () => {
  assert.equal(actPoints({reps:10}), 10);
  assert.equal(actPoints({reps:10, w:60}), 20);
  assert.equal(actPoints({sec:30}), 10);
});

test('push-ups build the chest most, then triceps and shoulders', () => {
  const h = heroFrom(reps('pushup', ['chest', 'triceps', 'shoulders'], 20, 30), {}, G);
  assert.ok(h.muscles.chest.xp > h.muscles.triceps.xp);
  assert.equal(h.muscles.triceps.xp, h.muscles.shoulders.xp);
  assert.ok(h.muscles.chest.level >= 6); assert.equal(h.muscles.calves.level, 1);
});

test('heavy lifting makes a Tank, core work a Monk, showing up a Spartan', () => {
  assert.equal(heroFrom(reps('back-squat', ['quads', 'glutes'], 8, 40, 100), {}, G).cls.name, 'The Tank');
  assert.equal(heroFrom(reps('crunch', ['abs', 'obliques'], 20, 30), {}, G).cls.name, 'The Monk');
  assert.equal(heroFrom([], {days:40, alarms:30, streak:20}, G).cls.name, 'The Spartan');
});

test('training everything evenly raises Balance and makes an All-rounder', () => {
  const acts = G.flatMap(g => reps('x', [g], 20, 12));
  const h = heroFrom(acts, {}, G);
  assert.ok(h.stats.bal.level >= 3);
  assert.equal(h.cls.name, 'The All-rounder');
});

test('level-ups are reported once, against the last snapshot', () => {
  const a = heroFrom(reps('pushup', ['chest'], 10, 1), {}, G), b = heroFrom(reps('pushup', ['chest'], 10, 10), {}, G);
  const ups = heroUps(heroSnap(a), b);
  assert.ok(ups.some(u => u.kind === 'muscle' && u.key === 'chest' && u.to > u.from));
  assert.equal(heroUps(heroSnap(b), b).length, 0);
  assert.equal(heroUps(null, b).length, 0);
});
