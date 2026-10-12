# Home Reps

A mobile-friendly home workout app. Open `index.html` in any browser, no build step needed.

## Features

- **Body**: front and back figure. Tap a muscle group to see exercises you can do at home, with step-by-step instructions.
- **Today**: a recommended workout for each weekday, adjusted to your goal and level, plus anything you scheduled yourself. Tick exercises off as you go.
- **Food**: a questionnaire (goal, body stats, activity, diet) that calculates daily calories and macros and suggests meals.
- **Schedule**: build your own week from exercises picked in the Body tab. Change sets, reps and order.

Your answers, schedule and progress are saved in the browser (`localStorage`) on the device you use.

## Run it

- Locally: open `index.html`, or run `python3 -m http.server` and visit http://localhost:8000.
- Online: enable GitHub Pages (Settings → Pages → Deploy from branch `main`, folder `/`) to get a public link you can open on your phone.

## Project layout

Everything lives in `index.html`: styles at the top, markup in the middle, and one script at the bottom with the data (`EX_RAW` exercises, `MEALS`, `PLAN` weekly split) followed by the rendering code.
