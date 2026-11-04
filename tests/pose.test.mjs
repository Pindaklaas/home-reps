// Tests for camera rep counting (block between pose-core:start and pose-core:end in index.html).
// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = (name) => html.split(`/* ${name}:start`)[1].split(`/* ${name}:end */`)[0].replace(/^[^\n]*\n/, '');
const ctx = {};
vm.runInNewContext(block('pose-core') + '\nObject.assign(this, {angleAt, poseFeatures, makeRepCounter});', ctx);
const { angleAt, poseFeatures, makeRepCounter } = ctx;

// Feed a list of [jointAngle, bodyAngle] frames 100 ms apart.
function run(move, frames, start = 0){
  const c = makeRepCounter(move); let last;
  frames.forEach(([joint, body], i) => { last = c.update(start + i * 100, {ok:true, joint, body}); });
  return {reps:c.reps, last, counter:c};
}
const rep = (top, bottom, body = 175, steps = 5) => {
  const out = [];
  for (let i = 0; i <= steps; i++) out.push([top - (top - bottom) * i / steps, body]);
  for (let i = steps - 1; i >= 0; i--) out.push([top - (top - bottom) * i / steps, body]);
  return out;
};

test('angles: right angle and straight line', () => {
  assert.equal(Math.round(angleAt({x:0, y:1}, {x:0, y:0}, {x:1, y:0})), 90);
  assert.equal(Math.round(angleAt({x:-1, y:0}, {x:0, y:0}, {x:1, y:0})), 180);
});

test('push-ups: five full reps count five', () => {
  const frames = [[170, 175]]; for (let i = 0; i < 5; i++) frames.push(...rep(170, 80));
  assert.equal(run('pushup', frames).reps, 5);
});

test('push-ups: half reps do not count and ask to go lower', () => {
  const frames = [[170, 175], ...rep(170, 120), [170, 175]];
  const r = run('pushup', frames);
  assert.equal(r.reps, 0);
  const c = makeRepCounter('pushup'); let cues = [];
  frames.forEach(([j, b], i) => cues.push(c.update(i * 100, {ok:true, joint:j, body:b}).cue));
  assert.ok(cues.includes('Go a little lower'));
});

test('push-ups: sagging hips do not count', () => {
  const frames = [[170, 175], ...rep(170, 80, 130)];
  const c = makeRepCounter('pushup'); let cue = '';
  frames.forEach(([j, b], i) => { const s = c.update(i * 100, {ok:true, joint:j, body:b}); if (s.cue) cue = s.cue; });
  assert.equal(c.reps, 0);
  assert.equal(cue, 'Keep your body in a straight line');
});

test('push-ups: nothing counts until the start position', () => {
  const r = run('pushup', [[80, 175], [80, 175], [170, 175], ...rep(170, 80)]);
  assert.equal(r.reps, 1);
});

test('push-ups: impossible speed is ignored', () => {
  const c = makeRepCounter('pushup');
  const seq = [[170], [80], [170], [80], [170]];
  const times = [0, 100, 200, 300, 400];
  seq.forEach(([j], i) => c.update(times[i], {ok:true, joint:j, body:175}));
  assert.equal(c.reps, 1);
});

test('lost tracking asks to get into the picture and does not count', () => {
  const c = makeRepCounter('pushup');
  assert.equal(c.update(0, {ok:false, why:'nobody'}).cue, 'Step into the picture');
  assert.equal(c.update(100, {ok:false, why:'frame'}).cue, 'Get your whole body in the picture');
  assert.equal(c.reps, 0);
});

test('squats: knee angle drives the count', () => {
  const frames = [[175, 170]]; for (let i = 0; i < 3; i++) frames.push(...rep(175, 90, 170));
  assert.equal(run('squat', frames).reps, 3);
});

test('features: picks the visible side and needs the key joints', () => {
  const lm = Array.from({length:33}, () => ({x:.5, y:.5, visibility:0.1}));
  assert.equal(poseFeatures('pushup', lm).ok, false);
  const set = (i, x, y) => { lm[i] = {x, y, visibility:.99}; };
  set(11, .3, .4); set(13, .3, .6); set(15, .3, .8); set(23, .6, .4); set(27, .9, .4);
  const f = poseFeatures('pushup', lm);
  assert.equal(f.ok, true);
  assert.equal(Math.round(f.joint), 180);
  assert.equal(Math.round(f.body), 180);
});
