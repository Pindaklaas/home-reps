-- Chat bridge: the app wakes a Claude Code scheduled task when there is no API key.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-00000000b0a1', 'brain-owner@goals.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-00000000b0b2', 'brain-intruder@goals.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into app_private.authorized_users (email) values ('brain-owner@goals.test');
-- Start from an unconfigured bridge (rolled back at the end).
delete from app_private.settings where key like 'brain\_%';

-- Intruder: every RPC is refused.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b0b2","email":"brain-intruder@goals.test","role":"authenticated"}', true);
select throws_ok($$select public.request_brain_reply()$$, '42501', null, 'an unauthorized account cannot wake Claude');
select throws_ok($$select public.set_brain_token('abc')$$, '42501', null, 'an unauthorized account cannot set the token');
select throws_ok($$select public.brain_status()$$, '42501', null, 'an unauthorized account cannot read the bridge status');

-- Owner, bridge not configured yet.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b0a1","email":"brain-owner@goals.test","role":"authenticated"}', true);
select is(public.request_brain_reply(), 'nothing', 'nothing to answer: no request');
insert into public.ai_conversations (id, title) values ('70000000-0000-0000-0000-000000000001', 'Hola');
insert into public.ai_messages (conversation_id, role, content) values ('70000000-0000-0000-0000-000000000001', 'user', '¿Qué hago hoy?');
select is((public.brain_status() ->> 'waiting')::int, 1, 'a conversation ending in a user message is waiting');
select is(public.request_brain_reply(), 'not_configured', 'without fire URL and token nothing is sent');

-- The token is write-only and validated.
select throws_ok($$select public.set_brain_token('bad token with spaces')$$, '22023', null, 'tokens with spaces are rejected');
select lives_ok($$select public.set_brain_token('sk-ant-oat01-test_token.1')$$, 'the owner can set the token');
select is((public.brain_status() ->> 'connected')::boolean, true, 'status says connected');
select throws_ok($$select value from app_private.settings where key = 'brain_fire_token'$$, '42501', null, 'the token cannot be read back');
select throws_ok($$select app_private.fire_brain()$$, '42501', null, 'the app cannot fire directly');

-- Configured: one fire, then busy until the session finishes.
reset role;
insert into app_private.settings values ('brain_fire_url', 'http://127.0.0.1:9/fire');
set local role authenticated;
select is(public.request_brain_reply(), 'fired', 'a waiting message wakes Claude');
select is(public.request_brain_reply(), 'busy', 'a second message while it works does not start another session');
select is((public.brain_status() ->> 'working')::boolean, true, 'status says Claude is working');

-- Safety net only retries old, unanswered messages when no session is working.
reset role;
delete from app_private.settings where key = 'brain_busy_until';
select is(app_private.brain_retry(), 'nothing', 'a message under 2 minutes old is not retried');
update public.ai_messages set created_at = now() - interval '5 minutes' where conversation_id = '70000000-0000-0000-0000-000000000001';
select is(app_private.brain_retry(), 'fired', 'an unanswered message is retried after a few minutes');

select * from finish();
rollback;
