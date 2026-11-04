-- Checks that the app can't cheat: run by scripts/test-supabase.sh. Any failure stops with an error.
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-00000000000c');
-- The server (service role) sets things up.
insert into public.profiles (id, nickname, sector) values
  ('00000000-0000-0000-0000-00000000000a', 'ana_fit', 'gym'), ('00000000-0000-0000-0000-00000000000b', 'Jorge', 'gym'), ('00000000-0000-0000-0000-00000000000c', 'cheater', 'gym');
insert into public.xp_ledger (user_id, kind, xp) values ('00000000-0000-0000-0000-00000000000a', 'alarm', 40), ('00000000-0000-0000-0000-00000000000b', 'alarm', 70), ('00000000-0000-0000-0000-00000000000c', 'alarm', 9000);
update public.profiles set flagged = true where nickname = 'cheater';

create function pg_temp.expect_error(q text, what text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then return; end;
  raise exception 'should have failed: %', what;
end $$;

-- Nicknames are unique ignoring case.
select pg_temp.expect_error($q$insert into public.profiles (id, nickname) values ('00000000-0000-0000-0000-00000000000c', 'ANA_FIT')$q$, 'duplicate nickname');
-- Ledgers are append-only, even for the server.
select pg_temp.expect_error($q$update public.xp_ledger set xp = 1$q$, 'edit xp');
insert into public.points_ledger (user_id, pts, reason, level) values ('00000000-0000-0000-0000-00000000000a', 20, 'level_up', 2);
select pg_temp.expect_error($q$delete from public.points_ledger$q$, 'delete points');

-- Now act as Ana from the app.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.expect_error($q$insert into public.xp_ledger (user_id, kind, xp) values ('00000000-0000-0000-0000-00000000000a', 'alarm', 999)$q$, 'app writes XP');
select pg_temp.expect_error($q$insert into public.points_ledger (user_id, pts, reason) values ('00000000-0000-0000-0000-00000000000a', 999, 'x')$q$, 'app writes points');
select pg_temp.expect_error($q$update public.profiles set flagged = false$q$, 'app clears its flag');
select pg_temp.expect_error($q$insert into public.ab_answers values ('00000000-0000-0000-0000-00000000000a', 'ab-pushup', 'a', true)$q$, 'app answers A/B directly');
select pg_temp.expect_error($q$insert into public.master_requests (user_id, option) values ('00000000-0000-0000-0000-00000000000a', 'combo')$q$, 'MÁSTER request before finding it');
do $$ begin
  if (select count(*) from public.xp_ledger) <> 1 then raise exception 'Ana should only see her own XP'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'Ana should only see her own profile'; end if;
  if (select xp_total from public.my_totals) <> 40 then raise exception 'my_totals wrong'; end if;
end $$;
update public.profiles set sector = 'calisthenics', nickname = 'ana.fit';
update public.profiles set sector = 'gym';

-- Leagues: create, Jorge joins, both see the ranking; the flagged account never shows.
select public.create_league('Office crew') as code \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.join_league(:'code');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select public.join_league(:'code');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ declare n int; top text; begin
  select count(*), min(nickname) filter (where pos = 1) into n, top from public.ranking('league', (select code from public.leagues limit 1), 'total');
  if n <> 2 or top <> 'Jorge' then raise exception 'league ranking wrong: % rows, top %', n, top; end if;
  if exists (select 1 from public.ranking('sector', 'gym', 'week') where nickname = 'cheater') then raise exception 'flagged account in ranking'; end if;
  if (select count(*) from public.league_members) <> 3 then raise exception 'members should see each other'; end if;
end $$;
-- Someone outside the league can't read its ranking.
reset role;
insert into auth.users values ('00000000-0000-0000-0000-00000000000d');
insert into public.profiles (id, nickname) values ('00000000-0000-0000-0000-00000000000d', 'outsider');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select pg_temp.expect_error(format($q$select * from public.ranking('league', %L, 'total')$q$, :'code'), 'outsider reads league');
do $$ begin if (select count(*) from public.leagues) <> 0 then raise exception 'outsider sees the league'; end if; end $$;

-- MÁSTER: after finding it, a request goes through; nobody else can read it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.master_discoveries (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.master_requests (user_id, option, note) values ('00000000-0000-0000-0000-00000000000a', 'combo', 'mornings');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin if (select count(*) from public.master_requests) <> 0 or (select count(*) from public.master_discoveries) <> 0 then raise exception 'MÁSTER data leaked'; end if; end $$;

-- Deleting an account removes everything, ledgers included.
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin if exists (select 1 from public.xp_ledger where user_id = '00000000-0000-0000-0000-00000000000a') then raise exception 'ledger rows left after delete'; end if; end $$;
select 'all backend rules hold' as result;
