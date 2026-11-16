-- RLS and integrity tests. Run with: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Two auth users: the authorized owner and an intruder who somehow got an account.
insert into auth.users (id, email, aud, role, instance_id)
values
  ('00000000-0000-0000-0000-0000000000a1', 'rls-owner@goals.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000b2', 'rls-intruder@goals.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;
-- Self-contained: authorize the test owner inside this (rolled back) transaction.
insert into app_private.authorized_users (email) values ('rls-owner@goals.test') on conflict do nothing;

select ok(exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'profile row is created for a new auth user');

-- ---------------------------------------------------------------- as owner
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"rls-owner@goals.test","role":"authenticated"}', true);

select ok(public.is_authorized(), 'owner is authorized');

insert into public.goals (id, title, is_primary) values ('10000000-0000-0000-0000-000000000001', 'Ahorrar 10k', true);
insert into public.projects (id, goal_id, title, status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Presupuesto', 'active');
insert into public.tasks (id, project_id, title) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Revisar gastos'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Abrir cuenta');
insert into public.ideas (id, title) values ('40000000-0000-0000-0000-000000000001', 'Newsletter');

select is((select user_id from public.goals where id = '10000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'user_id defaults to auth.uid()');

select throws_ok(
  $$insert into public.goals (title, user_id) values ('spoof', '00000000-0000-0000-0000-0000000000b2')$$,
  '42501', null, 'owner cannot insert rows for another user');

select throws_ok(
  $$insert into public.goals (title, is_primary) values ('second primary', true)$$,
  '23505', null, 'only one primary goal is allowed');

-- Completion and progress
update public.tasks set status = 'completed' where id = '30000000-0000-0000-0000-000000000001';
select isnt((select completed_at from public.tasks where id = '30000000-0000-0000-0000-000000000001'),
  null, 'completed_at is set when a task completes');
select is((select progress from public.project_progress where project_id = '20000000-0000-0000-0000-000000000001'),
  50, 'project progress is computed from tasks');
select is((select progress from public.goal_progress where goal_id = '10000000-0000-0000-0000-000000000001'),
  50, 'goal progress follows its projects');
update public.tasks set status = 'pending' where id = '30000000-0000-0000-0000-000000000001';
select is((select completed_at from public.tasks where id = '30000000-0000-0000-0000-000000000001'),
  null, 'completed_at clears when a task is reopened');

-- Time tracking
insert into public.time_entries (task_id, minutes) values ('30000000-0000-0000-0000-000000000001', 25), ('30000000-0000-0000-0000-000000000001', 20);
select is((select spent_minutes from public.tasks where id = '30000000-0000-0000-0000-000000000001'),
  45, 'spent_minutes is the sum of time entries');

-- Focus ranks
update public.tasks set scheduled_date = current_date, focus_rank = 1 where id = '30000000-0000-0000-0000-000000000001';
select throws_ok(
  $$update public.tasks set scheduled_date = current_date, focus_rank = 1 where id = '30000000-0000-0000-0000-000000000002'$$,
  '23505', null, 'two tasks cannot share a focus rank on the same day');

-- Activity log is written by triggers and is read-only
select ok((select count(*) from public.activity_log) >= 5, 'activity is logged by triggers');
select throws_ok(
  $$insert into public.activity_log (user_id, entity_type, entity_id, action) values (auth.uid(), 'x', gen_random_uuid(), 'created')$$,
  '42501', null, 'activity_log cannot be written by the client');

-- Ideas survive the deletion of the project they became
update public.ideas set converted_project_id = '20000000-0000-0000-0000-000000000001', status = 'converted'
  where id = '40000000-0000-0000-0000-000000000001';
delete from public.projects where id = '20000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.ideas where id = '40000000-0000-0000-0000-000000000001'), 1,
  'deleting a project never deletes the idea it came from');
select is((select count(*)::int from public.tasks where project_id is null), 2,
  'tasks are kept (unlinked) when their project is deleted');

-- The allowlist is not readable through the API role
select throws_ok($$select * from app_private.authorized_users$$, '42501', null,
  'authenticated users cannot read the allowlist');

-- ---------------------------------------------------------------- as intruder
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"rls-intruder@goals.test","role":"authenticated"}', true);

select ok(not public.is_authorized(), 'intruder is not authorized');
select is((select count(*)::int from public.goals), 0, 'intruder sees no goals');
select is((select count(*)::int from public.tasks), 0, 'intruder sees no tasks');
select is((select count(*)::int from public.ideas), 0, 'intruder sees no ideas');
select is((select count(*)::int from public.profiles), 0, 'intruder sees no profiles');
select throws_ok($$insert into public.goals (title) values ('mine now')$$, '42501', null,
  'intruder cannot insert even their own rows');

-- ---------------------------------------------------------------- as anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.goals$$, '42501', null, 'anon has no table access');
select throws_ok($$select * from public.ai_messages$$, '42501', null, 'anon cannot read conversations');

select * from finish();
rollback;
