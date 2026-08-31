import { supabaseAdmin } from "./supabaseAdmin";
import { CallerRelationship } from "../types/contacts";
import { logger } from "../utils/logger";

/**
 * Relationship of `callerId` FROM `viewerId`'s perspective — i.e. "is
 * this incoming caller someone I know?" Used to build the known/unknown
 * badge on the incoming-call notification.
 *
 * On any lookup failure, this fails safe to "unknown" rather than
 * crashing the call flow or silently treating an unverifiable caller as
 * trusted — an unknown badge is the conservative wrong answer; treating
 * a stranger as known would not be.
 */
export async function getRelationship(
  viewerId: string,
  callerId: string
): Promise<CallerRelationship> {
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("contact_user_id")
    .eq("owner_id", viewerId)
    .eq("contact_user_id", callerId)
    .maybeSingle();

  if (error) {
    logger.warn(`Contacts lookup failed for ${viewerId} -> ${callerId}: ${error.message}`);
    return "unknown";
  }

  return data ? "known" : "unknown";
}
