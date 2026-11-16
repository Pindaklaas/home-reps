-- =============================================================================
-- GOALS · initial schema
--
-- Single-user private app. Every table carries user_id and is protected by RLS:
-- a row is visible only to its owner AND only if that owner is on the private
-- allowlist (app_private.authorized_users). Sign-ups are closed in Supabase Auth,
-- so the allowlist is a second, independent lock.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Private schema (not exposed through the Data API)
-- -----------------------------------------------------------------------------
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;

create table app_private.authorized_users (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
revoke all on app_private.authorized_users from public, anon, authenticated;
grant all on app_private.authorized_users to service_role;

-- True when the caller's verified JWT email is on the allowlist.
create or replace function app_private.is_authorized()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_private.authorized_users a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function app_private.is_authorized() from public, anon;
grant execute on function app_private.is_authorized() to authenticated;

-- Lets the app ask "am I allowed in?" without seeing the allowlist itself.
create or replace function public.is_authorized()
returns boolean
language sql
stable
set search_path = ''
as $$ select app_private.is_authorized(); $$;
revoke all on function public.is_authorized() from public, anon;
grant execute on function public.is_authorized() to authenticated;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.priority_level as enum ('low', 'medium', 'high', 'critical');
create type public.goal_status as enum ('active', 'paused', 'completed', 'archived');
create type public.goal_progress_mode as enum ('manual', 'metric', 'projects');
create type public.project_status as enum ('idea', 'planned', 'active', 'paused', 'completed', 'cancelled');
create type public.task_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type public.idea_status as enum ('new', 'exploring', 'validated', 'converted', 'parked', 'discarded');
create type public.decision_status as enum ('proposed', 'approved', 'rejected', 'revisited');
create type public.memory_kind as enum ('fact', 'idea', 'recommendation', 'decision', 'summary', 'preference');
create type public.proposal_status as enum ('pending', 'approved', 'rejected', 'applied', 'failed');
create type public.source_kind as enum ('user', 'ai');

-- -----------------------------------------------------------------------------
-- Shared trigger functions
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  display_name            text check (char_length(display_name) <= 80),
  timezone                text not null default 'Europe/Madrid' check (char_length(timezone) <= 64),
  locale                  text not null default 'es-ES' check (char_length(locale) <= 16),
  daily_capacity_minutes  integer not null default 360 check (daily_capacity_minutes between 0 and 1440),
  week_starts_on          smallint not null default 1 check (week_starts_on between 0 and 6),
  theme                   text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  ai_enabled              boolean not null default true,
  ai_effort               text not null default 'medium' check (ai_effort in ('low', 'medium', 'high')),
  ai_include_context      boolean not null default true,
  ai_instructions         text check (char_length(ai_instructions) <= 4000),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile row when the auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- goals
-- -----------------------------------------------------------------------------
create table public.goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 160),
  description     text check (char_length(description) <= 5000),
  category        text not null default 'personal' check (char_length(category) between 1 and 40),
  target_date     date,
  priority        public.priority_level not null default 'medium',
  status          public.goal_status not null default 'active',
  is_primary      boolean not null default false,
  progress_mode   public.goal_progress_mode not null default 'projects',
  manual_progress numeric(5, 2) not null default 0 check (manual_progress between 0 and 100),
  metric_name     text check (char_length(metric_name) <= 80),
  metric_unit     text check (char_length(metric_unit) <= 20),
  metric_start    numeric not null default 0,
  metric_target   numeric,
  metric_current  numeric not null default 0,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, user_id),
  check (progress_mode <> 'metric' or (metric_target is not null and metric_target <> metric_start))
);

create index goals_user_status_idx on public.goals (user_id, status);
-- At most one primary goal per user.
create unique index goals_one_primary_idx on public.goals (user_id) where is_primary;

create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

-- History of metric values (evolution of a goal's KPI).
create table public.goal_checkins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id     uuid not null,
  value       numeric not null,
  note        text check (char_length(note) <= 1000),
  recorded_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);
