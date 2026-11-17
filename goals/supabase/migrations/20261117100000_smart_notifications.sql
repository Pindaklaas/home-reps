-- =============================================================================
-- GOALS · smart notifications
--
-- Besides task reminders, a generator (pg_cron, every 5 minutes) looks at the
-- owner's data and creates nudges: daily briefing, unchecked tasks, deadlines,
-- unreviewed proposals, stale goal metrics, weekly pace, inactivity and an
-- evening wrap-up. It never writes inside quiet hours or busy blocks (school),
-- each nudge has a dedupe key so it is sent once, and every kind can be turned
-- off in Settings. Delivery reuses the push dispatcher; all of them also show
-- in the in-app notification center.
-- =============================================================================

alter table public.profiles
  add column notify_prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(notify_prefs) = 'object'),
  add column quiet_start time not null default '22:30',
  add column quiet_end time not null default '08:00',
  -- [{"days":[1,2,3,4,5],"start":"08:15","end":"14:10","label":"Instituto"}]  (days: 0 = Sunday)
  add column busy_blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(busy_blocks) = 'array');

alter table public.notifications add column dedupe_key text check (char_length(dedupe_key) <= 200);
create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

-- Allowed kinds now include the smart ones.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'reminder', 'daily_summary', 'weekly_review', 'ai', 'system',
  'briefing', 'overdue', 'deadline', 'proposals', 'goal', 'inactivity', 'evening'));

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
-- Is a local time inside the profile's quiet hours or a busy block for that weekday?
create or replace function app_private.is_quiet(p public.profiles, local_ts timestamp)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    (case when p.quiet_start > p.quiet_end
          then local_ts::time >= p.quiet_start or local_ts::time < p.quiet_end
          else local_ts::time >= p.quiet_start and local_ts::time < p.quiet_end end)
    or exists (
      select 1 from jsonb_array_elements(p.busy_blocks) b
      where (b -> 'days') @> to_jsonb(extract(dow from local_ts)::int)
        and local_ts::time >= (b ->> 'start')::time
        and local_ts::time < (b ->> 'end')::time
    );
$$;

-- When busy time ends today (e.g. school), so the briefing lands right after it.
create or replace function app_private.busy_end(p public.profiles, local_day date)
returns time
language sql
stable
set search_path = ''
as $$
  select max((b ->> 'end')::time)
  from jsonb_array_elements(p.busy_blocks) b
  where (b -> 'days') @> to_jsonb(extract(dow from local_day)::int);
$$;

create or replace function app_private.wants(p public.profiles, kind text)
returns boolean
language sql
stable
set search_path = ''
as $$ select coalesce((p.notify_prefs ->> kind)::boolean, true); $$;

