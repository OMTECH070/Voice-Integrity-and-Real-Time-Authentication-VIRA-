-- ============================================================================
-- VIRA — ML Dataset Collection & Ground-Truth Review Schema (Idempotent)
-- ============================================================================
-- Run this migration in the Supabase SQL Editor.
--
-- Tables:
-- 1. dataset_samples: Stores captured 12-feature pipeline telemetry per call/window
-- 2. dataset_reviews: Stores human analyst ground-truth reviews & labels
-- 3. dataset_adjudications: Stores consensus & conflict resolution for disagreements
-- 4. dataset_versions: Tracks frozen dataset snapshots for reproducible ML training
--
-- Security:
-- - RLS enabled on all tables
-- - Authenticated users with role = 'admin' can view, review, and adjudicate
-- - Server-side service_role key can insert telemetry samples
-- ============================================================================

-- 1. dataset_samples table
CREATE TABLE IF NOT EXISTS public.dataset_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text NOT NULL,
  session_id text,
  speaker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  speaker_direction text NOT NULL DEFAULT 'remote',
  feature_vector jsonb NOT NULL,
  feature_schema_version text NOT NULL DEFAULT 'VIRA-12F-v1.0',
  ground_truth_status text NOT NULL DEFAULT 'UNLABELED', -- 'UNLABELED', 'PENDING_REVIEW', 'UNDER_REVIEW', 'LABELED', 'ADJUDICATED'
  ground_truth_label text, -- 'LEGITIMATE', 'SUSPICIOUS', 'MALICIOUS', 'INCONCLUSIVE'
  label_confidence text, -- 'HIGH', 'MEDIUM', 'LOW'
  reviewer_count int NOT NULL DEFAULT 0,
  review_status text NOT NULL DEFAULT 'PENDING_REVIEW', -- 'PENDING_REVIEW', 'UNDER_REVIEW', 'INCLUDED', 'EXCLUDED'
  consensus_status text NOT NULL DEFAULT 'NO_REVIEWS', -- 'NO_REVIEWS', 'SINGLE_REVIEW', 'CONSENSUS', 'DISAGREEMENT', 'ADJUDICATED'
  dataset_split text NOT NULL DEFAULT 'TRAIN', -- 'TRAIN', 'VAL', 'TEST', 'UNASSIGNED'
  exclusion_reason text,
  model_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dataset_samples_call_id ON public.dataset_samples(call_id);
CREATE INDEX IF NOT EXISTS idx_dataset_samples_review_status ON public.dataset_samples(review_status);
CREATE INDEX IF NOT EXISTS idx_dataset_samples_created_at ON public.dataset_samples(created_at DESC);

ALTER TABLE public.dataset_samples ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage dataset samples
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dataset_samples' AND policyname = 'Admins can view dataset samples'
  ) THEN
    CREATE POLICY "Admins can view dataset samples"
      ON public.dataset_samples FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dataset_samples' AND policyname = 'Admins can update dataset samples'
  ) THEN
    CREATE POLICY "Admins can update dataset samples"
      ON public.dataset_samples FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;


-- 2. dataset_reviews table
CREATE TABLE IF NOT EXISTS public.dataset_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid REFERENCES public.dataset_samples(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_identifier text NOT NULL,
  identity_status text NOT NULL DEFAULT 'MATCH', -- 'MATCH', 'MISMATCH', 'UNCERTAIN', 'NOT_ASSESSABLE'
  voice_authenticity text NOT NULL DEFAULT 'HUMAN', -- 'HUMAN', 'SYNTHETIC', 'VOICE_CONVERSION', 'REPLAY', 'UNKNOWN', 'NOT_ASSESSABLE'
  conversation_risk text NOT NULL DEFAULT 'BENIGN', -- 'BENIGN', 'SUSPICIOUS', 'MALICIOUS', 'UNKNOWN'
  money_request text NOT NULL DEFAULT 'NONE', -- 'PRESENT', 'NONE'
  urgency_pressure text NOT NULL DEFAULT 'NONE', -- 'PRESENT', 'NONE'
  credential_request text NOT NULL DEFAULT 'NONE', -- 'PRESENT', 'NONE'
  impersonation text NOT NULL DEFAULT 'NONE', -- 'PRESENT', 'NONE'
  overall_label text NOT NULL DEFAULT 'LEGITIMATE', -- 'LEGITIMATE', 'SUSPICIOUS', 'MALICIOUS', 'INCONCLUSIVE'
  reviewer_confidence text NOT NULL DEFAULT 'HIGH', -- 'HIGH', 'MEDIUM', 'LOW'
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dataset_reviews_sample_id ON public.dataset_reviews(sample_id);
CREATE INDEX IF NOT EXISTS idx_dataset_reviews_reviewer_id ON public.dataset_reviews(reviewer_id);

ALTER TABLE public.dataset_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dataset_reviews' AND policyname = 'Admins can view dataset reviews'
  ) THEN
    CREATE POLICY "Admins can view dataset reviews"
      ON public.dataset_reviews FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dataset_reviews' AND policyname = 'Admins can insert dataset reviews'
  ) THEN
    CREATE POLICY "Admins can insert dataset reviews"
      ON public.dataset_reviews FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;


-- 3. dataset_adjudications table
CREATE TABLE IF NOT EXISTS public.dataset_adjudications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid REFERENCES public.dataset_samples(id) ON DELETE CASCADE NOT NULL,
  adjudicator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  final_label text NOT NULL, -- 'LEGITIMATE', 'SUSPICIOUS', 'MALICIOUS', 'INCONCLUSIVE'
  final_identity_status text NOT NULL,
  final_voice_authenticity text NOT NULL,
  final_conversation_risk text NOT NULL,
  resolution_notes text NOT NULL,
  adjudicated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dataset_adjudications_sample_id ON public.dataset_adjudications(sample_id);

ALTER TABLE public.dataset_adjudications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dataset_adjudications' AND policyname = 'Admins can manage adjudications'
  ) THEN
    CREATE POLICY "Admins can manage adjudications"
      ON public.dataset_adjudications FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;


-- 4. dataset_versions table
CREATE TABLE IF NOT EXISTS public.dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_tag text NOT NULL UNIQUE, -- e.g. 'v1.0.0-pilot'
  sample_count int NOT NULL DEFAULT 0,
  train_count int NOT NULL DEFAULT 0,
  val_count int NOT NULL DEFAULT 0,
  test_count int NOT NULL DEFAULT 0,
  feature_schema_version text NOT NULL DEFAULT 'VIRA-12F-v1.0',
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dataset_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dataset_versions' AND policyname = 'Admins can manage dataset versions'
  ) THEN
    CREATE POLICY "Admins can manage dataset versions"
      ON public.dataset_versions FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

-- 5. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