create index goal_checkins_goal_idx on public.goal_checkins (goal_id, recorded_at desc);
create index goal_checkins_user_idx on public.goal_checkins (user_id);

-- Keep goals.metric_current in sync with the latest check-in.
create or replace function public.sync_goal_metric()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.goals g
     set metric_current = coalesce((
           select c.value from public.goal_checkins c
            where c.goal_id = g.id
            order by c.recorded_at desc, c.created_at desc
            limit 1), g.metric_start)
   where g.id = coalesce(new.goal_id, old.goal_id);
  return null;
end;
$$;

create trigger goal_checkins_sync after insert or update or delete on public.goal_checkins
  for each row execute function public.sync_goal_metric();

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id      uuid,
  title        text not null check (char_length(title) between 1 and 160),
  description  text check (char_length(description) <= 5000),
  status       public.project_status not null default 'planned',
  priority     public.priority_level not null default 'medium',
  due_date     date,
  notes        text check (char_length(notes) <= 20000),
  outcomes     text check (char_length(outcomes) <= 10000),
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id)
);
create index projects_user_status_idx on public.projects (user_id, status);
create index projects_goal_idx on public.projects (goal_id);

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
create table public.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id        uuid,
  title             text not null check (char_length(title) between 1 and 200),
  description       text check (char_length(description) <= 5000),
  priority          public.priority_level not null default 'medium',
  status            public.task_status not null default 'pending',
  due_date          date,
  scheduled_date    date,
  -- 1..3 marks the task as one of the three priorities of its scheduled_date.
  focus_rank        smallint check (focus_rank between 1 and 3),
  estimated_minutes integer check (estimated_minutes between 0 and 10000),
  spent_minutes     integer not null default 0 check (spent_minutes >= 0),
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, user_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id),
  check (focus_rank is null or scheduled_date is not null)
);
create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_scheduled_idx on public.tasks (user_id, scheduled_date);
create index tasks_due_idx on public.tasks (user_id, due_date) where status in ('pending', 'in_progress');
create index tasks_completed_idx on public.tasks (user_id, completed_at) where completed_at is not null;
create unique index tasks_focus_unique_idx on public.tasks (user_id, scheduled_date, focus_rank)
  where focus_rank is not null;

create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- completed_at follows status, for tasks, projects and goals.
create or replace function public.track_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status::text = 'completed' and (tg_op = 'INSERT' or old.status::text <> 'completed') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status::text <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_completion before insert or update of status on public.tasks
  for each row execute function public.track_completion();
create trigger projects_completion before insert or update of status on public.projects
  for each row execute function public.track_completion();
create trigger goals_completion before insert or update of status on public.goals
  for each row execute function public.track_completion();

create or replace function public.track_project_start()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and new.started_at is null then
    new.started_at := now();
  end if;
  return new;
end;
$$;
create trigger projects_start before insert or update of status on public.projects
  for each row execute function public.track_project_start();

-- -----------------------------------------------------------------------------
-- time_entries (time invested; tasks.spent_minutes is their sum)
-- -----------------------------------------------------------------------------
create table public.time_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id    uuid not null,
  minutes    integer not null check (minutes between 1 and 1440),
  note       text check (char_length(note) <= 500),
  logged_on  date not null default current_date,
  created_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);
create index time_entries_task_idx on public.time_entries (task_id);
create index time_entries_user_date_idx on public.time_entries (user_id, logged_on);

create or replace function public.sync_task_spent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected uuid[];
begin
  affected := array_remove(array[
    case when tg_op <> 'INSERT' then old.task_id end,
    case when tg_op <> 'DELETE' then new.task_id end
  ], null);
  update public.tasks t
     set spent_minutes = coalesce((select sum(e.minutes) from public.time_entries e where e.task_id = t.id), 0)
   where t.id = any (affected);
  return null;
end;
$$;

create trigger time_entries_sync after insert or update or delete on public.time_entries
  for each row execute function public.sync_task_spent();

