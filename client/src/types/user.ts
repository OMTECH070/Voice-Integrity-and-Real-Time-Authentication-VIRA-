export type UserId = string;

export type PresenceStatus = "available" | "in-call";

export interface UserDTO {
  id: UserId;
  username: string;
  status: PresenceStatus;
}
