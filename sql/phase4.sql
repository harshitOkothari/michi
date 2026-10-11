-- ============================================================
-- PHASE 4 — run this ONCE in Supabase > SQL Editor > New query
-- Adds: friend codes, friends, and the weekly leaderboard behind the flip side of the ID card.
-- Safe to run more than once.
-- ============================================================

-- 1) Every profile gets a short friend code, e.g. MCH-4BF7-A6 (the same code printed on the ID card)
alter table public.profiles
  add column if not exists friend_code text
  generated always as ('MCH-' || upper(substr(md5(id::text), 1, 4)) || '-' || upper(substr(md5(id::text), 5, 2))) stored;
create unique index if not exists profiles_friend_code_key on public.profiles(friend_code);

-- 2) Friends (stored in both directions)
create table if not exists public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
alter table public.friendships enable row level security;
drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own" on public.friendships for select using (auth.uid() = user_id);

-- 3) Add a friend by their code (both sides become friends)
create or replace function public.add_friend(code text)
returns json language plpgsql security definer set search_path = public as $$
declare fid uuid; fname text;
begin
  select id, name into fid, fname from profiles where friend_code = upper(trim(code));
  if fid is null then return json_build_object('ok', false, 'error', 'No student found with that code.'); end if;
  if fid = auth.uid() then return json_build_object('ok', false, 'error', 'That is your own code.'); end if;
  insert into friendships(user_id, friend_id) values (auth.uid(), fid), (fid, auth.uid()) on conflict do nothing;
  return json_build_object('ok', true, 'name', fname);
end $$;

create or replace function public.remove_friend(fid uuid)
returns void language sql security definer set search_path = public as $$
  delete from friendships where (user_id = auth.uid() and friend_id = fid) or (user_id = fid and friend_id = auth.uid());
$$;

-- 4) This week's study time for you + your friends (only these fields are shared, nothing else)
create or replace function public.friends_week(week_start timestamptz)
returns table (user_id uuid, name text, avatar_url text, friend_code text, week_sec bigint, streak int, is_me boolean)
language sql security definer set search_path = public as $$
  select p.id, p.name, p.avatar_url, p.friend_code,
         coalesce(sum(s.duration_sec) filter (where s.start_time >= week_start and s.start_time < week_start + interval '7 days'), 0)::bigint,
         coalesce(max(st.current_streak), 0)::int,
         (p.id = auth.uid())        
  from profiles p
  left join study_sessions s on s.user_id = p.id
  left join streaks st on st.user_id = p.id
  where p.id = auth.uid() or p.id in (select f.friend_id from friendships f where f.user_id = auth.uid())
  group by p.id
  order by 5 desc, p.name;
$$;

grant execute on function public.add_friend(text), public.remove_friend(uuid), public.friends_week(timestamptz) to authenticated;
