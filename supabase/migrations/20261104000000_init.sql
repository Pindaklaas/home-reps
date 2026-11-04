-- Home Reps backend (Supabase / Postgres).
-- Rule one: the app never writes XP, levels, points or positions. It sends events to the submit-event
-- function, which checks them with game-core (the same rules as the app) and writes the ledgers with the service role.

create extension if not exists pgcrypto;

-- ---------- people ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null check (nickname ~ '^[A-Za-z0-9._-]{3,16}$'),
  nickname_key text generated always as (lower(nickname)) stored unique,   -- unique ignoring case
  sector text not null default 'home' check (sector in ('gym', 'calisthenics', 'home')),
  answers jsonb not null default '{}',          -- questionnaire: for analysis and as context for Dani
  flagged boolean not null default false,       -- set only by the server: out of rankings until reviewed
  flagged_reason text,
  created_at timestamptz not null default now()
);

-- ---------- what happened (every event, accepted or not, for audits) ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null,
  payload jsonb not null,
  accepted boolean not null,
  why text,
  flags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index events_user_time on public.events (user_id, created_at desc);

-- Camera sessions kept for the replay check (rhythm of each rep).
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  move text not null,
  reps int not null,
  gaps int[] not null default '{}',
  ended_at timestamptz not null
);
create index sessions_user_time on public.sessions (user_id, ended_at desc);

-- ---------- XP and points: append-only ledgers ----------
create table public.xp_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null,
  xp int not null check (xp >= 0),
  ref text,
  event_id uuid references public.events on delete set null,
  created_at timestamptz not null default now()
);
create index xp_user_time on public.xp_ledger (user_id, created_at);

create table public.points_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  pts int not null,
  reason text not null,
  level int,
  created_at timestamptz not null default now()
);
create index points_user on public.points_ledger (user_id);

-- Rows are never edited or removed, except when the whole account is deleted (the profile is already gone then).
create function public.ledger_append_only() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.profiles where id = old.user_id) then return old; end if;
  raise exception '% is append-only', tg_table_name;
end $$;
create trigger xp_append_only before update or delete on public.xp_ledger for each row execute function public.ledger_append_only();
create trigger points_append_only before update or delete on public.points_ledger for each row execute function public.ledger_append_only();

-- ---------- tips and A/B challenges ----------
create table public.content (
  id text primary key,
  type text not null check (type in ('tip', 'ab')),
  sort int not null default 0,
  title text not null,
  body jsonb not null default '{}',   -- tip: {text, anim}; ab: {a:{label, anim, video}, b:{...}, correct, why}
  video_url text,
  image_url text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.ab_answers (
  user_id uuid not null references public.profiles on delete cascade,
  ab_id text not null references public.content on delete cascade,
  choice text not null check (choice in ('a', 'b')),
  correct boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, ab_id)        -- one answer per person, ever
);
create table public.tips_read (
  user_id uuid not null references public.profiles on delete cascade,
  tip_id text not null references public.content on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tip_id)
);

-- ---------- leagues ----------
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (char_length(name) between 2 and 30),
  owner uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);
