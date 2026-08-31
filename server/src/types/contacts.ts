/**
 * Whether a caller is "known" is a pure set-membership check on unique
 * account id against the callee's contacts table — never a comparison
 * of display name, username, bio, or photo. Those fields are freely
 * editable and therefore meaningless as a security signal; the unique
 * id is not. See server/src/services/contacts.service.ts.
 */
export type CallerRelationship = "known" | "unknown";
