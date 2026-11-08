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

test('sit-ups, jumping jacks and pull-ups count full reps only', () => {
  const sit = [[130]]; for (let i = 0; i < 3; i++) sit.push(...rep(130, 60, 0));
  assert.equal(run('situp', sit).reps, 3);
  assert.equal(run('situp', [[130], ...rep(130, 95, 0), [130]]).reps, 0);
  const jacks = [[170]]; for (let i = 0; i < 4; i++) jacks.push(...rep(170, 20, 0, 2));
  assert.equal(run('jacks', jacks).reps, 4);
  assert.equal(run('jacks', [[170], ...rep(170, 100, 0, 2), [170]]).reps, 0);
  const pull = [[170]]; for (let i = 0; i < 2; i++) pull.push(...rep(170, 60, 0, 6));
  assert.equal(run('pullup', pull).reps, 2);
});

test('facing-camera moves need both arms', () => {
  const pt = (x, y) => ({x, y, visibility:.9});
  const lm = Array.from({length:33}, () => pt(.5, .5));
  // Arms down by the sides: jacks joint near 180.
  lm[11] = pt(.4, .3); lm[12] = pt(.6, .3); lm[23] = pt(.42, .6); lm[24] = pt(.58, .6);
  lm[13] = pt(.38, .45); lm[14] = pt(.62, .45); lm[15] = pt(.38, .58); lm[16] = pt(.62, .58);
  const down = poseFeatures('jacks', lm); assert.ok(down.ok); assert.ok(down.joint > 150);
  // Only one arm up: still counts as down.
  lm[15] = pt(.38, .05); const one = poseFeatures('jacks', lm); assert.ok(one.joint > 140);
  // Both up: small joint.
  lm[16] = pt(.62, .05); assert.ok(poseFeatures('jacks', lm).joint < 40);
  // Pull-ups: hands must be above the shoulders.
  lm[15] = pt(.38, .58); lm[16] = pt(.62, .58);
  assert.equal(poseFeatures('pullup', lm).why, 'hang');
  lm[13] = pt(.38, .15); lm[14] = pt(.62, .15); lm[15] = pt(.38, .0); lm[16] = pt(.62, .0);
  const hang = poseFeatures('pullup', lm); assert.ok(hang.ok); assert.ok(hang.joint > 150);
});
