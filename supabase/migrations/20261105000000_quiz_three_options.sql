-- Quizzes can have three options (A, B or C) and a date on which they are the tip of the day.
alter table public.ab_answers drop constraint if exists ab_answers_choice_check;
alter table public.ab_answers add constraint ab_answers_choice_check check (choice in ('a', 'b', 'c'));
alter table public.content add column if not exists day date;          -- tip of the day on this date (optional)
alter table public.content add column if not exists topic text;        -- short label, e.g. 'Ergonomics'
