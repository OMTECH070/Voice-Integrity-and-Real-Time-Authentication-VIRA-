import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  logger.warn(
    "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured in server/.env. Database operations will use in-memory fallbacks."
  );
} else {
  client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export const supabaseAdmin = client;

