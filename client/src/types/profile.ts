/**
 * Persistent account/profile types. Deliberately separate from
 * types/user.ts's UserDTO, which is the calling system's EPHEMERAL
 * presence record (id, username, online/in-call status) tied to a live
 * socket connection. PublicUserProfile below is the durable identity
 * record tied to an account — it exists whether or not the person is
 * currently online.
 */
export type UserId = string;

export interface PublicUserProfile {
  id: UserId;
  /** Null until the user picks one — Google sign-in doesn't provide a
   * username, so this is set in a follow-up step after first login. */
  username: string | null;
  displayName: string;
  bio: string | null;
  age: number | null;
  country: string | null;
  avatarUrl: string | null;
  createdAt: number;
}

export interface ProfileUpdateRequest {
  displayName?: string;
  bio?: string;
  age?: number;
  country?: string;
  avatarUrl?: string;
}
