-- Parle-to-Speak: initial schema, RLS, grants and RPCs.
-- Owner: unit G. Enum check lists below must stay in sync with src/lib/types.ts
-- (TRAP_IDS, SESSION_KINDS, REVIEW_GRADES, VOCAB_SOURCES, INPUT_MODES, AGE_BANDS,
-- CEFR_LEVELS). supabase/tests/migration.test.ts asserts the two match exactly.
--
-- This file never creates the `auth` schema or `auth.uid()`: in production
-- Supabase provides both. The local test stub (00_auth_stub.sql) provides a
-- throwaway stand-in so this migration can be exercised against a scratch
-- Postgres here.
--
-- Numeric columns that hold ease, intervals, mastery or pronunciation scores
-- use `double precision`, never `real`: a `real` column's rounding rejects
-- exact literals such as 1.3 under a `check (ease >= 1.3)` constraint.

-- ───────────────────────── profiles ─────────────────────────

create table public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  level       text null check (level in ('A1','A2','B1','B2','C1')),
  native_lang text not null default 'fr' check (native_lang = 'fr'),
  age_band    text null check (age_band in ('15-17','18+')),
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- ───────────────────────── privacy_consents ─────────────────────────

create table public.privacy_consents (
  user_id      uuid not null references auth.users(id) on delete cascade,
  version      text not null check (char_length(version) <= 32),
  age_band     text not null check (age_band in ('15-17','18+')),
  accepted_at  timestamptz not null default now(),
  primary key (user_id, version)
);

alter table public.privacy_consents enable row level security;

-- ───────────────────────── sessions ─────────────────────────

create table public.sessions (
  id                 uuid primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  kind               text not null check (kind in ('shadowing','roleplay','debate','drill','placement','pronunciation')),
  level              text not null check (level in ('A1','A2','B1','B2','C1')),
  scenario_id        text null check (char_length(scenario_id) <= 64),
  topic_id           text null check (char_length(topic_id) <= 64),
  started_at         timestamptz not null,
  ended_at           timestamptz not null check (ended_at >= started_at),
  words_spoken       int not null check (words_spoken >= 0 and words_spoken <= 100000),
  code_switch_count  int not null check (code_switch_count >= 0 and code_switch_count <= 10000),
  pronunciation_avg  double precision null check (pronunciation_avg >= 0 and pronunciation_avg <= 100)
);

create index sessions_user_ended_idx on public.sessions (user_id, ended_at desc);

alter table public.sessions enable row level security;

-- ───────────────────────── vocabulary ─────────────────────────

create table public.vocabulary (
  user_id       uuid not null references auth.users(id) on delete cascade,
  term          text not null check (char_length(term) <= 120),
  french_term   text null check (char_length(french_term) <= 120),
  source        text not null check (source in ('franglais','drill','session')),
  mastery       double precision not null check (mastery >= 0 and mastery <= 1),
  seen_count    int not null check (seen_count >= 0),
  saved         boolean not null default false,
  last_seen_at  timestamptz not null,
  primary key (user_id, term)
);

alter table public.vocabulary enable row level security;

-- ───────────────────────── weak_phonemes ─────────────────────────

create table public.weak_phonemes (
  user_id        uuid not null references auth.users(id) on delete cascade,
  trap_id        text not null check (trap_id in (
                    'h_dropped','h_inserted','th_as_s','th_as_f','th_as_t','dh_as_z','dh_as_d',
                    'ih_vs_iy','uh_vs_uw','stress_misplaced','weak_forms'
                  )),
  error_count    int not null check (error_count >= 0),
  attempt_count  int not null check (attempt_count >= 0),
  last_seen_at   timestamptz not null,
  primary key (user_id, trap_id),
  check (attempt_count >= error_count)
);

alter table public.weak_phonemes enable row level security;

-- ───────────────────────── srs_cards ─────────────────────────

create table public.srs_cards (
  user_id          uuid not null references auth.users(id) on delete cascade,
  item_id          text not null check (char_length(item_id) <= 64),
  ease             double precision not null check (ease >= 1.3 and ease <= 5),
  interval_days    double precision not null check (interval_days >= 0 and interval_days <= 180),
  repetitions      int not null check (repetitions >= 0),
  lapses           int not null check (lapses >= 0),
  due_at           timestamptz not null,
  last_reviewed_at timestamptz null,
  primary key (user_id, item_id)
);

alter table public.srs_cards enable row level security;

-- ───────────────────────── drill_attempts ─────────────────────────

create table public.drill_attempts (
  id           uuid primary key, -- client-supplied, also the idempotency key
  user_id      uuid not null references auth.users(id) on delete cascade,
  item_id      text not null check (char_length(item_id) <= 64),
  answer       text null check (answer is null or char_length(answer) <= 500),
  correct      boolean not null,
  grade        text not null check (grade in ('again','hard','good','easy')),
  duration_ms  int not null check (duration_ms >= 0 and duration_ms <= 600000),
  input_mode   text not null check (input_mode in ('typed','spoken','self_check')),
  answered_at  timestamptz not null,
  check (input_mode = 'typed' or answer is null)
);

