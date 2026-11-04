-- Starter content: 3 tips and 3 A/B challenges (same as the app's built-in ones). Add more rows any time; no app update needed.
insert into public.content (id, type, sort, title, body, day, topic) values
  ('quiz-ergonomics', 'ab', 0, 'How do you pick up the weight?', '{"a":{"label":"Round your back, straight legs","anim":"lift-round"},"b":{"label":"Close to you, hips back, flat back","anim":"lift-good"},"c":{"label":"Reach out in front of you","anim":"lift-far"},"correct":"b","why":"Keep the weight close and push your hips back with a flat back: your legs and glutes do the work. Round-backed or far away, the load lands on your lower back."}', '2026-11-04', 'Ergonomics')
on conflict (id) do nothing;

insert into public.content (id, type, sort, title, body) values
  ('tip-breathe', 'tip', 1, 'Breathe out on the effort', '{"text":"Exhale as you push up or stand up, inhale on the way down. Your core stays tight and every rep feels steadier.","anim":"squat"}'),
  ('tip-sleep', 'tip', 2, 'Sleep is part of training', '{"text":"Most muscle repair happens while you sleep. Seven to nine hours does more for your progress than any supplement."}'),
  ('tip-protein', 'tip', 3, 'Protein at every meal', '{"text":"A palm-sized portion of protein at each of 3 or 4 meals builds more muscle than one huge serving at dinner."}'),
  ('ab-pushup', 'ab', 1, 'Which push-up is right?', '{"a":{"label":"Body in one line","anim":"pushup"},"b":{"label":"Hips dropping","anim":"pushup-sag"},"correct":"a","why":"A straight line from head to heels protects your lower back and makes your chest and core do the work."}'),
  ('ab-squat', 'ab', 2, 'Which squat counts?', '{"a":{"label":"Half way down","anim":"squat-half"},"b":{"label":"Hips below the knees","anim":"squat"},"correct":"b","why":"Going down until the hips pass the knees works your glutes and quads through the full range. Half reps build half the strength."}'),
  ('ab-plank', 'ab', 3, 'Which plank works your core?', '{"a":{"label":"Hips up high","anim":"plank-pike"},"b":{"label":"Flat like a board","anim":"plank"},"correct":"b","why":"With the hips high your shoulders take the load and your abs switch off. Flat, your whole core has to hold you."}')
on conflict (id) do nothing;
