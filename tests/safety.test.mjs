// Tests for the plan safety rules in index.html (the block between safety-core:start and safety-core:end).
// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const core = html.split('/* safety-core:start')[1].split('/* safety-core:end */')[0].replace(/^[^\n]*\n/, '');
const ctx = {};
vm.runInNewContext(core + '\nObject.assign(this, {PARQ, SCOFF, HIGH_IMPACT, INJURY_AVOID, assessHealth, screenEating, kcalFloor, safetyLimits, calorieBounds, validatePlan, spreadPick});', ctx);
const { assessHealth, screenEating, kcalFloor, safetyLimits, calorieBounds, validatePlan, HIGH_IMPACT, spreadPick } = ctx;

const allNo = keys => Object.fromEntries(keys.map(k => [k, false]));
const PARQ_NO = allNo(ctx.PARQ.map(q => q[0]));
const SCOFF_NO = allNo(ctx.SCOFF.map(q => q[0]));
const catalog = {
  'pushup': {name:'Push-up', level:1, dose:12, unit:'reps'},
  'incline-pushup': {name:'Incline push-up', level:1, dose:12, unit:'reps'},
  'jump-squat': {name:'Jump squat', level:2, dose:12, unit:'reps'},
  'split-squat': {name:'Bulgarian split squat', level:3, dose:10, unit:'reps'},
  'plank': {name:'Plank', level:1, dose:40, unit:'sec'},
  'glute-bridge': {name:'Glute bridge', level:1, dose:15, unit:'reps'}
};
const okLimits = () => safetyLimits({health:{parq:PARQ_NO}, healthChecked:true, level:2, injuries:[]});
const nutCtx = {catalog, tdee:2200, bmr:1500, sex:'f', weight:70};

test('health check: all "no" means no risk; any "yes" means risk', () => {
  assert.equal(assessHealth({parq:PARQ_NO}).risk, false);
  const r = assessHealth({parq:{...PARQ_NO, chest:true}});
  assert.equal(r.risk, true);
  assert.deepEqual([...r.reasons], ['chest']);
});

test('eating screen: two or more SCOFF answers refer to a professional', () => {
  assert.equal(screenEating({scoff:SCOFF_NO, weight:70, height:170, goal:'lose'}).refer, false);
  assert.equal(screenEating({scoff:{...SCOFF_NO, sick:true}, weight:70, height:170}).refer, false);
  assert.equal(screenEating({scoff:{...SCOFF_NO, sick:true, control:true}, weight:70, height:170}).refer, true);
});

test('eating screen: low BMI with a weight-loss goal refers, very low BMI always refers', () => {
  assert.equal(screenEating({scoff:SCOFF_NO, weight:52, height:170, goal:'lose'}).refer, true);   // BMI 18.0
  assert.equal(screenEating({scoff:SCOFF_NO, weight:52, height:170, goal:'gain'}).refer, false);
  assert.equal(screenEating({scoff:SCOFF_NO, weight:49, height:170, goal:'gain'}).refer, true);   // BMI 17.0
});

test('limits: no health check or a risk answer means gentle mode without high-impact moves', () => {
  const none = safetyLimits({healthChecked:false, level:3});
  assert.equal(none.mode, 'gentle');
  assert.equal(none.maxLevel, 1);
  assert.ok(HIGH_IMPACT.every(id => none.avoid.includes(id)));
  const risk = safetyLimits({health:{parq:{...PARQ_NO, heart:true}}, healthChecked:true, level:3});
  assert.equal(risk.mode, 'gentle');
  assert.equal(risk.maxDays, 3);
  const ok = okLimits();
  assert.equal(ok.mode, 'normal');
  assert.equal(ok.maxLevel, 2);
});

test('limits: injuries remove the moves that load that area', () => {
  const L = safetyLimits({health:{parq:PARQ_NO}, healthChecked:true, level:3, injuries:['knee']});
  assert.ok(L.avoid.includes('jump-squat'));
  assert.ok(L.avoid.includes('lunge'));
  assert.ok(!L.avoid.includes('pushup'));
});

test('limits: positive eating screen blocks nutrition', () => {
  const L = safetyLimits({health:{parq:PARQ_NO}, healthChecked:true, level:2, eating:{scoff:{...SCOFF_NO, sick:true, fat:true}, weight:60, height:165}});
  assert.equal(L.nutrition, 'blocked');
  assert.equal(L.mode, 'gentle');
});

test('calorie floor: never below 1200 (women) / 1500 (men) or BMR', () => {
  assert.equal(kcalFloor('f', 1100), 1200);
  assert.equal(kcalFloor('m', 1400), 1500);
  assert.equal(kcalFloor('f', 1450), 1450);
  const b = calorieBounds(okLimits(), {tdee:2200, bmr:1500, sex:'f', weight:70});
  assert.equal(b.floor, 1760);   // 20 % max deficit wins over the 0.75 %/week cap here
  assert.equal(b.ceil, 2464);
});

