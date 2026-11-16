-- Local development only. Authorizes the local owner account created by
-- `npm run db:create-user`. In production, run the equivalent insert with your
-- own email from the Supabase SQL editor (see README).
insert into app_private.authorized_users (email) values ('owner@goals.local')
on conflict do nothing;