create index drill_attempts_user_answered_idx on public.drill_attempts (user_id, answered_at desc);

alter table public.drill_attempts enable row level security;

-- ───────────────────────── processed_events ─────────────────────────
-- Idempotency guard: an RPC that accepts an event_id inserts here first and
-- no-ops on conflict, so a retried client call never double-applies.

create table public.processed_events (
  user_id       uuid not null references auth.users(id) on delete cascade,
  event_id      uuid not null,
  processed_at  timestamptz not null default now(),
  primary key (user_id, event_id)
);

alter table public.processed_events enable row level security;

-- ───────────────────────── grants ─────────────────────────
-- Supabase applies grants like these by default in production; the local
-- test stub does not, so they are explicit here too (otherwise local RLS
-- failures show up as misleading 42501 permission errors).

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on public.profiles          to authenticated;
grant select, insert, update, delete on public.privacy_consents  to authenticated;
grant select, insert, update, delete on public.sessions          to authenticated;
grant select, insert, update, delete on public.vocabulary        to authenticated;
grant select, insert, update, delete on public.weak_phonemes     to authenticated;
grant select, insert, update, delete on public.srs_cards         to authenticated;
grant select, insert, update, delete on public.drill_attempts    to authenticated;
grant select, insert, update, delete on public.processed_events  to authenticated;

revoke all on public.profiles          from anon, public;
revoke all on public.privacy_consents  from anon, public;
revoke all on public.sessions          from anon, public;
revoke all on public.vocabulary        from anon, public;
revoke all on public.weak_phonemes     from anon, public;
revoke all on public.srs_cards         from anon, public;
revoke all on public.drill_attempts    from anon, public;
revoke all on public.processed_events  from anon, public;

-- ───────────────────────── RLS policies ─────────────────────────
-- Standard per-user policies on every table: a row is visible and writable
-- only to the user it belongs to. auth.uid() is Supabase's own function in
-- production and the stub function in 00_auth_stub.sql for local testing.

create policy profiles_select on public.profiles for select using (user_id = auth.uid());
create policy profiles_insert on public.profiles for insert with check (user_id = auth.uid());
create policy profiles_update on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profiles_delete on public.profiles for delete using (user_id = auth.uid());

create policy privacy_consents_select on public.privacy_consents for select using (user_id = auth.uid());
create policy privacy_consents_insert on public.privacy_consents for insert with check (user_id = auth.uid());
create policy privacy_consents_update on public.privacy_consents for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy privacy_consents_delete on public.privacy_consents for delete using (user_id = auth.uid());

create policy sessions_select on public.sessions for select using (user_id = auth.uid());
create policy sessions_insert on public.sessions for insert with check (user_id = auth.uid());
create policy sessions_update on public.sessions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sessions_delete on public.sessions for delete using (user_id = auth.uid());

create policy vocabulary_select on public.vocabulary for select using (user_id = auth.uid());
create policy vocabulary_insert on public.vocabulary for insert with check (user_id = auth.uid());
create policy vocabulary_update on public.vocabulary for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy vocabulary_delete on public.vocabulary for delete using (user_id = auth.uid());

create policy weak_phonemes_select on public.weak_phonemes for select using (user_id = auth.uid());
create policy weak_phonemes_insert on public.weak_phonemes for insert with check (user_id = auth.uid());
create policy weak_phonemes_update on public.weak_phonemes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy weak_phonemes_delete on public.weak_phonemes for delete using (user_id = auth.uid());

create policy srs_cards_select on public.srs_cards for select using (user_id = auth.uid());
create policy srs_cards_insert on public.srs_cards for insert with check (user_id = auth.uid());
create policy srs_cards_update on public.srs_cards for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy srs_cards_delete on public.srs_cards for delete using (user_id = auth.uid());

create policy drill_attempts_select on public.drill_attempts for select using (user_id = auth.uid());
create policy drill_attempts_insert on public.drill_attempts for insert with check (user_id = auth.uid());
create policy drill_attempts_update on public.drill_attempts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy drill_attempts_delete on public.drill_attempts for delete using (user_id = auth.uid());

create policy processed_events_select on public.processed_events for select using (user_id = auth.uid());
create policy processed_events_insert on public.processed_events for insert with check (user_id = auth.uid());
create policy processed_events_update on public.processed_events for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy processed_events_delete on public.processed_events for delete using (user_id = auth.uid());

-- ───────────────────────── RPCs ─────────────────────────
-- Exactly three `security definer` functions exist in this migration:
-- record_drill_attempt, record_vocab and delete_my_account. Each sets
-- search_path = '' and schema-qualifies every reference, since a definer
-- function runs with the privileges (and RLS bypass) of its owner, not its
-- caller, and must therefore enforce `user_id = auth.uid()` itself wherever
-- it touches a row. increment_weak_phonemes is a plain (security invoker)
-- function: it relies on the caller's own RLS policies, so it does not need
-- to be a definer.