-- -----------------------------------------------------------------------------
-- ideas (never removed automatically: no cascading delete reaches this table
-- except deleting the auth user itself)
-- -----------------------------------------------------------------------------
create table public.ideas (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title                text not null check (char_length(title) between 1 and 160),
  description          text check (char_length(description) <= 10000),
  category             text not null default 'general' check (char_length(category) between 1 and 40),
  potential            smallint check (potential between 1 and 5),
  difficulty           smallint check (difficulty between 1 and 5),
  estimated_cost       numeric(12, 2) check (estimated_cost >= 0),
  currency             text not null default 'EUR' check (char_length(currency) = 3),
  status               public.idea_status not null default 'new',
  ai_evaluation        jsonb,
  ai_evaluated_at      timestamptz,
  converted_project_id uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, user_id),
  foreign key (converted_project_id, user_id) references public.projects (id, user_id)
    on delete set null (converted_project_id)
);
create index ideas_user_status_idx on public.ideas (user_id, status);

create trigger ideas_updated_at before update on public.ideas
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- decisions (decision log)
-- -----------------------------------------------------------------------------
create table public.decisions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  context     text check (char_length(context) <= 10000),
  options     jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  decision    text check (char_length(decision) <= 5000),
  rationale   text check (char_length(rationale) <= 10000),
  status      public.decision_status not null default 'proposed',
  source      public.source_kind not null default 'user',
  goal_id     uuid,
  project_id  uuid,
  idea_id     uuid,
  decided_at  timestamptz,
  review_on   date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id),
  foreign key (idea_id, user_id) references public.ideas (id, user_id) on delete set null (idea_id)
);
create index decisions_user_idx on public.decisions (user_id, created_at desc);

create trigger decisions_updated_at before update on public.decisions
  for each row execute function public.set_updated_at();

create or replace function public.track_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('approved', 'rejected') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.decided_at := coalesce(new.decided_at, now());
  end if;
  return new;
end;
$$;
create trigger decisions_decided before insert or update of status on public.decisions
  for each row execute function public.track_decision();

-- -----------------------------------------------------------------------------
-- daily_logs (one row per day)
-- -----------------------------------------------------------------------------
create table public.daily_logs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date             date not null,
  intention            text check (char_length(intention) <= 1000),
  available_minutes    integer check (available_minutes between 0 and 1440),
  energy               smallint check (energy between 1 and 5),
  summary              text check (char_length(summary) <= 5000),
  ai_plan              jsonb,
  ai_plan_at           timestamptz,
  ai_recommendation    jsonb,
  ai_recommendation_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, log_date)
);

create trigger daily_logs_updated_at before update on public.daily_logs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- AI: conversations, messages, proposals, memory
-- -----------------------------------------------------------------------------
create table public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null default 'Nueva conversación' check (char_length(title) between 1 and 160),
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);

create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create table public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  conversation_id uuid not null,
  role            text not null check (role in ('user', 'assistant')),
  -- Plain text shown in the UI.
  content         text not null default '' check (char_length(content) <= 200000),
  -- Full API content blocks for the assistant turn (text, thinking, tool_use and
  -- the matching tool_result turn), replayed unchanged on the next request.
  api_content     jsonb,
  model           text,
  usage           jsonb,
  stop_reason     text,
  created_at      timestamptz not null default now(),
  unique (id, user_id),
  foreign key (conversation_id, user_id) references public.ai_conversations (id, user_id) on delete cascade
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

-- Touch the conversation when a message lands, so lists sort by activity.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_conversations set updated_at = now() where id = new.conversation_id;
  return null;
end;
$$;
create trigger ai_messages_touch after insert on public.ai_messages
  for each row execute function public.touch_conversation();