create table public.league_members (
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index league_members_user on public.league_members (user_id);

-- ---------- push ----------
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  platform text check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

-- ---------- MÁSTER ----------
create table public.master_discoveries (
  user_id uuid primary key references public.profiles on delete cascade,
  found_at timestamptz not null default now()
);
create table public.master_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  option text not null check (option in ('monthly', 'training', 'nutrition', 'combo')),
  note text check (char_length(note) <= 500),
  answers jsonb not null default '{}',   -- copy of the questionnaire when the request was sent
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

-- ---------- totals ----------
-- Weeks start on Monday (ISO). Flagged accounts never appear.
create function public.scores() returns table (user_id uuid, nickname text, sector text, xp_total int, xp_week int, since timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.nickname, p.sector,
         coalesce(sum(x.xp), 0)::int,
         coalesce(sum(x.xp) filter (where x.created_at >= date_trunc('week', now())), 0)::int,
         p.created_at
  from profiles p left join xp_ledger x on x.user_id = p.id
  where not p.flagged
  group by p.id
$$;
revoke all on function public.scores() from public, anon, authenticated;

-- Ranking for a sector or a league I belong to: top 3 plus two above and below me. Only nicknames leave the server.
create function public.ranking(p_scope text, p_key text, p_period text default 'week')
returns table (pos int, nickname text, xp int, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_scope = 'league' and not exists (
    select 1 from league_members m join leagues l on l.id = m.league_id where l.code = p_key and m.user_id = auth.uid()) then
    raise exception 'not a member of this league';
  end if;
  return query
  with s as (
    select sc.user_id, sc.nickname, case when p_period = 'total' then sc.xp_total else sc.xp_week end as score, sc.since
    from scores() sc
    where (p_scope = 'sector' and sc.sector = p_key)
       or (p_scope = 'league' and sc.user_id in (select m.user_id from league_members m join leagues l on l.id = m.league_id where l.code = p_key))
  ), r as (
    select s.*, (row_number() over (order by s.score desc, s.since, s.user_id))::int as pos from s
  ), me as (select r.pos from r where r.user_id = auth.uid())
  select r.pos, r.nickname, r.score, r.user_id = auth.uid()
  from r
  where r.pos <= 3 or exists (select 1 from me where abs(r.pos - me.pos) <= 2)
  order by r.pos;
end $$;
grant execute on function public.ranking(text, text, text) to authenticated;

-- My own totals for the profile screen.
create view public.my_totals with (security_invoker = true) as
  select p.id as user_id,
         (select coalesce(sum(xp), 0)::int from xp_ledger where user_id = p.id) as xp_total,
         (select coalesce(sum(pts), 0)::int from points_ledger where user_id = p.id) as points
  from profiles p where p.id = auth.uid();

-- ---------- leagues: create, join, leave ----------
create function public.create_league(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare c text; lid uuid;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  loop
    c := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=01OIl', ''), 1, 6));
    exit when char_length(c) = 6 and not exists (select 1 from leagues where code = c);
  end loop;
  insert into leagues (code, name, owner) values (c, trim(p_name), auth.uid()) returning id into lid;
  insert into league_members (league_id, user_id) values (lid, auth.uid());
  return c;
end $$;
create function public.join_league(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare l leagues;
begin
  select * into l from leagues where code = upper(trim(p_code));
  if l.id is null then raise exception 'no league with that code'; end if;
  insert into league_members (league_id, user_id) values (l.id, auth.uid()) on conflict do nothing;
  return l.name;
end $$;
grant execute on function public.create_league(text), public.join_league(text) to authenticated;

-- Helper for policies (avoids policies that query their own table).
create function public.my_league_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select league_id from league_members where user_id = auth.uid()
$$;

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.sessions enable row level security;
alter table public.xp_ledger enable row level security;
alter table public.points_ledger enable row level security;
alter table public.content enable row level security;
alter table public.ab_answers enable row level security;
alter table public.tips_read enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.push_tokens enable row level security;
alter table public.master_discoveries enable row level security;
alter table public.master_requests enable row level security;

-- Profiles: each person reads and edits their own. flagged can't be touched from the app.
create policy "own profile: read" on public.profiles for select using (id = auth.uid());
create policy "own profile: create" on public.profiles for insert with check (id = auth.uid());
create policy "own profile: edit" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, nickname, sector, answers) on public.profiles to authenticated;
grant update (nickname, sector, answers) on public.profiles to authenticated;

-- Ledgers, events and sessions: read your own; only the server writes.
create policy "own events" on public.events for select using (user_id = auth.uid());
create policy "own sessions" on public.sessions for select using (user_id = auth.uid());
create policy "own xp" on public.xp_ledger for select using (user_id = auth.uid());
create policy "own points" on public.points_ledger for select using (user_id = auth.uid());
create policy "own answers" on public.ab_answers for select using (user_id = auth.uid());
create policy "own tips" on public.tips_read for select using (user_id = auth.uid());
revoke insert, update, delete on public.events, public.sessions, public.xp_ledger, public.points_ledger, public.ab_answers, public.tips_read from anon, authenticated;

-- Content: everyone signed in reads what's published; edited from the dashboard.
create policy "published content" on public.content for select to authenticated using (published);
revoke insert, update, delete on public.content from anon, authenticated;

-- Leagues: members see their leagues and fellow members; leave by deleting your own membership.
create policy "my leagues" on public.leagues for select using (id in (select public.my_league_ids()));
create policy "fellow members" on public.league_members for select using (league_id in (select public.my_league_ids()));
create policy "leave a league" on public.league_members for delete using (user_id = auth.uid());
revoke insert, update on public.leagues, public.league_members from anon, authenticated;

-- Push tokens: your own.
create policy "own tokens" on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- MÁSTER: record your own discovery once, send requests; nobody else can read them (Dani uses the dashboard).
create policy "found it" on public.master_discoveries for insert with check (user_id = auth.uid());
create policy "my discovery" on public.master_discoveries for select using (user_id = auth.uid());
create policy "send request" on public.master_requests for insert with check (user_id = auth.uid() and exists (select 1 from public.master_discoveries d where d.user_id = auth.uid()));
create policy "my requests" on public.master_requests for select using (user_id = auth.uid());
revoke update, delete on public.master_discoveries, public.master_requests from anon, authenticated;