create function public.record_drill_attempt(
  p_attempt jsonb,
  p_card jsonb,
  p_event_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.processed_events (user_id, event_id)
  values (v_uid, p_event_id)
  on conflict (user_id, event_id) do nothing;

  if not found then
    -- already processed: idempotent no-op
    return;
  end if;

  insert into public.drill_attempts (
    id, user_id, item_id, answer, correct, grade, duration_ms, input_mode, answered_at
  ) values (
    (p_attempt->>'id')::uuid,
    v_uid,
    p_attempt->>'itemId',
    p_attempt->>'answer',
    (p_attempt->>'correct')::boolean,
    p_attempt->>'grade',
    (p_attempt->>'durationMs')::int,
    p_attempt->>'inputMode',
    (p_attempt->>'answeredAt')::timestamptz
  );

  insert into public.srs_cards (
    user_id, item_id, ease, interval_days, repetitions, lapses, due_at, last_reviewed_at
  ) values (
    v_uid,
    p_card->>'itemId',
    (p_card->>'ease')::double precision,
    (p_card->>'intervalDays')::double precision,
    (p_card->>'repetitions')::int,
    (p_card->>'lapses')::int,
    (p_card->>'dueAt')::timestamptz,
    (p_card->>'lastReviewedAt')::timestamptz
  )
  on conflict (user_id, item_id) do update set
    ease = excluded.ease,
    interval_days = excluded.interval_days,
    repetitions = excluded.repetitions,
    lapses = excluded.lapses,
    due_at = excluded.due_at,
    last_reviewed_at = excluded.last_reviewed_at;
end;
$$;

revoke all on function public.record_drill_attempt(jsonb, jsonb, uuid) from public, anon;
grant execute on function public.record_drill_attempt(jsonb, jsonb, uuid) to authenticated;

create function public.record_vocab(
  p_items jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_term text;
  v_correct boolean;
  -- Keep in sync with src/lib/types.ts MASTERY_EMA_ALPHA = 0.3.
  v_alpha double precision := 0.3;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'too many vocab items: % (max 50)', jsonb_array_length(p_items);
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_term := v_item->>'term';
    v_correct := (v_item->>'correct')::boolean;

    insert into public.vocabulary (
      user_id, term, french_term, source, mastery, seen_count, saved, last_seen_at
    ) values (
      v_uid, v_term, null, 'drill',
      case when v_correct then v_alpha else 0 end,
      1, false, now()
    )
    on conflict (user_id, term) do update set
      mastery = public.vocabulary.mastery + v_alpha * ((case when v_correct then 1 else 0 end) - public.vocabulary.mastery),
      seen_count = public.vocabulary.seen_count + 1,
      last_seen_at = now();
  end loop;
end;
$$;

revoke all on function public.record_vocab(jsonb) from public, anon;
grant execute on function public.record_vocab(jsonb) to authenticated;

create function public.increment_weak_phonemes(
  p_trap_id text,
  p_errors int,
  p_attempts int
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_trap_id not in (
    'h_dropped','h_inserted','th_as_s','th_as_f','th_as_t','dh_as_z','dh_as_d',
    'ih_vs_iy','uh_vs_uw','stress_misplaced','weak_forms'
  ) then
    raise exception 'unknown trap_id: %', p_trap_id;
  end if;

  if p_errors < 0 or p_attempts < 0 then
    raise exception 'error/attempt counts must be non-negative';
  end if;

  insert into public.weak_phonemes (user_id, trap_id, error_count, attempt_count, last_seen_at)
  values (v_uid, p_trap_id, p_errors, greatest(p_attempts, p_errors), now())
  on conflict (user_id, trap_id) do update set
    error_count = public.weak_phonemes.error_count + p_errors,
    attempt_count = greatest(
      public.weak_phonemes.attempt_count + p_attempts,
      public.weak_phonemes.error_count + p_errors
    ),
    last_seen_at = now();
end;
$$;

revoke all on function public.increment_weak_phonemes(text, int, int) from public, anon;
grant execute on function public.increment_weak_phonemes(text, int, int) to authenticated;

-- delete_my_account: deletes only the caller's own rows, across every
-- application table. It never deletes from auth.users: removing the
-- underlying Supabase auth user is a separate Admin API call, outside the
-- scope of this migration (documented in README/SECURITY).
create function public.delete_my_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.processed_events  where user_id = v_uid;
  delete from public.drill_attempts    where user_id = v_uid;
  delete from public.srs_cards         where user_id = v_uid;
  delete from public.weak_phonemes     where user_id = v_uid;
  delete from public.vocabulary        where user_id = v_uid;
  delete from public.sessions          where user_id = v_uid;
  delete from public.privacy_consents  where user_id = v_uid;
  delete from public.profiles          where user_id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ───────────────────────── Retention (commented out; enable in README) ─────────────────────────
-- Requires pg_cron. Deletes drill_attempts older than 365 days.
-- select cron.schedule('drill_attempts_retention', '0 3 * * *',
--   $$ delete from public.drill_attempts where answered_at < now() - interval '365 days' $$
-- );