-- -----------------------------------------------------------------------------
-- Generator
-- -----------------------------------------------------------------------------
create or replace function app_private.generate_smart_notifications(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p          public.profiles;
  tz         text;
  lnow       timestamp;     -- local wall-clock time
  today      date;
  tomorrow   date;
  t          time;
  briefing_t time;
  created    integer := 0;
  n          integer;
  m          integer;
  rec        record;
  txt        text;
  week_key   text;
begin
  for p in
    select pr.* from public.profiles pr
    join auth.users u on u.id = pr.id
    join app_private.authorized_users a on a.email = lower(u.email)
  loop
    tz := coalesce(p.timezone, 'Europe/Madrid');
    lnow := p_now at time zone tz;
    today := lnow::date;
    tomorrow := today + 1;
    t := lnow::time;
    week_key := to_char(lnow, 'IYYY-IW');

    if app_private.is_quiet(p, lnow) then
      continue;
    end if;

    -- 1. Daily briefing: right after busy time (school) or 09:30 on free days.
    briefing_t := coalesce(app_private.busy_end(p, today) + interval '5 minutes', time '09:30');
    if app_private.wants(p, 'briefing') and t >= briefing_t then
      select count(*) into n from public.tasks
        where user_id = p.id and scheduled_date = today and status in ('pending','in_progress');
      select string_agg(to_char(scheduled_time, 'HH24:MI') || ' ' || left(title, 40), ' · ' order by scheduled_time)
        into txt
        from (select scheduled_time, title from public.tasks
              where user_id = p.id and scheduled_date = today and status in ('pending','in_progress') and scheduled_time is not null
              order by scheduled_time limit 3) x;
      insert into public.notifications (user_id, kind, title, body, channel, link, scheduled_for, dedupe_key)
      values (p.id, 'briefing',
              case when n = 0 then 'Hoy no tienes nada planificado' else 'Hoy: ' || n || case when n = 1 then ' tarea' else ' tareas' end end,
              case when n = 0 then 'Elige tus 3 prioridades o pide a Claude un plan para hoy.' else coalesce(txt, 'Sin horas fijas: elige por cuál empiezas.') end,
              'push', '/planner', p_now, 'briefing:' || today)
      on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    end if;

    -- 2. A timed task started 30+ min ago and is still open: did you do it?
    if app_private.wants(p, 'overdue') then
      for rec in
        select id, title from public.tasks
        where user_id = p.id and status in ('pending','in_progress')
          and scheduled_date = today and scheduled_time is not null
          and (today + scheduled_time) <= lnow - interval '30 minutes'
          and (today + scheduled_time) > lnow - interval '6 hours'
      loop
        insert into public.notifications (user_id, task_id, kind, title, body, channel, link, scheduled_for, dedupe_key)
        values (p.id, rec.id, 'overdue', '¿Hiciste «' || left(rec.title, 60) || '»?',
                'Márcala como hecha o reprográmala para no perderla.', 'push', '/planner', p_now, 'overdue:' || rec.id || ':' || today)
        on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
      end loop;
    end if;

    -- 3. Deadlines: due tomorrow (from 19:00) and already late (from 17:00).
    if app_private.wants(p, 'deadline') then
      if t >= time '19:00' then
        for rec in
          select 'tasks' as kind, id, title from public.tasks
            where user_id = p.id and due_date = tomorrow and status in ('pending','in_progress')
          union all
          select 'projects', id, title from public.projects
            where user_id = p.id and due_date = tomorrow and status not in ('completed','cancelled')
        loop
          insert into public.notifications (user_id, kind, title, body, channel, link, scheduled_for, dedupe_key)
          values (p.id, 'deadline', 'Mañana vence «' || left(rec.title, 60) || '»',
                  case when rec.kind = 'tasks' then 'Tarea pendiente.' else 'Proyecto sin terminar.' end,
                  'push', case when rec.kind = 'tasks' then '/tasks' else '/projects/' || rec.id end, p_now, 'due:' || rec.id || ':' || tomorrow)
          on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
        end loop;
      end if;
      if t >= time '17:00' then
        select count(*) into n from public.tasks
          where user_id = p.id and due_date < today and status in ('pending','in_progress');
        if n > 0 then
          insert into public.notifications (user_id, kind, title, body, channel, link, scheduled_for, dedupe_key)
          values (p.id, 'deadline', 'Tienes ' || n || case when n = 1 then ' tarea vencida' else ' tareas vencidas' end,
                  'Termínalas, reprográmalas o cancélalas.', 'push', '/tasks', p_now, 'late:' || today)
          on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
        end if;
      end if;
    end if;

    -- 4. Claude's proposals waiting for review for 3+ hours (from 16:00, once a day).
    if app_private.wants(p, 'proposals') and t >= time '16:00' then
      select count(*) into n from public.ai_proposals
        where user_id = p.id and status = 'pending' and created_at < p_now - interval '3 hours';
      if n > 0 then
        insert into public.notifications (user_id, kind, title, body, channel, link, scheduled_for, dedupe_key)
        values (p.id, 'proposals', 'Tienes ' || n || case when n = 1 then ' propuesta' else ' propuestas' end || ' de Claude sin revisar',
                'Apruébalas o recházalas: hasta entonces no se aplica nada.', 'push', '/brain/memory', p_now, 'proposals:' || today)
        on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
      end if;
    end if;

    -- 5. Primary goal: metric not updated for 7 days (from 18:00, once a week),
    --    and the weekly pace on Sundays from 18:30.
    if app_private.wants(p, 'goal') then
      for rec in
        select g.id, g.title, g.metric_name, g.metric_unit, g.metric_current, g.metric_target, g.target_date, g.created_at,
               (select max(c.recorded_at) from public.goal_checkins c where c.goal_id = g.id) as last_checkin,
               gp.progress
        from public.goals g join public.goal_progress gp on gp.goal_id = g.id
        where g.user_id = p.id and g.is_primary and g.status = 'active'
      loop
        if rec.metric_target is not null and t >= time '18:00'
           and coalesce(rec.last_checkin, rec.created_at) < p_now - interval '7 days' then
          insert into public.notifications (user_id, kind, title, body, channel, link, scheduled_for, dedupe_key)
          values (p.id, 'goal', 'Actualiza «' || coalesce(rec.metric_name, 'tu métrica') || '»',
                  'Tu objetivo principal lleva 7 días sin datos. Registra el valor real.', 'push', '/goals/' || rec.id, p_now, 'goal-stale:' || rec.id || ':' || week_key)
          on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
        end if;
        if extract(dow from lnow) = 0 and t >= time '18:30' then
          insert into public.notifications (user_id, kind, title, body, channel, link, scheduled_for, dedupe_key)
          values (p.id, 'goal', 'Semana: ' || rec.progress || '% de «' || left(rec.title, 50) || '»',
                  case when rec.target_date is not null
                       then 'Quedan ' || (rec.target_date - today) || ' días. ' else '' end
                  || coalesce(rec.metric_current::text || ' / ' || rec.metric_target::text || ' ' || coalesce(rec.metric_unit, ''), ''),
                  'push', '/goals/' || rec.id, p_now, 'goal-pace:' || rec.id || ':' || week_key)
          on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
        end if;
      end loop;
    end if;

    -- 6. Two days without completing anything while there is open work (from 17:00).
    if app_private.wants(p, 'inactivity') and t >= time '17:00' then
      if not exists (select 1 from public.tasks where user_id = p.id and completed_at > p_now - interval '48 hours')
         and exists (select 1 from public.tasks where user_id = p.id and status in ('pending','in_progress'))
         and exists (select 1 from public.tasks where user_id = p.id and created_at < p_now - interval '48 hours') then
        select title into txt from public.tasks
          where user_id = p.id and status in ('pending','in_progress')
          order by (scheduled_date = today) desc nulls last, focus_rank nulls last, estimated_minutes nulls last limit 1;
        insert into public.notifications (user_id, kind, title, body, channel, link, scheduled_for, dedupe_key)
        values (p.id, 'inactivity', 'Llevas 2 días sin completar tareas',
                'Empieza por algo pequeño: «' || left(coalesce(txt, 'tu próxima tarea'), 60) || '».', 'push', '/tasks', p_now, 'inactive:' || today)
        on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
      end if;
    end if;

    -- 7. Evening wrap-up (from 21:00): what got done, what is left, tomorrow.
    if app_private.wants(p, 'evening') and t >= time '21:00' then
      select count(*) filter (where status = 'completed'), count(*) filter (where status in ('pending','in_progress'))
        into n, m
        from public.tasks where user_id = p.id and scheduled_date = today;
      insert into public.notifications (user_id, kind, title, body, channel, link, scheduled_for, dedupe_key)
      select p.id, 'evening',
             'Hoy: ' || n || ' hechas, ' || m || ' pendientes',
             case when (select count(*) from public.tasks where user_id = p.id and scheduled_date = tomorrow and status in ('pending','in_progress')) = 0
                  then 'Mañana no tienes nada planificado: elige tus prioridades antes de dormir.'
                  else 'Mañana: ' || (select count(*) from public.tasks where user_id = p.id and scheduled_date = tomorrow and status in ('pending','in_progress')) || ' tareas. Anota tu resumen del día.' end,
             'push', '/planner', p_now, 'evening:' || today
      on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    end if;
  end loop;

  return (select count(*)::int from public.notifications where created_at = now() and dedupe_key is not null);
end;
$$;
revoke all on function app_private.generate_smart_notifications(timestamptz) from public, anon, authenticated;
revoke all on function app_private.is_quiet(public.profiles, timestamp) from public, anon;
revoke all on function app_private.busy_end(public.profiles, date) from public, anon;
revoke all on function app_private.wants(public.profiles, text) from public, anon;

select cron.schedule('goals-smart-notifications', '*/5 * * * *', $$select app_private.generate_smart_notifications()$$);
