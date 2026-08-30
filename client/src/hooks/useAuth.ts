import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { PublicUserProfile } from "../types/profile";

export interface UseAuthResult {
  user: PublicUserProfile | null;
  isLoading: boolean;
  error: string | null;
  /** True once logged in but the user hasn't set a username yet
   * (always true right after Google sign-in, since Google doesn't
   * provide one). The app should show the username-setup step
   * before anything else while this is true. */
  needsUsername: boolean;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  claimUsername: (username: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  dismissError: () => void;
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const SUPABASE_UNIQUE_VIOLATION = "23505";

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string;
  bio: string | null;
  age: number | null;
  country: string | null;
  avatar_url: string | null;
  created_at: string;
}

function rowToProfile(row: ProfileRow): PublicUserProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    age: row.age,
    country: row.country,
    avatarUrl: row.avatar_url,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setUser(rowToProfile(data as ProfileRow));
  }, []);

  // Restore session on load, and keep in sync with auth changes
  // (including the redirect back from Google OAuth).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName: string) => {
      setError(null);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: displayName } },
      });
      if (signUpError) {
        setError(signUpError.message);
        return false;
      }
      if (data.user) await loadProfile(data.user.id);
      return true;
    },
    [loadProfile]
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return false;
      }
      if (data.user) await loadProfile(data.user.id);
      return true;
    },
    [loadProfile]
  );

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) setError(oauthError.message);
    // No further action here — Supabase redirects to Google, then back
    // to this app, at which point onAuthStateChange (above) fires and
    // loads the profile.
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const claimUsername = useCallback(
    async (usernameInput: string) => {
      setError(null);
      const normalized = usernameInput.trim().toLowerCase();

      if (!USERNAME_PATTERN.test(normalized)) {
        setError(
          "Username must be 3-20 characters: lowercase letters, numbers, and underscores only."
        );
        return false;
      }
      if (!user) return false;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ username: normalized })
        .eq("id", user.id);

      if (updateError) {
        setError(
          updateError.code === SUPABASE_UNIQUE_VIOLATION
            ? "That username is already taken."
            : updateError.message
        );
        return false;
      }

      await loadProfile(user.id);
      return true;
    },
    [user, loadProfile]
  );

  const refreshProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) await loadProfile(session.user.id);
  }, [loadProfile]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    user,
    isLoading,
    error,
    needsUsername: !!user && !user.username,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    claimUsername,
    refreshProfile,
    dismissError,
  };
}