-- Changes Claude suggests. Nothing here is applied until the user approves it.
create table public.ai_proposals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  conversation_id   uuid,
  message_id        uuid,
  action            text not null check (action in (
                      'create_goal', 'update_goal', 'create_project', 'update_project',
                      'create_task', 'update_task', 'create_idea', 'record_decision', 'save_memory')),
  target_id         uuid,
  payload           jsonb not null,
  summary           text not null check (char_length(summary) between 1 and 300),
  rationale         text check (char_length(rationale) <= 4000),
  status            public.proposal_status not null default 'pending',
  error             text,
  applied_entity_id uuid,
  decided_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (conversation_id, user_id) references public.ai_conversations (id, user_id)
    on delete set null (conversation_id),
  foreign key (message_id, user_id) references public.ai_messages (id, user_id)
    on delete set null (message_id)
);
create index ai_proposals_user_status_idx on public.ai_proposals (user_id, status, created_at desc);
create index ai_proposals_conversation_idx on public.ai_proposals (conversation_id);

create trigger ai_proposals_updated_at before update on public.ai_proposals
  for each row execute function public.set_updated_at();

-- Long-term memory. kind + confirmed encode what Claude may treat as true:
--   fact/preference + confirmed  -> confirmed information
--   idea                         -> still an idea
--   recommendation               -> Claude's advice, not a fact
--   decision + confirmed         -> an approved decision
create table public.ai_memory (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        public.memory_kind not null,
  content     text not null check (char_length(content) between 1 and 4000),
  confirmed   boolean not null default false,
  source      public.source_kind not null default 'user',
  pinned      boolean not null default false,
  goal_id     uuid,
  project_id  uuid,
  period_start date,
  period_end   date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id)
);
create index ai_memory_user_kind_idx on public.ai_memory (user_id, kind, created_at desc);

create trigger ai_memory_updated_at before update on public.ai_memory
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- notifications (in-app now; email/push channels are prepared for later)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('reminder', 'daily_summary', 'weekly_review', 'ai', 'system')),
  title         text not null check (char_length(title) between 1 and 160),
  body          text check (char_length(body) <= 4000),
  channel       text not null default 'in_app' check (channel in ('in_app', 'email', 'push')),
  link          text check (link is null or link like '/%'),
  scheduled_for timestamptz,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

-- -----------------------------------------------------------------------------
-- activity_log (written by triggers; read-only for the app)
-- -----------------------------------------------------------------------------
create table public.activity_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id   uuid not null,
  action      text not null check (action in ('created', 'updated', 'status_changed', 'deleted')),
  title       text,
  from_status text,
  to_status   text,
  created_at  timestamptz not null default now()
);
create index activity_log_user_idx on public.activity_log (user_id, created_at desc);

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec     record;
  act     text;
  old_st  text;
  new_st  text;
begin
  if tg_op = 'DELETE' then
    rec := old;
    act := 'deleted';
  else
    rec := new;
    if tg_op = 'INSERT' then
      act := 'created';
    else
      old_st := to_jsonb(old) ->> 'status';
      new_st := to_jsonb(new) ->> 'status';
      if old_st is distinct from new_st then
        act := 'status_changed';
      else
        -- Plain edits are not logged, to keep the feed meaningful.
        return null;
      end if;
    end if;
  end if;

  insert into public.activity_log (user_id, entity_type, entity_id, action, title, from_status, to_status)
  values (
    rec.user_id,
    tg_table_name,
    rec.id,
    act,
    left(to_jsonb(rec) ->> 'title', 200),
    old_st,
    coalesce(new_st, to_jsonb(rec) ->> 'status')
  );
  return null;
end;
$$;

create trigger goals_activity after insert or update or delete on public.goals
  for each row execute function public.log_activity();
create trigger projects_activity after insert or update or delete on public.projects
  for each row execute function public.log_activity();
create trigger tasks_activity after insert or update or delete on public.tasks
  for each row execute function public.log_activity();
create trigger ideas_activity after insert or update or delete on public.ideas
  for each row execute function public.log_activity();
create trigger decisions_activity after insert or update or delete on public.decisions
  for each row execute function public.log_activity();

