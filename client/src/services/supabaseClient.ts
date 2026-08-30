import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy client/.env.example to client/.env and fill them in from your Supabase project's API settings."
  );
}

/**
 * The anon key is safe to expose in client code — it's meant to be
 * public. Actual data access is restricted by the Row Level Security
 * policies defined in supabase/schema.sql, not by keeping this key
 * secret. Never put the service_role key here.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
