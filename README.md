# Neutrón

(Formerly Home Reps; the repository, file names and saved-data keys keep the old name.)

A fitness and nutrition app that gets you to train every day. The alarm only stops after you do your push-ups or squats in front of the camera. You earn XP and levels, compete in rankings and private leagues, and learn from short tips and A/B challenges.

This repository has two parts:

- **`index.html`**: the working prototype (web, single file, no build step). It is the reference for the native app (React Native + Expo).
- **`supabase/`**: the real backend for the app: database, security rules and server functions.

## Run the prototype

- Open `index.html` in a browser, or run `python3 -m http.server` and visit http://localhost:8000.
- Rankings, leagues and duels need shared storage. They work in the published version (the Claude link). On GitHub Pages or a local file, everything else works and your data stays on the phone.

## Put it on your phone like an app (not in the stores)

The app installs as a web app: icon on the home screen, full screen, works offline, and can show notifications.

1. Turn on GitHub Pages once: repository **Settings → Pages → Build and deployment → Deploy from a branch**, pick the branch with the latest app (`add-stretch-action` until it's merged, then `main`) and the `/ (root)` folder, and save. After a minute the app is at `https://pindaklaas.github.io/home-reps/`.
2. On the phone, open that address:
   - **iPhone (Safari):** Share button → **Add to Home Screen** → Add. Open it from the new icon (notifications only work from the icon, iOS 16.4 or newer).
   - **Android (Chrome):** menu ⋮ → **Install app** (or **Add to Home screen**).
   - No access to the repository settings? Upload the app folder (`index.html`, `manifest.webmanifest`, `sw.js`, `icons/`, `media/`, `vendor/`) to any static host, for example by dragging it onto app.netlify.com/drop, and open that address instead.
3. Open it from the icon, and if you want notifications: Help → Demo for videos → **Also show them as real phone notifications** → Allow.

The address is public but not listed anywhere: only people who have it can open it. Your data stays on the phone. Rankings, leagues, duels and the AI features only work in the Claude link, because they use its shared storage; the demo works everywhere.

## Run the tests

```bash
node --test tests/*.test.mjs        # app rules: XP, levels, caps, anti-cheat, rep counting, alarm, plans, animations, server logic
scripts/test-supabase.sh            # database security rules on a throwaway Postgres (needs Postgres 15+ installed)
```

## Set up the backend (Supabase)

1. Create a project at supabase.com (EU region) and install the Supabase CLI.
2. In this folder: `supabase init` (keep the existing files), then `supabase link --project-ref <your-ref>`.
3. `supabase db push` creates the tables and rules. `psql "$DB_URL" -f supabase/seed.sql` adds the starter tips and A/B challenges.
4. `supabase functions deploy submit-event` and `supabase functions deploy delete-account`.
5. In Authentication, turn on email, Apple and Google sign-in.

How it fits together:

- The app signs in, creates its row in `profiles` (nickname, sector, questionnaire answers), and sends every activity to `submit-event`.
- The function checks the event with `game-core` (the same rules as the app), writes the XP and points ledgers, flags suspicious accounts and sends a push to every league mate you pass.
- The app can only read its own data. Rankings come from the `ranking(scope, key, period)` function, which returns nicknames only.
- Add tips and A/B challenges as rows in `content` (from the dashboard); no app update needed.

Known limit: the server counts days in UTC, so "one alarm a day" resets at 01:00 or 02:00 in Spain. A per-user time zone is a later step.

## How to add an exercise

1. Add a row to `EX_RAW` in `index.html`: id, name, muscle groups, equipment, level 1-3, dose, unit, steps.
2. Add its animation to `ANIMS` (one or more key poses; copy a similar exercise). `tests/anim.test.mjs` fails until you do.
3. For camera counting, add the joint angles to `REP_RULES`, the cues to `CUES` and the phone position to `POSE_VIEW` in the `pose-core` block, and the limits to `GAME.limits.rep` in `game-core` (then run `node scripts/sync-game-core.mjs`). To offer it for the alarm, add it to `ALARM_MOVES` with reps for Easy, Medium and Hard. Add a test with a recorded or simulated pose sequence in `tests/pose.test.mjs`.

## How to tune XP, levels and limits

Every number is in the `GAME` object at the top of the `game-core` block in `index.html`:

- `xp`: XP for each activity (alarm 30 + 1 per rep, streak +10 per day up to +50, tip 2, A/B 5, questionnaire 20, workout, meal, challenge).
- `perDay`: daily caps (one alarm a day, 3 tips, 3 A/B…). `once`: rewards given only once.
- `level`: the curve (XP for the next level = base × level^exp). `pointsPerLevel`: points on each level-up.
- `limits`: anti-cheat (events per minute, minimum time per rep, reps per minute, reps per day, replay tolerance, minimum camera confidence). `suspicious`: the flags that take an account out of the rankings.

After changing it, run `node scripts/sync-game-core.mjs` so the server uses the same numbers, then run the tests.

## Privacy

- Camera frames are processed on the phone and never stored or sent. Only counts and rep timings reach the server.
- Other people only ever see your nickname, level and XP.
- Health and questionnaire answers are only sent with your consent, and you can delete your account (and everything in it) from the app.
