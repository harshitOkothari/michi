-- ============================================================
-- PHASE 3 — run this ONCE in Supabase > SQL Editor > New query
-- Adds the function behind Settings > "Delete my account".
-- Safe to run more than once.
-- ============================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  -- every table in schema.sql references auth.users ON DELETE CASCADE,
  -- so this removes the profile, goals, tests, workouts, XP... everything.
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
