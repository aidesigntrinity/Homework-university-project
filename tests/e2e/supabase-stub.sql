-- Minimal stand-in for what a Supabase database provides, for local tests only.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(), email text unique, encrypted_password text,
  raw_user_meta_data jsonb not null default '{}', email_confirmed_at timestamptz, created_at timestamptz default now(),
  updated_at timestamptz default now(), recovery_token text, confirmation_token text, email_change text, email_change_token text);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create publication supabase_realtime;
