# Home Reps: notes for Claude

- Single-file app: `index.html` holds all CSS, HTML and JS. Keep it dependency-free with no build step, so it runs from GitHub Pages and by opening the file.
- Data tables live near the top of the script: `EX_RAW` (exercises: id, name, muscle groups, equipment, level 1-3, dose, unit, steps), `MEALS`, `PLAN` (weekday split) and `GROUPS`.
- Demo videos live in `videos/` as an H.264 .mp4 plus a VP9 .webm (720px wide, compressed) and are linked by exercise id in `VIDEOS`; they show on the "How to" sheet.
- Muscle shapes are SVG paths in `FRONT_PATHS` / `BACK_PATHS` (viewBox 200x430). Paths marked `1` are mirrored to the other side.
- Colors are CSS variables on `:root` with dark-mode overrides; use the tokens, not literal colors.
- State is saved in `localStorage` under the `homereps.` prefix (profile, schedule, done, tab). Keep old keys readable when changing data shapes.
- Test changes at phone width (about 400px) in light and dark mode.

## How changes go live

- Juul (the owner) wants changes live without merge steps: commit and push straight to `main`. Do not create a separate branch or pull request unless the person asks for one.
- Before pushing, pull the latest `main` (`git pull origin main`) so you don't undo a change someone else just made, and test the page at phone width.
- `main` is what the website (pindaklaas.github.io/home-reps) shows, so only push changes that work.
