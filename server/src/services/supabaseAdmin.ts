import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in server/.env — see server/.env.example."
  );
}

/**
 * Admin client using the service_role key, which BYPASSES Row Level
 * Security entirely. This key must NEVER be sent to the client or
 * committed anywhere — server-side environment variable only.
 *
 * Why the server needs this at all: RLS on the `contacts` table only
 * lets a user read their OWN contact list (auth.uid() = owner_id). But
 * checking "is this caller known to the callee?" requires reading the
 * CALLEE's contacts row while the request is coming from the CALLER's
 * socket — no single end-user JWT has permission to do that under RLS,
 * by design. The server is the one place that legitimately needs
 * cross-user visibility for this specific check, so it uses the admin
 * client, narrowly, only in contacts.service.ts below.
 */
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
