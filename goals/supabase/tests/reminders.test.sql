-- Timed tasks, reminder rows, push subscription RLS and the dispatcher.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-00000000c0a1', 'rem-owner@goals.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-00000000c0b2', 'rem-intruder@goals.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into app_private.authorized_users (email) values ('rem-owner@goals.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c0a1","email":"rem-owner@goals.test","role":"authenticated"}', true);

-- A timed task tomorrow creates one reminder at its start time.
insert into public.tasks (id, title, scheduled_date, scheduled_time)
values ('50000000-0000-0000-0000-000000000001', 'Quedar con Jorge', current_date + 1, '16:00');
select is((select count(*)::int from public.notifications where task_id = '50000000-0000-0000-0000-000000000001'), 1,
  'a timed task gets a reminder at its start time');
select is((select title from public.notifications where task_id = '50000000-0000-0000-0000-000000000001'), 'Ahora: Quedar con Jorge',
  'the reminder names the task');
select is(
  (select scheduled_for from public.notifications where task_id = '50000000-0000-0000-0000-000000000001'),
  ((current_date + 1) + time '16:00') at time zone 'Europe/Madrid',
  'the reminder time uses the profile time zone');

-- An early reminder adds a second one.
update public.tasks set remind_before_minutes = 30 where id = '50000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.notifications where task_id = '50000000-0000-0000-0000-000000000001'), 2,
  'remind_before_minutes adds an early reminder');

-- Moving the time rebuilds the reminders instead of duplicating them.
update public.tasks set scheduled_time = '17:30' where id = '50000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.notifications where task_id = '50000000-0000-0000-0000-000000000001'), 2,
  'changing the time rebuilds reminders, no duplicates');

-- Completing the task removes pending reminders.
update public.tasks set status = 'completed' where id = '50000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.notifications where task_id = '50000000-0000-0000-0000-000000000001' and sent_at is null), 0,
  'completed tasks have no pending reminders');

-- A time needs a date.
select throws_ok($$insert into public.tasks (title, scheduled_time) values ('sin fecha', '10:00')$$, '23514', null,
  'a time without a date is rejected');

-- Push subscriptions belong to their owner.
insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example.test/abc', 'p', 'a');
select is((select count(*)::int from public.push_subscriptions), 1, 'owner can save a push subscription');
select throws_ok($$select * from app_private.settings$$, '42501', null, 'dispatcher settings are not readable');
select throws_ok($$select app_private.dispatch_due_notifications()$$, '42501', null, 'the app cannot call the dispatcher');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c0b2","email":"rem-intruder@goals.test","role":"authenticated"}', true);
select is((select count(*)::int from public.push_subscriptions), 0, 'another account sees no subscriptions');

-- Dispatcher (runs as the database owner via pg_cron).
reset role;
select is(app_private.dispatch_due_notifications(), 0, 'without settings the dispatcher does nothing');
insert into app_private.settings values ('dispatch_url', 'http://127.0.0.1:9/dispatch'), ('dispatch_secret', 'test-secret');
insert into public.notifications (user_id, kind, title, channel, scheduled_for)
values ('00000000-0000-0000-0000-00000000c0a1', 'reminder', 'Ahora: prueba', 'push', now() - interval '1 minute');
select is(app_private.dispatch_due_notifications(), 1, 'a due reminder is handed to the app for one device');

select * from finish();
rollback;
