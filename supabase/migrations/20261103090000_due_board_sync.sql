-- Due Board sync storage.
-- Every synced thing (a piece of homework, a focus session, settings) is one row, owned by one user.
-- Devices keep a full copy and exchange only what changed. `mod` is the device's edit time: when two
-- devices change the same row, the newer edit wins, and older pushes never overwrite newer data.

create table if not exists public.items (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('task', 'session', 'meta')),
  id         text        not null check (char_length(id) between 1 and 80),
  data       jsonb       not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536),
  mod        bigint      not null check (mod > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);

-- "What changed since I last looked?"
create index if not exists items_user_updated_idx on public.items (user_id, updated_at);

alter table public.items enable row level security;

drop policy if exists "Owners read their items" on public.items;
create policy "Owners read their items" on public.items
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Owners add their items" on public.items;
create policy "Owners add their items" on public.items
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Owners change their items" on public.items;
create policy "Owners change their items" on public.items
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Signed-out visitors get nothing. Rows are never hard-deleted by the app (deletions are kept as
-- "deleted" items so every device learns about them); the whole account is removed by delete_my_account().
revoke all on table public.items from anon;
revoke delete, truncate, references, trigger on table public.items from authenticated;
grant select, insert, update on table public.items to authenticated;

-- updated_at always comes from the server clock, never from a device.
create or replace function public.items_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before insert or update on public.items
  for each row execute function public.items_touch();

-- Send changed items. A row is only written when it is newer than the stored one.
-- Returns the stored rows that are newer than what was sent, so the device can catch up.
create or replace function public.push_items(items jsonb)
returns setof public.items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 500 then
    raise exception 'Send a list of at most 500 items' using errcode = '22023';
  end if;
  if (select count(*) from public.items i where i.user_id = uid) + jsonb_array_length(items) > 25000 then
    raise exception 'This account is full (25,000 items)' using errcode = '54000';
  end if;

  return query
  with incoming as (
    select distinct on (x.kind, x.id) x.kind, x.id, x.data, x.mod
    from jsonb_to_recordset(items) as x(kind text, id text, data jsonb, mod bigint)
    order by x.kind, x.id, x.mod desc
  ),
  written as (
    insert into public.items as i (user_id, kind, id, data, mod)
    select uid, n.kind, n.id, n.data, n.mod from incoming n
    on conflict (user_id, kind, id) do update
      set data = excluded.data, mod = excluded.mod
      where excluded.mod > i.mod
    returning 1
  )
  select i.* from public.items i
  join incoming n on i.user_id = uid and i.kind = n.kind and i.id = n.id
  where i.mod > n.mod;
end;
$$;

revoke all on function public.push_items(jsonb) from public, anon;
grant execute on function public.push_items(jsonb) to authenticated;

-- Delete the signed-in user's account and everything in it.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  delete from public.items where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Live updates between devices (Supabase Realtime respects the read policy above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items') then
    alter publication supabase_realtime add table public.items;
  end if;
end;
$$;
