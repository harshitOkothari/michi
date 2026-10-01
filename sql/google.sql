-- ============================================================
-- GOOGLE LOGIN — run ONCE in Supabase > SQL Editor > New query
-- Makes new profiles pick up the name Google provides.
-- Safe to run more than once.
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), ''),
    new.email
  );
  insert into user_settings (user_id) values (new.id);
  insert into streaks (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;
