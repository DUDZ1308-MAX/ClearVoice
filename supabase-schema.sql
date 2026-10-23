-- ClearVoice database schema for Supabase
-- Run this in the Supabase SQL Editor

-- Profiles table (one row per authenticated user)
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  words jsonb default '[]'::jsonb,
  completed jsonb default '[]'::jsonb,
  practiced jsonb default '[]'::jsonb,
  challenge_done jsonb default '[]'::jsonb,
  coach_sessions jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- Row Level Security: users can only read/write their own profile
alter table profiles enable row level security;

create policy "users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Helper: create or update a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, words, completed, practiced, challenge_done, coach_sessions, updated_at)
  values (new.id, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, now())
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
