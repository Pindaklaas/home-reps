// Tests for the exercise animation rig (block between anim-core:start and anim-core:end) and the animation table.
// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = (name) => html.split(`/* ${name}:start`)[1].split(`/* ${name}:end */`)[0].replace(/^[^\n]*\n/, '');
const ctx = {};
vm.runInNewContext(block('anim-core') + '\nObject.assign(this, {RIG, ik2, solvePose, lerpPose, poseAt, ease});', ctx);
const { RIG, ik2, solvePose, lerpPose, poseAt, ease } = ctx;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('two-bone IK keeps bone lengths and reaches a reachable target', () => {
  const [m, end] = ik2([0, 0], [.2, .1], .25, .25, 1);
  assert.ok(near(dist([0, 0], m), .25));
  assert.ok(near(dist(m, end), .25, 1e-3));
  assert.ok(near(end[0], .2) && near(end[1], .1));
});

test('two-bone IK bends to the chosen side and clamps far targets', () => {
  const up = ik2([0, 0], [.3, 0], .25, .25, 1)[0], down = ik2([0, 0], [.3, 0], .25, .25, -1)[0];
  assert.ok(up[1] > 0 && down[1] < 0);
  const [, end] = ik2([0, 0], [2, 0], .25, .25, 1);
  assert.ok(end[0] <= .5 && end[0] > .49);
});

test('standing pose: feet on the ground, head about 1.0 high', () => {
  const P = solvePose({v:'side', hip:[0, .5], tr:90, l:[{h:[0, 0]}, {h:[0, 0]}]});
  assert.ok(near(P.ankle[0][1], 0, 1e-3));
  assert.ok(P.head[1] > .85 && P.head[1] < 1);
  assert.ok(near(dist(P.hip, P.knee[0]), RIG.thigh));
});

test('front view puts the shoulders either side of the trunk', () => {
  const P = solvePose({v:'front', hip:[0, .5], tr:90});
  assert.ok(P.front && P.sh[0][0] > 0 && P.sh[1][0] < 0);
});

test('lerpPose blends numbers, keeps missing keys and switches strings half way', () => {
  const r = lerpPose({hip:[0, 0], v:'side', x:1}, {hip:[1, 2], v:'front', y:2}, .25);
  assert.deepEqual(Array.from(r.hip), [.25, .5]);
  assert.equal(r.v, 'side');
  assert.equal(r.x, 1); assert.equal(r.y, 2);
  assert.equal(lerpPose('a', 'b', .6), 'b');
});

test('poseAt holds each key, then eases to the next and loops', () => {
  const anim = {keys:[{tr:0}, {tr:100}], hold:100, move:400};
  assert.equal(poseAt(anim, 50).pose.tr, 0);
  assert.ok(near(poseAt(anim, 300).pose.tr, 100 * ease(.5)));
  assert.equal(poseAt(anim, 550).pose.tr, 100);
  assert.equal(poseAt(anim, 1000 + 50).pose.tr, 0);
  assert.equal(poseAt({keys:[{tr:5}]}, 999).pose.tr, 5);
});

test('every exercise and every challenge move has an animation', () => {
  const ids = [...html.matchAll(/^ \['([a-z0-9-]+)','/gm)].map(m => m[1]);
  const ex = html.split('const EX_RAW = [')[1].split('];')[0];
  const exIds = [...ex.matchAll(/^ \['([a-z0-9-]+)'/gm)].map(m => m[1]);
  const moves = [...html.split('const MOVES = {')[1].split('};')[0].matchAll(/^\s+'?([a-z-]+)'?:\{name/gm)].map(m => m[1]);
  const start = html.indexOf('const ANIMS = {'), table = html.slice(start, html.indexOf('\n};', start));
  const has = id => table.includes(`  ${id}:`) || table.includes(`'${id}':`) || new RegExp(`[ ,]'?${id}'?: (curl|two|A|walk|press)\\(`).test(table);
  assert.ok(exIds.length > 80 && ids.length >= exIds.length);
  const missing = [...exIds, ...moves].filter(id => !has(id));
  assert.deepEqual(missing, []);
});
