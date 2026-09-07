-- ====================================================================
-- VIRA — Ensure public.voice_profiles Schema Migration
-- ====================================================================
-- Purpose:
--   Canonical storage for authenticated user ECAPA-TDNN Voice ID enrollment.
--   Stores 192-dimensional embeddings, sample duration, and model metadata.
--
-- Access Model:
--   - Writes: Performed by server-side voiceAuthService using service_role key.
--   - Reads (Verification): Cross-speaker reads performed by server-side
--     voiceAuthService using service_role key during calls (RLS bypassed).
--   - Reads (Client): Authenticated users can only read their own enrollment
--     metadata (e.g., enrolled_at, sample_duration_seconds) via RLS.
--   - Privacy: Raw embedding vectors are never exposed across user boundaries.
--
-- Idempotent: Safe to execute repeatedly without error or data loss.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.voice_profiles (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  embedding double precision[] NOT NULL,
  sample_duration_seconds double precision NOT NULL DEFAULT 0,
  model_version text NOT NULL DEFAULT 'ecapa_tdnn_v1',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies for authenticated client sessions
DO $$
BEGIN
  -- SELECT: Users can only inspect their own voice profile record
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'voice_profiles'
      AND policyname = 'Users can view their own voice profile'
  ) THEN
    CREATE POLICY "Users can view their own voice profile"
      ON public.voice_profiles FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- INSERT: Users can insert their own voice profile record
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'voice_profiles'
      AND policyname = 'Users can insert their own voice profile'
  ) THEN
    CREATE POLICY "Users can insert their own voice profile"
      ON public.voice_profiles FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- UPDATE: Users can update their own voice profile record
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'voice_profiles'
      AND policyname = 'Users can update their own voice profile'
  ) THEN
    CREATE POLICY "Users can update their own voice profile"
      ON public.voice_profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- DELETE: Users can delete their own voice profile record
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'voice_profiles'
      AND policyname = 'Users can delete their own voice profile'
  ) THEN
    CREATE POLICY "Users can delete their own voice profile"
      ON public.voice_profiles FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END
$$;
