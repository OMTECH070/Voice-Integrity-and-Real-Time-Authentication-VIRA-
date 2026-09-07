-- VIRA Database Cleanup Migration
-- Drop obsolete/unused event log, session, and legacy voice tables.
-- ONLY run this after verifying application code no longer references these tables.

DROP TABLE IF EXISTS public.integrity_scores CASCADE;
DROP TABLE IF EXISTS public.call_risk_events CASCADE;
DROP TABLE IF EXISTS public.transcript_segments CASCADE;
DROP TABLE IF EXISTS public.voice_verification_events CASCADE;
DROP TABLE IF EXISTS public.anti_spoof_events CASCADE;
DROP TABLE IF EXISTS public.call_sessions CASCADE;
DROP TABLE IF EXISTS public.voice_embeddings CASCADE;
