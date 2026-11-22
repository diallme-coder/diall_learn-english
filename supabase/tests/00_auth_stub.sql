-- Local test stub for Supabase's `auth` schema. NOT part of the real
-- migration: Supabase provides its own `auth` schema and `auth.uid()` in
-- production. This file exists only so supabase/migrations/20261121000000_init.sql
-- (which references auth.users and calls auth.uid()) can be applied and
-- exercised against a throwaway local Postgres by supabase/tests/run-local.sh.

create role anon nologin;
create role authenticated nologin;

create schema auth;

create table auth.users (
  id uuid primary key
);

-- Supabase's auth.uid() reads the JWT subject claim out of the request's
-- Postgres session settings. Our local tests set it directly with
-- set_config('request.jwt.claim.sub', '<uuid>', true) instead of going
-- through PostgREST.
create function auth.uid() returns uuid
language sql
stable
as $$
  select coalesce(
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claims', true)::jsonb->>'sub'
  )::uuid
$$;

grant usage on schema auth to anon, authenticated;
grant select on auth.users to anon, authenticated;
