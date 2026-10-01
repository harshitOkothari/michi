-- ============================================================
-- PERSONAL DASHBOARD — DATABASE SCHEMA (v2: generic Goals)
-- Run in Supabase SQL Editor. If your project already had the
-- v1 (College/CLAT) schema, easiest is to start a fresh Supabase
-- project and run this on it.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES / SETTINGS
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text default 'system',
  xp_task int default 10,
  xp_study_session int default 15,
  xp_pomodoro int default 10,
  xp_test int default 25,
  xp_workout int default 20,
  xp_weekly_milestone int default 75,
  xp_streak_bonus int default 50,
  pomodoro_work_min int default 25,
  pomodoro_short_break_min int default 5,
  pomodoro_long_break_min int default 15,
  pomodoro_sessions_before_long int default 4,
  streak_grace_days int default 0,
  updated_at timestamptz default now()
);

-- ============================================================
-- GOALS — the generic exam/track system. Examples a user might
-- create: "JEE", "NEET", "CLAT 2027", "Class 12 Boards", "BCA College".
-- Nothing here is hardcoded; every user creates their own.
-- ============================================================
create table if not exists goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  color text default '#6366f1',
  icon text,
  archived boolean default false,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Optional grouping inside a goal (a college "Semester 3", a JEE "Phase 1", etc). Purely a label.
create table if not exists goal_groups (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Subjects/sections under a goal (e.g. under "CLAT": English, Legal Reasoning...
-- under "College": Java, DBMS...). Same table serves both roles.
create table if not exists subjects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  group_id uuid references goal_groups(id) on delete set null,
  name text not null,
  description text,
  color text default '#6366f1',
  icon text,
  archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists topics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  name text not null,
  strength text,
  created_at timestamptz default now()
);

-- ============================================================
-- TESTS
-- ============================================================
create table if not exists tests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  subject_id uuid references subjects(id) on delete set null,
  name text not null,
  test_date date not null default current_date,
  total_marks numeric,
  marks_obtained numeric,
  total_questions int,
  attempted int,
  correct int,
  incorrect int,
  unattempted int,
  time_taken_min numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists test_sections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_id uuid not null references tests(id) on delete cascade,
  subject_id uuid references subjects(id) on delete set null,
  total_questions int,
  attempted int,
  correct int,
  incorrect int,
  marks numeric
);

-- ============================================================
-- STUDY SESSIONS / POMODOROS
-- ============================================================
create table if not exists study_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  subject_id uuid references subjects(id) on delete set null,
  topic_id uuid references topics(id) on delete set null,
  topic_text text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_sec int not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists pomodoros (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  subject_id uuid references subjects(id) on delete set null,
  topic_text text,
  duration_min int not null default 25,
  completed_at timestamptz not null default now(),
  created_at timestamptz default now()
);

-- ============================================================
-- TASKS
-- ============================================================
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'personal' check (category in ('academic','fitness','personal')),
  goal_id uuid references goals(id) on delete set null,
  subject_id uuid references subjects(id) on delete set null,
  priority text default 'medium' check (priority in ('high','medium','low')),
  due_date date,
  status text not null default 'pending' check (status in ('pending','completed')),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- FITNESS
-- ============================================================
create table if not exists workout_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists workouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references workout_templates(id) on delete set null,
  workout_date date not null default current_date,
  workout_type text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists workout_exercises (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_name text not null,
  sets int,
  reps int,
  weight numeric,
  weight_unit text default 'kg',
  is_pr boolean default false,
  notes text
);

create table if not exists body_measurements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at date not null default current_date,
  weight numeric,
  chest numeric,
  waist numeric,
  arms numeric,
  shoulders numeric,
  thighs numeric,
  notes text
);

