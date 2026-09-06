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

-- ============================================================
-- Voice Profiles: Biometric speaker embeddings for ECAPA-TDNN verification.
-- Sensitive biometric data — restricted strictly via RLS.
-- ============================================================
create table public.voice_profiles (
  user_id uuid references auth.users(id) on delete cascade primary key,
  embedding float8[] not null,
  sample_duration_seconds numeric not null default 0,
  model_version text not null default 'ECAPA-TDNN-v1',
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voice_profiles enable row level security;

-- Users can only view their own voice profile embedding
create policy "Users can view their own voice profile"
  on public.voice_profiles for select
  using (auth.uid() = user_id);

-- Users can insert their own voice profile embedding
create policy "Users can insert their own voice profile"
  on public.voice_profiles for insert
  with check (auth.uid() = user_id);

-- Users can update their own voice profile embedding
create policy "Users can update their own voice profile"
  on public.voice_profiles for update
  using (auth.uid() = user_id);

-- Users can delete their own voice profile
create policy "Users can delete their own voice profile"
  on public.voice_profiles for delete
  using (auth.uid() = user_id);


-- ============================================================
-- Call Sessions & Voice Verification Telemetry (Production RLS)
-- ============================================================

-- Call Sessions: tracks peer-to-peer authenticated calls
create table if not exists public.call_sessions (
  id text primary key,
  caller_id uuid references auth.users(id) on delete cascade not null,
  callee_id uuid references auth.users(id) on delete cascade not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active'
);

alter table public.call_sessions enable row level security;

create policy "Users can view call sessions they participated in"
  on public.call_sessions for select
  using (auth.uid() = caller_id or auth.uid() = callee_id);

create policy "Users can insert call sessions they originate"
  on public.call_sessions for insert
  with check (auth.uid() = caller_id);

create policy "Participants can update their call session"
  on public.call_sessions for update
  using (auth.uid() = caller_id or auth.uid() = callee_id);

-- Voice Verification Events: ECAPA-TDNN live match events
create table if not exists public.voice_verification_events (
  id uuid primary key default gen_random_uuid(),
  call_id text references public.call_sessions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  similarity numeric not null,
  result text not null, -- 'MATCH', 'MISMATCH', 'UNCERTAIN', 'INSUFFICIENT_AUDIO'
  model_version text not null default 'ECAPA-TDNN-v1',
  created_at timestamptz not null default now()
);

alter table public.voice_verification_events enable row level security;

create policy "Call participants can view voice verification events"
  on public.voice_verification_events for select
  using (
    exists (
      select 1 from public.call_sessions cs
      where cs.id = call_id and (cs.caller_id = auth.uid() or cs.callee_id = auth.uid())
    )
  );

-- Anti-Spoof Events: AASIST + Wav2Vec2 detection logs
create table if not exists public.anti_spoof_events (
  id uuid primary key default gen_random_uuid(),
  call_id text references public.call_sessions(id) on delete cascade not null,
  aasist_score numeric not null,
  wav2vec2_score numeric,
  wav2vec2_status text default 'NOT_READY',
  result text not null, -- 'live', 'likely-synthetic', 'uncertain'
  created_at timestamptz not null default now()
);

alter table public.anti_spoof_events enable row level security;

create policy "Call participants can view anti-spoof events"
  on public.anti_spoof_events for select
  using (
    exists (
      select 1 from public.call_sessions cs
      where cs.id = call_id and (cs.caller_id = auth.uid() or cs.callee_id = auth.uid())
    )
  );

-- Transcript Segments: Chronological speech utterances
create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  call_id text references public.call_sessions(id) on delete cascade not null,
  speaker_id uuid references auth.users(id) on delete set null,
  speaker_direction text not null default 'remote',
  text text not null,
  start_time_ms int not null,
  end_time_ms int not null,
  confidence numeric,
  created_at timestamptz not null default now()
);

alter table public.transcript_segments enable row level security;

create policy "Call participants can view transcript segments"
  on public.transcript_segments for select
  using (
    exists (
      select 1 from public.call_sessions cs
      where cs.id = call_id and (cs.caller_id = auth.uid() or cs.callee_id = auth.uid())
    )
  );

-- Call Risk Events: Social Engineering / Urgency / Money requests
create table if not exists public.call_risk_events (
  id uuid primary key default gen_random_uuid(),
  call_id text references public.call_sessions(id) on delete cascade not null,
  risk_score int not null,
  risk_level text not null, -- 'LOW RISK', 'MEDIUM RISK', 'HIGH RISK'
  primary_assessment text not null,
  detected_signals text[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.call_risk_events enable row level security;

create policy "Call participants can view call risk events"
  on public.call_risk_events for select
  using (
    exists (
      select 1 from public.call_sessions cs
      where cs.id = call_id and (cs.caller_id = auth.uid() or cs.callee_id = auth.uid())
    )
  );

-- Integrity Scores: XGBoost / Fused scoring logs
create table if not exists public.integrity_scores (
  id uuid primary key default gen_random_uuid(),
  call_id text references public.call_sessions(id) on delete cascade not null,
  voice_integrity_score int not null,
  voice_integrity_level text not null,
  call_risk_score int not null,
  call_risk_level text not null,
  model_source text not null,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.integrity_scores enable row level security;

create policy "Call participants can view integrity scores"
  on public.integrity_scores for select
  using (
    exists (
      select 1 from public.call_sessions cs
      where cs.id = call_id and (cs.caller_id = auth.uid() or cs.callee_id = auth.uid())
    )
  );
