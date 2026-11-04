// GENERATED from index.html (game-core block) by scripts/sync-game-core.mjs. Do not edit here.
// Every number for XP, levels, points and limits lives here.
const GAME = {
  xp:{alarm:30, alarmTap:10, perRep:1, streakDay:10, streakMax:50, ab:5, tip:2, questionnaire:20, workout:15, meal:3, challengeMax:150},
  perDay:{alarm:1, ab:3, tip:3, workout:1, meal:3, challenge:6},
  once:['questionnaire'],
  level:{base:100, exp:1.5},          // XP to go from level n to n + 1 = base × n^exp, rounded
  pointsPerLevel:10,                  // points earned on reaching level n = pointsPerLevel × n
  limits:{
    eventsPerMin:20, maxSessionReps:200, replayTolMs:40, minConf:.5,
    rep:{pushup:{minMs:450, maxPerMin:60, perDay:600}, squat:{minMs:500, maxPerMin:60, perDay:800}}
  },
  streakKinds:['alarm', 'workout', 'challenge'],
  // Flags that take an account out of the rankings until someone reviews it (others only cost that session's XP).
  suspicious:['replay', 'pace_not_human', 'rep_times_outside_session', 'rep_times_mismatch', 'daily_volume']
};
const isSuspicious = flags => (flags || []).some(f => GAME.suspicious.includes(f));
const SECTORS = [['gym', 'Gym'], ['calisthenics', 'Calisthenics'], ['home', 'Home bodyweight']];
const OVERTAKE_LINES = [
  '{nick} just passed you in XP!! COME ON CHAMP, WAKE UP',
  '{nick} is ahead of you now. Are you going to allow that?',
  '{nick} overtook you. Two minutes of push-ups and it’s fixed.',
  'Plot twist: {nick} passed you. Your move, legend.'
];
const xpForLevel = n => Math.round(GAME.level.base * Math.pow(n, GAME.level.exp));
function levelInfo(total){
  let level = 1, into = Math.max(0, Math.floor(total || 0));
  while (into >= xpForLevel(level)){ into -= xpForLevel(level); level++; }
  const need = xpForLevel(level);
  return {level, into, need, pct:into / need};
}
const pointsForLevel = n => GAME.pointsPerLevel * n;
// Points ledger rows for every level crossed between two XP totals (append-only: one row per level, never edited).
function levelUps(before, after, at){
  const a = levelInfo(before).level, b = levelInfo(after).level, rows = [];
  for (let l = a + 1; l <= b; l++) rows.push({pts:pointsForLevel(l), reason:'level_up', level:l, at});
  return rows;
}
const gDay = at => { const d = new Date(at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// Weeks start on Monday; the key is that Monday's date.
const weekKey = at => { const d = new Date(at); return gDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7)); };
const sumXp = ledger => (ledger || []).reduce((n, e) => n + (+e.xp || 0), 0);
const weekXp = (ledger, at) => { const w = weekKey(at); return (ledger || []).filter(e => weekKey(e.at) === w).reduce((n, e) => n + (+e.xp || 0), 0); };
// Days in a row with activity ending on `day`. Weekdays in `restDays` (0 = Sunday) neither break the run nor add to it.
function activeStreak(days, day, restDays){
  const set = new Set(days), rest = new Set(restDays || []), d = new Date(day + 'T12:00:00');
  let n = 0;
  for (let i = 0; i < 400; i++){
    const k = gDay(d);
    if (set.has(k)) n++;
    else if (!rest.has(d.getDay()) || i === 0) { if (i > 0) break; }
    d.setDate(d.getDate() - 1);
  }
  return n;
}
// Is a camera-counted session believable? Any flag means no XP and a review flag on the account.
// s: {move, reps, repTimes:[ms from start], startedAt, endedAt, conf}; past: earlier sessions {move, reps, endedAt, gaps}.
function checkSession(s, past){
  const R = GAME.limits.rep[s.move], flags = [];
  if (!R) return {ok:false, flags:['unknown_move']};
  const n = +s.reps || 0, t = s.repTimes || [], dur = new Date(s.endedAt) - new Date(s.startedAt);
  const gaps = t.slice(1).map((x, i) => x - t[i]);
  if (!(n > 0) || n > GAME.limits.maxSessionReps) flags.push('reps_out_of_range');
  if (t.length !== n) flags.push('rep_times_mismatch');
  if (gaps.some(g => g < R.minMs)) flags.push('rep_too_fast');
  if (!(dur >= n * R.minMs)) flags.push('session_too_short');
  else if (n / (dur / 60000) > R.maxPerMin) flags.push('pace_not_human');
  if (t.length && (t[0] < 0 || t[t.length - 1] > dur + 1000)) flags.push('rep_times_outside_session');
  if (s.conf != null && s.conf < GAME.limits.minConf) flags.push('low_confidence');
  const day = gDay(s.endedAt), done = (past || []).filter(p => p.move === s.move && gDay(p.endedAt) === day).reduce((a, p) => a + (+p.reps || 0), 0);
  if (done + n > R.perDay) flags.push('daily_volume');
  if (gaps.length >= 4 && (past || []).some(p => p.gaps && p.gaps.length === gaps.length && p.gaps.every((g, i) => Math.abs(g - gaps[i]) <= GAME.limits.replayTolMs))) flags.push('replay');
  return {ok:!flags.length, flags, gaps};
}
// Too many events in the last minute?
const rateOk = (times, now) => (times || []).filter(x => now - x < 60000).length < GAME.limits.eventsPerMin;
// One event -> XP ledger rows. ctx: {ledger, sessions (earlier camera sessions), answered (A/B ids), restDays}.
// Returns {rows, why, flags}: rows empty with a reason when nothing is earned.
function awardFor(ev, ctx){
  const ledger = ctx.ledger || [], at = ev.at, day = gDay(at), X = GAME.xp;
  const today = k => ledger.filter(e => e.kind === k && gDay(e.at) === day).length;
  const row = (kind, xp, ref) => ({kind, xp:Math.max(0, Math.round(xp)), at, ref:ref == null ? null : ref});
  const none = (why, flags) => ({rows:[], why, flags:flags || []});
  if (GAME.once.includes(ev.kind) && ledger.some(e => e.kind === ev.kind)) return none('once');
  if (GAME.perDay[ev.kind] != null && today(ev.kind) >= GAME.perDay[ev.kind] && ev.kind !== 'ab') return none('daily_cap');
  const rows = [];
  if (ev.kind === 'alarm'){
    if (ev.verified){ const c = checkSession(ev, ctx.sessions); if (!c.ok) return none('rejected', c.flags); rows.push(row('alarm', X.alarm + X.perRep * ev.reps, ev.id)); }
    else rows.push(row('alarm', X.alarmTap, ev.id));
  } else if (ev.kind === 'tip'){
    if (ledger.some(e => e.kind === 'tip' && e.ref === ev.id)) return none('already_read');
    rows.push(row('tip', X.tip, ev.id));
  } else if (ev.kind === 'ab'){
    if ((ctx.answered || []).includes(ev.id) || ledger.some(e => e.kind === 'ab' && e.ref === ev.id)) return none('already_answered');
    if (today('ab') >= GAME.perDay.ab) return none('daily_cap');
    rows.push(row('ab', X.ab, ev.id));
  } else if (ev.kind === 'questionnaire') rows.push(row('questionnaire', X.questionnaire));
  else if (ev.kind === 'workout') rows.push(row('workout', X.workout, ev.id));
  else if (ev.kind === 'meal') rows.push(row('meal', X.meal, ev.id));
  else if (ev.kind === 'challenge') rows.push(row('challenge', Math.min(+ev.xp || 0, X.challengeMax), ev.id));
  else return none('unknown_kind');
  if (GAME.streakKinds.includes(ev.kind) && !ledger.some(e => e.kind === 'streak' && gDay(e.at) === day)){
    const days = ledger.filter(e => GAME.streakKinds.includes(e.kind)).map(e => gDay(e.at)).concat(day);
    const n = activeStreak(days, day, ctx.restDays);
    rows.push(row('streak', Math.min(X.streakMax, X.streakDay * n), n));
  }
  return {rows, why:'ok', flags:[]};
}
// Rankings: flagged accounts are left out. period 'week' counts only this week's XP.
function rankPlayers(players, opts){
  const o = opts || {}, wk = o.week;
  return (players || []).filter(p => p && !p.flagged && (!o.sector || p.sector === o.sector) && (!o.league || (p.leagues || []).includes(o.league)))
    .map(p => ({...p, score: o.period === 'week' ? (p.wk === wk ? +p.wxp || 0 : 0) : +p.xp || 0}))
    .sort((a, b) => b.score - a.score || String(a.since || '').localeCompare(String(b.since || '')) || String(a.uid).localeCompare(String(b.uid)))
    .map((p, i) => ({...p, pos:i + 1}));
}
// The rows around one player (n above and below), plus the top 3.
function around(list, uid, n){
  const i = list.findIndex(p => p.uid === uid), k = n == null ? 2 : n;
  if (i < 0) return {top:list.slice(0, 3), near:[]};
  return {top:list.slice(0, 3), near:list.slice(Math.max(0, i - k), i + k + 1)};
}
// Who went from behind (or level with) `me` to ahead of `me` between two score maps {uid: xp}.
function whoPassed(prev, now, me){
  if (prev[me] == null || now[me] == null) return [];
  return Object.keys(now).filter(u => u !== me && prev[u] != null && prev[u] <= prev[me] && now[u] > now[me]);
}
const overtakeLine = (nick, r) => OVERTAKE_LINES[Math.floor((r == null ? 0 : r) * OVERTAKE_LINES.length) % OVERTAKE_LINES.length].replace('{nick}', nick);
// Nicknames: 3-16 letters, numbers, dots, dashes or underscores. Uniqueness is checked ignoring case.
const nickOk = n => /^[A-Za-z0-9._-]{3,16}$/.test(String(n || ''));
const nickKey = n => String(n || '').toLowerCase();

export { GAME, isSuspicious, SECTORS, OVERTAKE_LINES, xpForLevel, levelInfo, pointsForLevel, levelUps, gDay, weekKey, sumXp, weekXp, activeStreak, checkSession, rateOk, awardFor, rankPlayers, around, whoPassed, overtakeLine, nickOk, nickKey };
