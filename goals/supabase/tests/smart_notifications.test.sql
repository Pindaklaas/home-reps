-- Smart notifications: timing, quiet hours/busy blocks, dedupe and preferences.
-- All times are fixed (p_now), Madrid time = UTC+1 in November.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role, instance_id, created_at) values
  ('00000000-0000-0000-0000-0000000005a1', 'smart-owner@goals.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', '2026-11-01');
insert into app_private.authorized_users (email) values ('smart-owner@goals.test');
update public.profiles set timezone = 'Europe/Madrid',
  busy_blocks = '[{"days":[1,2,3,4,5],"start":"08:15","end":"14:10","label":"Instituto"}]'
  where id = '00000000-0000-0000-0000-0000000005a1';

create temp table k as select '00000000-0000-0000-0000-0000000005a1'::uuid as uid;
create function pg_temp.n(kind text) returns int language sql as
  $$ select count(*)::int from public.notifications where user_id = (select uid from k) and notifications.kind = $1 $$;

-- Data (created in the past so age-based rules are deterministic).
insert into public.tasks (user_id, title, scheduled_date, scheduled_time, created_at) values
  ((select uid from k), 'Landing pages', '2026-11-18', '16:30', '2026-11-15'),
  ((select uid from k), 'Lista de negocios', '2026-11-18', '17:45', '2026-11-15');
insert into public.tasks (user_id, title, due_date, created_at) values ((select uid from k), 'Entregar web', '2026-11-19', '2026-11-15');
insert into public.ai_proposals (user_id, action, payload, summary, created_at)
  values ((select uid from k), 'create_idea', '{"title":"x"}', 'Guardar idea', '2026-11-15');
insert into public.goals (user_id, title, is_primary, progress_mode, metric_name, metric_unit, metric_target, target_date, created_at)
  values ((select uid from k), '5.000 €/mes', true, 'metric', 'Ingresos del mes', '€', 5000, '2026-12-31', '2026-11-10');

-- Wednesday 10:00 (school): nothing.
select app_private.generate_smart_notifications('2026-11-18 09:00:00+00');
select is((select count(*)::int from public.notifications where user_id = (select uid from k) and dedupe_key is not null), 0,
  'nothing is sent during school hours');

-- 14:20, right after school: briefing.
select app_private.generate_smart_notifications('2026-11-18 13:20:00+00');
select is(pg_temp.n('briefing'), 1, 'briefing right after school');
select ok((select body from public.notifications where kind = 'briefing' and user_id = (select uid from k)) like '16:30 Landing pages%',
  'the briefing lists the first timed tasks');
select app_private.generate_smart_notifications('2026-11-18 13:25:00+00');
select is(pg_temp.n('briefing'), 1, 'the briefing is not repeated');

-- 16:50: the 16:30 task is not yet 30 min late. 17:05: it is.
select app_private.generate_smart_notifications('2026-11-18 15:50:00+00');
select is(pg_temp.n('overdue'), 0, 'no nudge before 30 minutes');
select app_private.generate_smart_notifications('2026-11-18 16:05:00+00');
select is(pg_temp.n('overdue'), 1, 'nudge when a timed task is 30 min past and still open');
select ok((select title from public.notifications where kind = 'overdue' and user_id = (select uid from k)) = '¿Hiciste «Landing pages»?',
  'the nudge names the task');

-- Proposals pending for hours: once a day from 16:00.
select is(pg_temp.n('proposals'), 1, 'unreviewed proposals are flagged');

-- 19:30: something is due tomorrow.
select app_private.generate_smart_notifications('2026-11-18 18:30:00+00');
select is(pg_temp.n('deadline'), 1, 'deadline due tomorrow is flagged');

-- Goal metric with no data for 7+ days.
select is(pg_temp.n('goal'), 1, 'stale goal metric is flagged');

-- 21:10: evening wrap-up.
select app_private.generate_smart_notifications('2026-11-18 20:10:00+00');
select is(pg_temp.n('evening'), 1, 'evening wrap-up');

-- 23:30: quiet hours.
delete from public.notifications where user_id = (select uid from k);
select app_private.generate_smart_notifications('2026-11-18 22:30:00+00');
select is((select count(*)::int from public.notifications where user_id = (select uid from k) and dedupe_key is not null), 0,
  'nothing is sent in quiet hours');

-- Friday 17:30 with nothing completed in 48 h: inactivity nudge.
select app_private.generate_smart_notifications('2026-11-20 16:30:00+00');
select is(pg_temp.n('inactivity'), 1, 'two days without completing anything is flagged');

-- Sunday 18:45 (no school): weekly pace of the primary goal.
select app_private.generate_smart_notifications('2026-11-22 17:45:00+00');
select ok((select count(*) from public.notifications where kind = 'goal' and user_id = (select uid from k) and title like 'Semana:%') = 1,
  'weekly pace on Sunday evening');

-- Preferences: turning a kind off stops it.
update public.profiles set notify_prefs = '{"briefing": false}' where id = (select uid from k);
select app_private.generate_smart_notifications('2026-11-23 13:20:00+00');
select is((select count(*)::int from public.notifications where kind = 'briefing' and dedupe_key = 'briefing:2026-11-23'), 0,
  'a disabled kind is not sent');

-- Saturday 10:00 (no school, after 09:30): briefing is sent on free days too.
update public.profiles set notify_prefs = '{}' where id = (select uid from k);
select app_private.generate_smart_notifications('2026-11-21 09:00:00+00');
select is((select count(*)::int from public.notifications where dedupe_key = 'briefing:2026-11-21'), 1, 'briefing on free days at 09:30+');

select * from finish();
rollback;
