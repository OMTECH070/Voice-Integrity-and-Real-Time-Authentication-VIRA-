import { supabase } from "./supabaseClient";

const VOICE_SERVICE_URL = import.meta.env.VITE_VOICE_VERIFICATION_URL;

export interface VerifyResult {
  match: boolean;
  score: number;
  reason?: "not_enrolled" | "insufficient_audio";
}

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function enrollVoice(
  audioBlob: Blob
): Promise<{ ok: true } | { ok: false; message: string }> {
  const token = await getAccessToken();
  if (!token) return { ok: false, message: "Not logged in." };

  const formData = new FormData();
  formData.append("file", audioBlob, "enrollment.webm");

  try {
    const response = await fetch(`${VOICE_SERVICE_URL}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const body = await response.json();
    if (!response.ok) {
      return { ok: false, message: body.detail ?? "Enrollment failed." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not reach the voice verification service." };
  }
}

export async function verifyCaller(
  callerAccountId: string,
  audioBlob: Blob
): Promise<VerifyResult | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const formData = new FormData();
  formData.append("caller_account_id", callerAccountId);
  formData.append("file", audioBlob, "verify.webm");

  try {
    const response = await fetch(`${VOICE_SERVICE_URL}/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) return null;
    return (await response.json()) as VerifyResult;
  } catch {
    return null;
  }
}