-- -----------------------------------------------------------------------------
-- Views (security_invoker: they run with the caller's RLS)
-- -----------------------------------------------------------------------------
create view public.project_progress
with (security_invoker = true) as
select
  p.id as project_id,
  p.user_id,
  count(t.id) filter (where t.status <> 'cancelled')::int  as total_tasks,
  count(t.id) filter (where t.status = 'completed')::int   as completed_tasks,
  coalesce(sum(t.spent_minutes), 0)::int                   as spent_minutes,
  coalesce(sum(t.estimated_minutes) filter (where t.status <> 'cancelled'), 0)::int as estimated_minutes,
  case
    when p.status = 'completed' then 100
    when count(t.id) filter (where t.status <> 'cancelled') = 0 then 0
    else round(100.0 * count(t.id) filter (where t.status = 'completed')
               / count(t.id) filter (where t.status <> 'cancelled'))
  end::int as progress
from public.projects p
left join public.tasks t on t.project_id = p.id
group by p.id, p.user_id, p.status;

create view public.goal_progress
with (security_invoker = true) as
select
  g.id as goal_id,
  g.user_id,
  (case
    when g.status = 'completed' then 100
    when g.progress_mode = 'manual' then g.manual_progress
    when g.progress_mode = 'metric' then
      greatest(0, least(100, round(100.0 * (g.metric_current - g.metric_start)
                                        / nullif(g.metric_target - g.metric_start, 0))))
    else coalesce((
      select round(avg(pp.progress))
      from public.projects p
      join public.project_progress pp on pp.project_id = p.id
      where p.goal_id = g.id and p.status <> 'cancelled'), 0)
  end)::int as progress
from public.goals g;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'goals', 'goal_checkins', 'projects', 'tasks', 'time_entries', 'ideas', 'decisions',
    'daily_logs', 'ai_conversations', 'ai_messages', 'ai_proposals', 'ai_memory', 'notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$
      create policy "%1$s: owner select" on public.%1$I for select to authenticated
        using (user_id = (select auth.uid()) and (select app_private.is_authorized()))$p$, t);
    execute format($p$
      create policy "%1$s: owner insert" on public.%1$I for insert to authenticated
        with check (user_id = (select auth.uid()) and (select app_private.is_authorized()))$p$, t);
    execute format($p$
      create policy "%1$s: owner update" on public.%1$I for update to authenticated
        using (user_id = (select auth.uid()) and (select app_private.is_authorized()))
        with check (user_id = (select auth.uid()) and (select app_private.is_authorized()))$p$, t);
    execute format($p$
      create policy "%1$s: owner delete" on public.%1$I for delete to authenticated
        using (user_id = (select auth.uid()) and (select app_private.is_authorized()))$p$, t);
  end loop;
end;
$$;

-- profiles: keyed by id; rows are created by the auth trigger, never by the client.
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
create policy "profiles: owner select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) and (select app_private.is_authorized()));
create policy "profiles: owner update" on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select app_private.is_authorized()))
  with check (id = (select auth.uid()) and (select app_private.is_authorized()));

-- activity_log: read-only from the app (triggers write it as definer).
alter table public.activity_log enable row level security;
alter table public.activity_log force row level security;
create policy "activity_log: owner select" on public.activity_log for select to authenticated
  using (user_id = (select auth.uid()) and (select app_private.is_authorized()));

-- -----------------------------------------------------------------------------
-- Grants: nothing for anon; authenticated works only through RLS.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

revoke insert, update, delete on public.activity_log from authenticated;
revoke insert, delete on public.profiles from authenticated;
-- Internal trigger helpers are not part of the API.
revoke all on function public.handle_new_user() from public, authenticated;
revoke all on function public.log_activity() from public, authenticated;
revoke all on function public.sync_goal_metric() from public, authenticated;
revoke all on function public.sync_task_spent() from public, authenticated;
revoke all on function public.touch_conversation() from public, authenticated;
