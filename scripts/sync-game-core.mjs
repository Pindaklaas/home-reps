// Copies the game-core block of index.html into the Supabase functions, so the server checks XP with the same rules as the app.
// Run after changing game-core: node scripts/sync-game-core.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = html.split('/* game-core:start')[1].split('/* game-core:end */')[0].replace(/^[^\n]*\n/, '').trim();
const out = `// GENERATED from index.html (game-core block) by scripts/sync-game-core.mjs. Do not edit here.\n${block}\n\nexport { GAME, isSuspicious, SECTORS, OVERTAKE_LINES, xpForLevel, levelInfo, pointsForLevel, levelUps, gDay, weekKey, sumXp, weekXp, activeStreak, checkSession, rateOk, awardFor, rankPlayers, around, whoPassed, overtakeLine, nickOk, nickKey };\n`;
writeFileSync(new URL('../supabase/functions/_shared/game-core.mjs', import.meta.url), out);
console.log('supabase/functions/_shared/game-core.mjs updated');
