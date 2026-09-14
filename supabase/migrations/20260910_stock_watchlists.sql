-- Apply in the existing Supabase project. No service-role key belongs in the browser.
begin;
create table if not exists public.stock_watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9][A-Z0-9.-]{0,24}\.[A-Z0-9]{1,12}$'),
  list_kind text not null default 'watchlist' check (list_kind in ('watchlist','private')),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  primary key (user_id, symbol, list_kind)
);
alter table public.stock_watchlist enable row level security;
revoke all on public.stock_watchlist from anon;
grant select, insert, update, delete on public.stock_watchlist to authenticated;
create policy "Read own stocks" on public.stock_watchlist for select to authenticated using ((select auth.uid()) = user_id);
create policy "Save own stocks" on public.stock_watchlist for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Edit own stocks" on public.stock_watchlist for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Remove own stocks" on public.stock_watchlist for delete to authenticated using ((select auth.uid()) = user_id);
create or replace function public.limit_stock_watchlist() returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
  if not exists(select 1 from public.stock_watchlist where user_id = new.user_id and symbol = new.symbol and list_kind = new.list_kind)
     and (select count(*) from public.stock_watchlist where user_id = new.user_id) >= 200 then
    raise exception 'Watchlist limit reached (200 stocks).';
  end if;
  return new;
end;
$$;
create trigger stock_watchlist_capacity before insert on public.stock_watchlist for each row execute function public.limit_stock_watchlist();
commit;