test('validator: removes unknown, avoided and too-advanced exercises and caps sets', () => {
  const L = safetyLimits({health:{parq:PARQ_NO}, healthChecked:true, level:2, injuries:['knee']});
  const { plan, issues } = validatePlan({days:[{day:'mon', title:'Legs', exercises:[
    {id:'made-up', sets:3, dose:10}, {id:'jump-squat', sets:3, dose:10}, {id:'split-squat', sets:3, dose:10},
    {id:'glute-bridge', sets:9, dose:500}]}]}, L, {catalog});
  assert.deepEqual(plan.days[0].exercises.map(x => x.id), ['glute-bridge']);
  assert.equal(plan.days[0].exercises[0].sets, L.maxSets);
  assert.equal(plan.days[0].exercises[0].dose, 30);   // at most double the default dose
  assert.ok(issues.length >= 3);
});

test('validator: trims training days to the limit and always keeps a rest day', () => {
  const L = safetyLimits({health:{parq:PARQ_NO}, healthChecked:true, level:3});
  const week = ['mon','tue','wed','thu','fri','sat','sun'].map(day => ({day, title:'X', exercises:[{id:'pushup', sets:2, dose:10}]}));
  const { plan } = validatePlan({days:week}, L, {catalog});
  assert.equal(plan.days.length, 6);
  const gentle = safetyLimits({healthChecked:false});
  assert.equal(validatePlan({days:week}, gentle, {catalog}).plan.days.length, 3);
});

test('validator: keeps only the days the user can train', () => {
  const day = d => ({day:d, title:'X', exercises:[{id:'pushup', sets:2, dose:10}]});
  const { plan, issues } = validatePlan({days:['mon','tue','wed','thu'].map(day)}, okLimits(), {catalog, days:['mon','wed','fri']});
  assert.deepEqual(plan.days.map(d => d.day), ['mon','wed']);
  assert.ok(issues.includes('kept only the days you can train'));
});

test('validator: raises calories to the safe floor and recomputes macros', () => {
  const { plan, issues } = validatePlan({nutrition:{kcal:900, protein:300, fat:5, carbs:10, meals:[{slot:'lunch', idea:'Chicken salad'}]}}, okLimits(), nutCtx);
  assert.equal(plan.nutrition.kcal, 1760);
  assert.equal(plan.nutrition.protein, 154);            // capped at 2.2 g/kg
  assert.ok(plan.nutrition.fat >= Math.round(1760 * 0.2 / 9));
  assert.equal(plan.nutrition.carbs, Math.round((1760 - 154 * 4 - plan.nutrition.fat * 9) / 4));
  assert.ok(issues.some(i => i.includes('safe minimum')));
});

test('validator: drops nutrition when the eating screen blocked it', () => {
  const L = {...okLimits(), nutrition:'blocked'};
  const { plan, issues } = validatePlan({nutrition:{kcal:2000, protein:120, fat:60}}, L, nutCtx);
  assert.equal(plan.nutrition, null);
  assert.ok(issues.includes('removed the nutrition part'));
});

test('validator: strips unsafe diet wording', () => {
  const { plan, issues } = validatePlan({summary:'Start with a 3-day juice fast to detox.', nutrition:{kcal:2000, protein:120, fat:60, tips:['Try a water fast on Mondays','Drink water with meals']}}, okLimits(), nutCtx);
  assert.equal(plan.summary, '');
  assert.deepEqual([...plan.nutrition.tips], ['Drink water with meals']);
  assert.ok(issues.includes('removed unsafe wording'));
});

test('validator: survives garbage input', () => {
  for (const raw of [null, 'text', 42, {days:'x', nutrition:'y'}, {days:[null, {day:'funday'}]}]){
    const { plan } = validatePlan(raw, okLimits(), nutCtx);
    assert.ok(Array.isArray(plan.days));
  }
});

test('trimmed days are spread out, never the first ones in a row', () => {
  const six = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  assert.deepEqual(Array.from(spreadPick(six, 3)), ['mon', 'wed', 'fri']);
  assert.deepEqual(Array.from(spreadPick(six, 4)), ['mon', 'wed', 'thu', 'sat']);
  assert.deepEqual(Array.from(spreadPick(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], 6)).length, 6);
  assert.deepEqual(Array.from(spreadPick(['mon', 'wed'], 3)), ['mon', 'wed']);
});

test('a plan for 6 chosen days in gentle mode keeps 3, spread over the week', () => {
  const L = safetyLimits({});
  const day = d => ({day:d, title:'Full body', exercises:[{id:'squat', sets:2, dose:10}]});
  const chosen = ['wed', 'thu', 'fri', 'sat', 'sun', 'mon'];
  const cat = {squat:{name:'Squat', level:1}};
  const { plan } = validatePlan({days:chosen.map(day)}, L, {days:chosen, catalog:cat});
  assert.deepEqual(Array.from(plan.days.map(d => d.day)), ['wed', 'fri', 'sun']);
});
