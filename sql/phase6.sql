-- ============================================================
-- PHASE 6 — run ONCE in Supabase > SQL Editor (after phase4.sql). Safe to run again.
-- Adds: "what my friends can see" privacy switches, and makes the weekly friends board respect them.
-- Admins still see everything (they read the tables directly through the admin_read policies).
-- ============================================================

create table if not exists public.friend_privacy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_hours  boolean not null default true,
  show_streak boolean not null default true,
  show_level  boolean not null default true,
  show_photo  boolean not null default true,
  updated_at  timestamptz default now()
);
alter table public.friend_privacy enable row level security;
drop policy if exists "friend_privacy_all" on public.friend_privacy;
create policy "friend_privacy_all" on public.friend_privacy for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "friend_privacy_admin_read" on public.friend_privacy;
create policy "friend_privacy_admin_read" on public.friend_privacy for select using (is_admin());
drop policy if exists "friendships_admin_read" on public.friendships;
create policy "friendships_admin_read" on public.friendships for select using (is_admin());

-- the board: you always see yourself in full; friends only show what they allowed (hidden = null)
drop function if exists public.friends_week(timestamptz);
create or replace function public.friends_week(week_start timestamptz)
returns table (user_id uuid, name text, avatar_url text, friend_code text, week_sec bigint, streak int, total_xp bigint, is_me boolean,
               hours_hidden boolean, streak_hidden boolean, level_hidden boolean)
language sql security definer set search_path = public as $$
  select p.id, p.name,
    case when p.id = auth.uid() or coalesce(fp.show_photo, true) then p.avatar_url end,
    p.friend_code,
    (case when p.id = auth.uid() or coalesce(fp.show_hours, true)
       then (select coalesce(sum(s.duration_sec), 0) from study_sessions s where s.user_id = p.id and s.start_time >= week_start and s.start_time < week_start + interval '7 days') end)::bigint,
    (case when p.id = auth.uid() or coalesce(fp.show_streak, true)
       then (select coalesce(max(st.current_streak), 0) from streaks st where st.user_id = p.id) end)::int,
    (case when p.id = auth.uid() or coalesce(fp.show_level, true)
       then (select coalesce(sum(x.amount), 0) from xp_events x where x.user_id = p.id) end)::bigint,
    (p.id = auth.uid()),
    not (p.id = auth.uid() or coalesce(fp.show_hours, true)),
    not (p.id = auth.uid() or coalesce(fp.show_streak, true)),
    not (p.id = auth.uid() or coalesce(fp.show_level, true))
  from profiles p
  left join friend_privacy fp on fp.user_id = p.id
  where p.id = auth.uid() or p.id in (select f.friend_id from friendships f where f.user_id = auth.uid())
  order by 5 desc nulls last, p.name;
$$;
grant execute on function public.friends_week(timestamptz) to authenticated;
