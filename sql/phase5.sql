-- PHASE 5 — run ONCE in Supabase > SQL Editor. Safe to run again.
-- Remembers which 3D body (male / female) a student picked in Measurements,
-- so the same body shows on every device and in the admin view.
alter table public.profiles add column if not exists gender text check (gender in ('male', 'female'));
-- (students already update their own profile row; admins already have read-only access to every profile)
