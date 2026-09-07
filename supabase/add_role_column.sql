-- ============================================================================
-- VIRA — User Role Migration: Promote Existing Profiles to 'admin'
-- ============================================================================
-- Run this migration in the Supabase SQL Editor.
-- 
-- 1. All currently existing profiles are set to role = 'admin' (for testing phase).
-- 2. All future new signups automatically default to role = 'user' (Launching Soon).
-- 3. Safe to run whether or not the role column already exists.
-- ============================================================================

-- 1. Add the role column to public.profiles if it does not already exist (default 'user')
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

-- 2. Promote ALL existing profiles in public.profiles to 'admin'
UPDATE public.profiles
  SET role = 'admin';

-- 3. Ensure handle_new_user trigger function guarantees all FUTURE signups default to 'user'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, role)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    'user'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Confirm all current profiles are 'admin':
--   SELECT id, username, display_name, role, created_at FROM public.profiles ORDER BY created_at DESC;
--
-- View role summary counts:
--   SELECT role, count(*) FROM public.profiles GROUP BY role;
