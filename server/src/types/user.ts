export type UserId = string;

export type PresenceStatus = "available" | "in-call";

export interface User {
  id: UserId;
  username: string;
  socketId: string;
  status: PresenceStatus;
}

/** Safe-to-broadcast shape of a User (no socketId leaked to other clients). */
export interface UserDTO {
  id: UserId;
  username: string;
  status: PresenceStatus;
}

export function toUserDTO(user: User): UserDTO {
  return { id: user.id, username: user.username, status: user.status };
}
