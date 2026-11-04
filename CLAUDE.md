# Home Reps: notes for Claude

- This web app is the prototype of a native app (React Native + Expo, iOS and Android, English UI). Plans and decisions live in `docs/` (start with `docs/fase-1-arquitectura.md`); team docs are in Spanish.
- Single-file app: `index.html` holds all CSS, HTML and JS. Keep it dependency-free with no build step, so it runs from GitHub Pages and by opening the file.
- Data tables live near the top of the script: `EX_RAW` (exercises: id, name, muscle groups, equipment, level 1-3, dose, unit, steps), `STRETCH_RAW`, `MEALS`, `RECIPES` (Recipes tab; videos live in `media/` as .mp4 + .webm with a .jpg poster), `PLAN` (weekday split) and `GROUPS`.
- Muscle shapes are SVG paths in `FRONT_PATHS` / `BACK_PATHS` (viewBox 200x430). Paths marked `1` are mirrored to the other side.
- Colors are CSS variables on `:root` with dark-mode overrides; use the tokens, not literal colors.
- State is saved in `localStorage` under the `homereps.` prefix (profile, schedule, done, tab, mode, onboarding, health, plan, points, challenges; `survey` and `whyAsked`; `survey` is legacy and no longer read). Keep old keys readable when changing data shapes.
- Plan safety rules live in the `safety-core` block of `index.html` (pure functions, no DOM). Every plan draft, AI or local, must pass `validatePlan`. Run `node --test tests/*.test.mjs` after touching that block.
- Every open starts on the Challenge/Training picker. First use asks age in one tap (`gate` flow); Training then runs the 3-screen gym setup (`gym` flow) that builds a starter week on the device. Exercises with gym equipment only show for `track: 'gym'` users.
- The app has two modes picked on every open: Training (the tabs) and Challenge (`v-challenge` hub plus the full-screen `#arena`). Challenge catalog and progression rules live in the `challenge-core` block (pure functions, tested in `tests/challenges.test.mjs`); see `docs/retos-y-onboarding-corto.md`.
- Motion uses the `--spring` / `--out` easing tokens; JS checks `RM()` and CSS has a reduced-motion rule, so keep both working when adding animation.
- Test changes at phone width (about 400px) in light and dark mode.
