/**
 * Whether a caller is "known" — computed server-side by matching the
 * caller's unique account id against the callee's contacts table, never
 * by comparing display name, username, bio, or photo. Those fields are
 * freely editable and therefore meaningless as a security signal; the
 * unique id is not.
 */
export type CallerRelationship = "known" | "unknown";
