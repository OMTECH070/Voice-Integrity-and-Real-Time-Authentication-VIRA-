-- ============================================================
-- VIRA — voice_embeddings table (run once in SQL Editor)
-- ============================================================
-- Stores each account's enrolled ECAPA-TDNN voiceprint (a 192-dim
-- float array). One row per account.
--
-- SECURITY MODEL:
-- - INSERT/UPDATE (enrollment) is restricted to the owner's own row via
--   RLS below — enrollment always runs under the enrolling user's own
--   Supabase session, so this is safe with normal RLS, no elevated
--   access needed.
-- - SELECT is intentionally NOT open to "everyone" (unlike profiles) —
--   only the owner can read their own row through the normal client.
--   The one legitimate exception is the voice-verification-service's
--   /verify endpoint, which needs to read ANY account's embedding to
--   check "does this live audio match that account's voiceprint" — it
--   does this using the service_role key (bypassing RLS entirely),
--   the same narrowly-scoped pattern already used for the contacts
--   known/unknown lookup. The raw embedding is never returned to any
--   client from that endpoint — only a match boolean and a score.
create table public.voice_embeddings (
  owner_id uuid references auth.users(id) on delete cascade primary key,
  embedding real[] not null,
  enrolled_at timestamptz not null default now()
);

alter table public.voice_embeddings enable row level security;

create policy "Users can view their own voice embedding"
  on public.voice_embeddings for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own voice embedding"
  on public.voice_embeddings for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own voice embedding"
  on public.voice_embeddings for update
  using (auth.uid() = owner_id);
