# Home Reps: notes for Claude

- This web app is the prototype of a native app (React Native + Expo, iOS and Android, English UI). Plans and decisions live in `docs/` (start with `docs/fase-1-arquitectura.md`); team docs are in Spanish.
- Single-file app: `index.html` holds all CSS, HTML and JS. Keep it dependency-free with no build step, so it runs from GitHub Pages and by opening the file.
- Data tables live near the top of the script: `EX_RAW` (exercises: id, name, muscle groups, equipment, level 1-3, dose, unit, steps), `STRETCH_RAW`, `MEALS`, `RECIPES` (Recipes tab; videos live in `media/` as .mp4 + .webm with a .jpg poster), `PLAN` (weekday split) and `GROUPS`.
- Muscle shapes are SVG paths in `FRONT_PATHS` / `BACK_PATHS` (viewBox 200x430). Paths marked `1` are mirrored to the other side.
- Colors are CSS variables on `:root` with dark-mode overrides; use the tokens, not literal colors.
- State is saved in `localStorage` under the `homereps.` prefix (profile, schedule, done, tab, survey). Keep old keys readable when changing data shapes.
- Motion uses the `--spring` / `--out` easing tokens; JS checks `RM()` and CSS has a reduced-motion rule, so keep both working when adding animation.
- Test changes at phone width (about 400px) in light and dark mode.
