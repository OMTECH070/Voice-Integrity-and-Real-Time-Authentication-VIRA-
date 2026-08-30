import { PublicUserProfile } from "./profile";

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface AuthResponse {
  user: PublicUserProfile;
  token: string;
}

export type AuthErrorCode =
  | "USERNAME_TAKEN"
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "WEAK_PASSWORD"
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "USER_NOT_FOUND"
  | "NETWORK_ERROR";

export interface AuthErrorResponse {
  code: AuthErrorCode;
  message: string;
}

export interface AuthState {
  user: PublicUserProfile | null;
  token: string | null;
  isLoading: boolean;
  error: AuthErrorResponse | null;
}
