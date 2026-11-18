-- =============================================================================
-- Brain bridge: without ANTHROPIC_API_KEY, the app's chat wakes a Claude Code
-- scheduled task (API trigger) that answers as the brain through
-- scripts/brain.mjs (inbox → propose/reply → done).
--
-- The fire URL and token live in app_private.settings (never readable by the
-- app; the owner can only set or clear the token). Keys:
--   brain_fire_url, brain_fire_token, brain_busy_until, brain_last_fire_at,
--   brain_last_request_id
-- Nothing is sent to Claude in the request: the session reads the owner's
-- messages from the database itself.
-- =============================================================================

create or replace function app_private.put_setting(p_key text, p_value text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into app_private.settings (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
$$;
revoke all on function app_private.put_setting(text, text) from public, anon, authenticated;

-- Conversations whose latest message is the owner's (recent ones only), i.e. waiting for a reply.
create or replace function app_private.brain_waiting(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.ai_conversations c
  cross join lateral (
    select m.role, m.created_at
    from public.ai_messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) last
  where c.user_id = p_user
    and last.role = 'user'
    and last.created_at > now() - interval '48 hours';
$$;
revoke all on function app_private.brain_waiting(uuid) from public, anon, authenticated;

-- Starts one Claude session unless one is already working (busy for up to 15 min).
create or replace function app_private.fire_brain()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  url   text;
  token text;
  busy  timestamptz;
  req   bigint;
begin
  perform pg_advisory_xact_lock(hashtext('goals-brain-fire'));
  url   := (select value from app_private.settings where key = 'brain_fire_url');
  token := (select value from app_private.settings where key = 'brain_fire_token');
  busy  := (select value::timestamptz from app_private.settings where key = 'brain_busy_until');
  if url is null or token is null then
    return 'not_configured';
  end if;
  if busy is not null and busy > now() then
    return 'busy';
  end if;
  req := net.http_post(
    url := url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'authorization', 'Bearer ' || token,
      'anthropic-beta', 'experimental-cc-routine-2026-04-01',
      'anthropic-version', '2023-06-01',
      'content-type', 'application/json'),
    timeout_milliseconds := 15000
  );
  perform app_private.put_setting('brain_busy_until', (now() + interval '15 minutes')::text);
  perform app_private.put_setting('brain_last_fire_at', now()::text);
  perform app_private.put_setting('brain_last_request_id', req::text);
  return 'fired';
end;
$$;
revoke all on function app_private.fire_brain() from public, anon, authenticated;

-- Last fire request's HTTP status (null while pending or when never fired).
create or replace function app_private.brain_last_status()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select r.status_code
  from net._http_response r
  where r.id = (select value::bigint from app_private.settings where key = 'brain_last_request_id');
$$;
revoke all on function app_private.brain_last_status() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- App-facing RPCs (owner only)
-- -----------------------------------------------------------------------------
create or replace function public.request_brain_reply()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app_private.is_authorized() or auth.uid() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if app_private.brain_waiting(auth.uid()) = 0 then
    return 'nothing';
  end if;
  return app_private.fire_brain();
end;
$$;
revoke all on function public.request_brain_reply() from public, anon;
grant execute on function public.request_brain_reply() to authenticated;

-- Write-only: the token can be replaced or cleared, never read back.
create or replace function public.set_brain_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text := btrim(coalesce(p_token, ''));
begin
  if not app_private.is_authorized() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if t = '' then
    delete from app_private.settings where key in ('brain_fire_token', 'brain_busy_until', 'brain_last_request_id');
    return;
  end if;
  if char_length(t) > 512 or t !~ '^[A-Za-z0-9._-]+$' then
    raise exception 'invalid token' using errcode = '22023';
  end if;
  perform app_private.put_setting('brain_fire_token', t);
  delete from app_private.settings where key in ('brain_busy_until', 'brain_last_request_id');
end;
$$;
revoke all on function public.set_brain_token(text) from public, anon;
grant execute on function public.set_brain_token(text) to authenticated;

create or replace function public.brain_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  busy timestamptz := (select value::timestamptz from app_private.settings where key = 'brain_busy_until');
begin
  if not app_private.is_authorized() or auth.uid() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'ready', exists (select 1 from app_private.settings where key = 'brain_fire_url'),
    'connected', exists (select 1 from app_private.settings where key = 'brain_fire_token'),
    'working', busy is not null and busy > now(),
    'last_fire_at', (select value from app_private.settings where key = 'brain_last_fire_at'),
    'last_status', app_private.brain_last_status(),
    'waiting', app_private.brain_waiting(auth.uid())
  );
end;
$$;
revoke all on function public.brain_status() from public, anon;
grant execute on function public.brain_status() to authenticated;

-- -----------------------------------------------------------------------------
-- Safety net: if a message is still unanswered (a session failed or the
-- request was lost), try again. Bounded: only messages under 2 h old, never
-- while a session is working (15 min), never after an auth error.
-- -----------------------------------------------------------------------------
create or replace function app_private.brain_retry()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  oldest   timestamptz;
  status   integer := app_private.brain_last_status();
begin
  if status in (401, 403, 404) then
    return 'auth_error';
  end if;
  select min(last.created_at) into oldest
  from public.ai_conversations c
  join auth.users u on u.id = c.user_id
  join app_private.authorized_users a on a.email = lower(u.email)
  cross join lateral (
    select m.role, m.created_at from public.ai_messages m
    where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1
  ) last
  where last.role = 'user' and last.created_at > now() - interval '2 hours';
  if oldest is null or oldest > now() - interval '2 minutes' then
    return 'nothing';
  end if;
  return app_private.fire_brain();
end;
$$;
revoke all on function app_private.brain_retry() from public, anon, authenticated;

select cron.schedule('goals-brain-retry', '*/5 * * * *', $$select app_private.brain_retry()$$);
