-- ============================================================
-- VIRA — Supabase schema (run once in SQL Editor)
-- ============================================================

-- Profiles table: extends Supabase's built-in auth.users with the
-- identity/metadata fields VIRA needs. One row per account, same id
-- as auth.users.id (so profile.id IS the unique account id referenced
-- everywhere else in the system — calling, contacts, etc).
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  display_name text not null default '',
  bio text,
  age int,
  country text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone can view any profile (needed so a caller's profile can be shown
-- to the person they're calling) — but see note below on what should
-- NOT be public later (e.g. email is intentionally not in this table).
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a minimal profile row the moment someone signs up,
-- whether via email/password or Google. For Google sign-ins, Supabase
-- populates raw_user_meta_data with full_name/avatar_url automatically.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Contacts: the known/unknown relationship, now persisted.
-- "Known" is still purely a set-membership check on unique id —
-- see /people/contacts-security-note in the app's README.
-- ============================================================
create table public.contacts (
  owner_id uuid references auth.users(id) on delete cascade,
  contact_user_id uuid references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (owner_id, contact_user_id)
);

alter table public.contacts enable row level security;

create policy "Users can view their own contact list"
  on public.contacts for select
  using (auth.uid() = owner_id);

create policy "Users can add their own contacts"
  on public.contacts for insert
  with check (auth.uid() = owner_id);

create policy "Users can remove their own contacts"
  on public.contacts for delete
  using (auth.uid() = owner_id);
