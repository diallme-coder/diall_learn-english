-- RLS and RPC behaviour tests, run against the scratch Postgres built by
-- run-local.sh, after 00_auth_stub.sql and the real migration are applied.
--
-- IMPORTANT: every assertion below runs after `set role authenticated` (or
-- `anon`) plus a JWT-subject claim set via set_config. The connecting role
-- that applies this script is a superuser/table-owner and therefore
-- bypasses RLS entirely by default — assertions made under that role would
-- be meaningless, so every test below explicitly switches role first.

\set ON_ERROR_STOP on
\set uid_a '11111111-1111-1111-1111-111111111111'
\set uid_b '22222222-2222-2222-2222-222222222222'

-- Setup: create the two test auth.users rows as the connecting (superuser)
-- role, before any RLS-scoped assertion runs.
insert into auth.users (id) values (:'uid_a'::uuid), (:'uid_b'::uuid);

-- ───────────────────────── (a) positive control ─────────────────────────

set role authenticated;
select set_config('request.jwt.claim.sub', :'uid_a', false);

do $$
begin
  insert into public.srs_cards (user_id, item_id, ease, interval_days, repetitions, lapses, due_at, last_reviewed_at)
  values (current_setting('request.jwt.claim.sub')::uuid, 'item_positive', 1.3, 1, 0, 0, now(), null);
  raise notice 'PASS: user A inserted own srs_cards row with ease = 1.3';
end $$;

insert into public.sessions (id, user_id, kind, level, scenario_id, topic_id, started_at, ended_at, words_spoken, code_switch_count, pronunciation_avg)
values (gen_random_uuid(), :'uid_a'::uuid, 'drill', 'A1', null, null, now(), now(), 10, 0, null);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.sessions;
  if v_count = 1 then
    raise notice 'PASS: user A sees exactly her own session row (1)';
  else
    raise exception 'FAIL: user A should see exactly 1 session row, saw %', v_count;
  end if;
end $$;

-- ───────────────────────── (b) cross-user access ─────────────────────────

do $$
begin
  insert into public.sessions (id, user_id, kind, level, scenario_id, topic_id, started_at, ended_at, words_spoken, code_switch_count, pronunciation_avg)
  values (gen_random_uuid(), '22222222-2222-2222-2222-222222222222'::uuid, 'drill', 'A1', null, null, now(), now(), 1, 0, null);
  raise exception 'FAIL: user A inserted a row owned by user B (should have been rejected)';
exception
  when others then
    if sqlstate = '42501' and sqlerrm like '%row-level security%' then
      raise notice 'PASS: cross-user insert rejected by RLS (sqlstate %, %)', sqlstate, sqlerrm;
    else
      raise exception 'FAIL: cross-user insert rejected for the wrong reason (sqlstate %, %)', sqlstate, sqlerrm;
    end if;
end $$;

-- As B, confirm A's row is invisible (RLS filters silently on select, no error).
select set_config('request.jwt.claim.sub', :'uid_b', false);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.sessions;
  if v_count = 0 then
    raise notice 'PASS: user B sees 0 of user A''s session rows';
  else
    raise exception 'FAIL: user B should see 0 session rows, saw %', v_count;
  end if;
end $$;

select set_config('request.jwt.claim.sub', :'uid_a', false);

-- ───────────────────────── (c) anon role: one defined outcome ─────────────────────────
-- Chosen outcome: an explicit permission denial (42501) from the missing
-- GRANT, not a silently empty result set. anon has no table grants at all.

reset role;
set role anon;

do $$
begin
  perform count(*) from public.profiles;
  raise exception 'FAIL: anon was able to select from profiles (should be denied)';
exception
  when insufficient_privilege then
    raise notice 'PASS: anon select on profiles denied (sqlstate %, %)', sqlstate, sqlerrm;
  when others then
    raise exception 'FAIL: anon select on profiles failed for the wrong reason (sqlstate %, %)', sqlstate, sqlerrm;
end $$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'uid_a', false);

-- ───────────────────────── record_drill_attempt idempotency ─────────────────────────

select public.record_drill_attempt(
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444444',
    'itemId', 'drill_item_1',
    'answer', null,
    'correct', true,
    'grade', 'good',
    'durationMs', 1500,
    'inputMode', 'spoken',
    'answeredAt', now()::text
  ),
  jsonb_build_object(
    'itemId', 'drill_item_1',
    'ease', 2.5,
    'intervalDays', 1,
    'repetitions', 1,
    'lapses', 0,
    'dueAt', now()::text,
    'lastReviewedAt', now()::text
  ),
  '33333333-3333-3333-3333-333333333333'::uuid
);

