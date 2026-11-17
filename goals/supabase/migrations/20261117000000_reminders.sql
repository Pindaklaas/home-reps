-- =============================================================================
-- GOALS · timed tasks and push reminders
--
-- Tasks get a start time and an optional early reminder. A trigger keeps one
-- notification row per reminder. Every minute pg_cron hands the due ones to the
-- app's /api/notifications/dispatch endpoint (pg_net), which sends Web Push to
-- the owner's devices. The database never holds the VAPID private key; the app
-- never needs a service-role key.
-- =============================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------
-- Tasks: time of day and reminder
-- -----------------------------------------------------------------------------
alter table public.tasks
  add column scheduled_time time,
  add column remind_before_minutes smallint not null default 0 check (remind_before_minutes between 0 and 1440),
  add constraint tasks_time_needs_date check (scheduled_time is null or scheduled_date is not null);

-- -----------------------------------------------------------------------------
-- Notifications: link to the task, delivery state
-- -----------------------------------------------------------------------------
alter table public.notifications
  add column task_id uuid,
  add column sent_at timestamptz,
  add constraint notifications_task_fk foreign key (task_id, user_id)
    references public.tasks (id, user_id) on delete cascade;
create index notifications_due_idx on public.notifications (scheduled_for) where sent_at is null;
create index notifications_task_idx on public.notifications (task_id);

-- -----------------------------------------------------------------------------
-- Push subscriptions (one per device/browser)
-- -----------------------------------------------------------------------------
create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint     text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 2000),
  p256dh       text not null check (char_length(p256dh) <= 200),
  auth         text not null check (char_length(auth) <= 100),
  user_agent   text check (char_length(user_agent) <= 400),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
create policy "push_subscriptions: owner select" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()) and (select app_private.is_authorized()));
create policy "push_subscriptions: owner insert" on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()) and (select app_private.is_authorized()));
create policy "push_subscriptions: owner update" on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid()) and (select app_private.is_authorized()))
  with check (user_id = (select auth.uid()) and (select app_private.is_authorized()));
create policy "push_subscriptions: owner delete" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()) and (select app_private.is_authorized()));
revoke all on public.push_subscriptions from anon;

-- -----------------------------------------------------------------------------
-- Private settings for the dispatcher (URL and shared secret). Not exposed.
-- -----------------------------------------------------------------------------
create table app_private.settings (
  key   text primary key,
  value text not null
);
revoke all on app_private.settings from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Keep reminder rows in sync with the task
-- -----------------------------------------------------------------------------
create or replace function public.sync_task_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz   text;
  due  timestamptz;
  head text;
begin
  -- Drop reminders that have not gone out yet; they are rebuilt below.
  delete from public.notifications where task_id = new.id and sent_at is null;

  if new.status not in ('pending', 'in_progress') or new.scheduled_date is null or new.scheduled_time is null then
    return null;
  end if;

  select coalesce(p.timezone, 'Europe/Madrid') into tz from public.profiles p where p.id = new.user_id;
  due := (new.scheduled_date + new.scheduled_time) at time zone coalesce(tz, 'Europe/Madrid');
  head := left(new.title, 120);

  if due > now() then
    insert into public.notifications (user_id, task_id, kind, title, body, channel, link, scheduled_for)
    values (new.user_id, new.id, 'reminder', 'Ahora: ' || head, to_char(new.scheduled_time, 'HH24:MI') || ' · GOALS', 'push', '/planner', due);
  end if;

  if new.remind_before_minutes > 0 and due - make_interval(mins => new.remind_before_minutes) > now() then
    insert into public.notifications (user_id, task_id, kind, title, body, channel, link, scheduled_for)
    values (new.user_id, new.id, 'reminder',
            'En ' || new.remind_before_minutes || ' min: ' || head,
            'A las ' || to_char(new.scheduled_time, 'HH24:MI') || ' · GOALS', 'push', '/planner',
            due - make_interval(mins => new.remind_before_minutes));
  end if;
  return null;
end;
$$;
revoke all on function public.sync_task_notifications() from public, anon, authenticated;

create trigger tasks_notifications
  after insert or update of title, status, scheduled_date, scheduled_time, remind_before_minutes on public.tasks
  for each row execute function public.sync_task_notifications();

-- -----------------------------------------------------------------------------
-- Dispatcher: called every minute by pg_cron
-- -----------------------------------------------------------------------------
create or replace function app_private.dispatch_due_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  url    text := (select value from app_private.settings where key = 'dispatch_url');
  secret text := (select value from app_private.settings where key = 'dispatch_secret');
  items  jsonb;
  n      integer;
begin
  if url is null or secret is null then
    return 0; -- not configured (e.g. local development)
  end if;

  -- Claim due reminders (and skip ones more than 30 min late: not useful any more).
  with due as (
    update public.notifications n
       set sent_at = now()
     where n.sent_at is null
       and n.channel = 'push'
       and n.scheduled_for <= now()
    returning n.user_id, n.title, n.body, n.link, n.scheduled_for
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
           'title', d.title, 'body', d.body, 'url', coalesce(d.link, '/'))), '[]'::jsonb),
         count(*)
    into items, n
    from due d
    join public.push_subscriptions s on s.user_id = d.user_id
   where d.scheduled_for > now() - interval '30 minutes';

  if n > 0 then
    perform net.http_post(
      url := url,
      body := jsonb_build_object('notifications', items),
      headers := jsonb_build_object('content-type', 'application/json', 'x-dispatch-secret', secret),
      timeout_milliseconds := 10000
    );
  end if;
  return n;
end;
$$;
revoke all on function app_private.dispatch_due_notifications() from public, anon, authenticated;

select cron.schedule('goals-dispatch-notifications', '* * * * *', $$select app_private.dispatch_due_notifications()$$);