-- ============================================================
-- MILESTONES — formerly "Goals" in the original spec: a
-- deadline + progress item, optionally under a Goal track.
-- ============================================================
create table if not exists milestones (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  title text not null,
  description text,
  category text not null default 'personal' check (category in ('academic','fitness','personal')),
  deadline date,
  progress int default 0 check (progress between 0 and 100),
  status text default 'not_started' check (status in ('not_started','in_progress','completed','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- SKILLS
-- ============================================================
create table if not exists skills (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  current_level int default 1 check (current_level between 1 and 10),
  target_level int default 10 check (target_level between 1 and 10),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ACTIVITY LOG / XP / STREAKS
-- ============================================================
create table if not exists activity_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  description text not null,
  ref_id uuid,
  occurred_at timestamptz not null default now()
);

create table if not exists xp_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  reason text not null,
  ref_id uuid,
  created_at timestamptz default now()
);

create table if not exists streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak int default 0,
  longest_streak int default 0,
  last_active_date date,
  updated_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_goals_user on goals(user_id);
create index if not exists idx_subjects_goal on subjects(goal_id);
create index if not exists idx_topics_subject on topics(subject_id);
create index if not exists idx_tests_user on tests(user_id);
create index if not exists idx_tests_goal on tests(goal_id);
create index if not exists idx_study_sessions_user on study_sessions(user_id);
create index if not exists idx_pomodoros_user on pomodoros(user_id);
create index if not exists idx_tasks_user on tasks(user_id);
create index if not exists idx_workouts_user on workouts(user_id);
create index if not exists idx_milestones_user on milestones(user_id);
create index if not exists idx_activity_user on activity_log(user_id, occurred_at desc);
create index if not exists idx_xp_user on xp_events(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table user_settings enable row level security;
alter table goals enable row level security;
alter table goal_groups enable row level security;
alter table subjects enable row level security;
alter table topics enable row level security;
alter table tests enable row level security;
alter table test_sections enable row level security;
alter table study_sessions enable row level security;
alter table pomodoros enable row level security;
alter table tasks enable row level security;
alter table workout_templates enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table body_measurements enable row level security;
alter table milestones enable row level security;
alter table skills enable row level security;
alter table activity_log enable row level security;
alter table xp_events enable row level security;
alter table streaks enable row level security;

drop policy if exists "profiles_all" on profiles;
create policy "profiles_all" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare
  t text;
  tables text[] := array[
    'user_settings','goals','goal_groups','subjects','topics',
    'tests','test_sections','study_sessions','pomodoros','tasks',
    'workout_templates','workouts','workout_exercises','body_measurements',
    'milestones','skills','activity_log','xp_events','streaks'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "%s_all" on %I;', t, t);
    execute format(
      'create policy "%s_all" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- AUTO-CREATE profile + settings + streak row on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name, email) values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.email);
  insert into user_settings (user_id) values (new.id);
  insert into streaks (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- ADMIN
-- Admins can VIEW every user's data (profiles, goals, subjects,
-- tests, tasks, activity, streaks) — never write to it.
--
-- IMPORTANT: there is deliberately no way to grant admin from
-- the app itself. To make someone an admin, run this manually
-- in the Supabase SQL Editor (get their id from Authentication
-- > Users, or `select id, email from auth.users;`):
--
--   insert into admin_users (user_id) values ('paste-their-uuid-here');
--
-- To revoke: delete from admin_users where user_id = '...';
-- ============================================================
create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table admin_users enable row level security;

drop policy if exists "admin_users_self_read" on admin_users;
create policy "admin_users_self_read" on admin_users for select
  using (auth.uid() = user_id);
-- no insert/update/delete policy for regular clients on purpose —
-- only a project owner running SQL directly can grant/revoke admin.

create or replace function is_admin()
returns boolean
language sql stable security definer
as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

-- Read-only "see everything" policies, layered on top of the
-- normal per-user policies above (RLS policies are OR'd together,
-- so this only ever ADDS read access for admins — it can't weaken
-- anyone's own access or let admins write to other users' rows).
do $$
declare
  t text;
  tables text[] := array[
    'profiles','user_settings','goals','goal_groups','subjects','topics',
    'tests','test_sections','study_sessions','pomodoros','tasks',
    'workout_templates','workouts','workout_exercises','body_measurements',
    'milestones','skills','activity_log','xp_events','streaks'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "%s_admin_read" on %I;', t, t);
    execute format('create policy "%s_admin_read" on %I for select using (is_admin());', t, t);
  end loop;
end $$;

-- ============================================================
-- AVATAR STORAGE
-- Also create the bucket itself in the dashboard UI:
-- Storage > New bucket > name it exactly "avatars" > Public bucket: ON
-- (the policies below still restrict who can WRITE to it; public
-- just means avatar images can be displayed without a signed URL)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar_public_read" on storage.objects;
create policy "avatar_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatar_owner_write" on storage.objects;
create policy "avatar_owner_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_owner_update" on storage.objects;
create policy "avatar_owner_update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_owner_delete" on storage.objects;
create policy "avatar_owner_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- DONE.
-- ============================================================