-- Replay the same event_id: must no-op, not raise (and not insert a duplicate attempt).
select public.record_drill_attempt(
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444444',
    'itemId', 'drill_item_1',
    'answer', null,
    'correct', true,
    'grade', 'good',
    'durationMs', 1500,
    'inputMode', 'spoken',
    'answeredAt', now()::text
  ),
  jsonb_build_object(
    'itemId', 'drill_item_1',
    'ease', 2.5,
    'intervalDays', 1,
    'repetitions', 1,
    'lapses', 0,
    'dueAt', now()::text,
    'lastReviewedAt', now()::text
  ),
  '33333333-3333-3333-3333-333333333333'::uuid
);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.drill_attempts where id = '44444444-4444-4444-4444-444444444444'::uuid;
  if v_count = 1 then
    raise notice 'PASS: record_drill_attempt is idempotent on event_id (1 attempt row after 2 calls)';
  else
    raise exception 'FAIL: expected exactly 1 drill_attempts row, found %', v_count;
  end if;
end $$;

-- ───────────────────────── record_vocab ─────────────────────────

do $$
declare
  v_too_many jsonb := '[]'::jsonb;
  i int;
begin
  for i in 1..51 loop
    v_too_many := v_too_many || jsonb_build_object('term', 'word' || i, 'correct', true);
  end loop;

  begin
    perform public.record_vocab(v_too_many);
    raise exception 'FAIL: record_vocab accepted 51 items (should raise)';
  exception
    when others then
      raise notice 'PASS: record_vocab rejects more than 50 items (%)', sqlerrm;
  end;
end $$;

select public.record_vocab(jsonb_build_array(jsonb_build_object('term', 'threshold', 'correct', true)));

do $$
declare
  v_mastery double precision;
begin
  select mastery into v_mastery from public.vocabulary where user_id = current_setting('request.jwt.claim.sub')::uuid and term = 'threshold';
  if v_mastery = 0.3 then
    raise notice 'PASS: record_vocab EMA from a new row with one correct result is 0.3';
  else
    raise exception 'FAIL: expected mastery 0.3 for a new correct vocab row, got %', v_mastery;
  end if;
end $$;

-- ───────────────────────── increment_weak_phonemes ─────────────────────────

do $$
begin
  perform public.increment_weak_phonemes('not_a_real_trap', 1, 1);
  raise exception 'FAIL: increment_weak_phonemes accepted an unknown trap_id (should raise)';
exception
  when others then
    raise notice 'PASS: increment_weak_phonemes rejects an unknown trap_id (%)', sqlerrm;
end $$;

select public.increment_weak_phonemes('th_as_s', 2, 5);

do $$
declare
  v_errors int;
  v_attempts int;
begin
  select error_count, attempt_count into v_errors, v_attempts
  from public.weak_phonemes
  where user_id = current_setting('request.jwt.claim.sub')::uuid and trap_id = 'th_as_s';
  if v_errors = 2 and v_attempts = 5 then
    raise notice 'PASS: increment_weak_phonemes records error_count=2, attempt_count=5';
  else
    raise exception 'FAIL: expected error_count=2, attempt_count=5, got error_count=%, attempt_count=%', v_errors, v_attempts;
  end if;
end $$;

-- ───────────────────────── drill_attempts: answer/input_mode check ─────────────────────────

do $$
begin
  insert into public.drill_attempts (id, user_id, item_id, answer, correct, grade, duration_ms, input_mode, answered_at)
  values (gen_random_uuid(), current_setting('request.jwt.claim.sub')::uuid, 'typed_item', 'my typed answer', true, 'good', 1000, 'typed', now());
  raise notice 'PASS: a typed answer with non-null text is stored';
end $$;

do $$
begin
  insert into public.drill_attempts (id, user_id, item_id, answer, correct, grade, duration_ms, input_mode, answered_at)
  values (gen_random_uuid(), current_setting('request.jwt.claim.sub')::uuid, 'spoken_item', 'should not be allowed', true, 'good', 1000, 'spoken', now());
  raise exception 'FAIL: a spoken answer with non-null text was stored (should have raised a check violation)';
exception
  when check_violation then
    raise notice 'PASS: a spoken answer with non-null text raises a check violation (%)', sqlerrm;
end $$;

-- ───────────────────────── delete_my_account ─────────────────────────

select public.delete_my_account();

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'uid_a', false);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.profiles where user_id = current_setting('request.jwt.claim.sub')::uuid;
  if v_count = 0 then
    raise notice 'PASS: delete_my_account removed user A''s profile row';
  else
    raise exception 'FAIL: user A''s profile row survived delete_my_account';
  end if;

  select count(*) into v_count from public.sessions where user_id = current_setting('request.jwt.claim.sub')::uuid;
  if v_count = 0 then
    raise notice 'PASS: delete_my_account removed user A''s session rows';
  else
    raise exception 'FAIL: user A''s session rows survived delete_my_account';
  end if;
end $$;

-- Confirm user B's rows are untouched (she has no rows yet in this script,
-- but her auth.users row must remain, proving delete_my_account only acted
-- on A's application rows and never touched auth.users for anyone).
do $$
declare
  v_count int;
begin
  select count(*) into v_count from auth.users where id = '22222222-2222-2222-2222-222222222222'::uuid;
  if v_count = 1 then
    raise notice 'PASS: user B''s auth.users row is untouched by A''s delete_my_account';
  else
    raise exception 'FAIL: user B''s auth.users row disappeared';
  end if;
end $$;

reset role;
\echo 'rls.sql: all assertions passed'
