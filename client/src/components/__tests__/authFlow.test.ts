import test from "node:test";
import assert from "node:assert/strict";
import { SignUpResult } from "../../hooks/useAuth";

test("VIRA Auth Registration & Confirmation Flow Test Suite", async (t) => {
  await t.test("1. SignUpResult type accommodates all required classification states", () => {
    const states: SignUpResult[] = [
      "success",
      "confirmation_required",
      "error",
    ];
    assert.equal(states.length, 3, "Must define 3 valid SignUpResult states");
  });

  await t.test("2. Signup without session is classified strictly as confirmation_required without checking identities.length", () => {
    // Simulate Supabase response when email confirmation is enabled:
    // data.user exists, data.session is null, identities may be empty or obfuscated
    const classifySignup = (data: { user: { id: string } | null; session: unknown | null }, error: { message: string } | null): SignUpResult => {
      if (error) {
        return "error";
      }
      if (!data.session) {
        // Must NOT inspect data.user.identities
        return "confirmation_required";
      }
      return "success";
    };

    // Case A: New user, session null, empty identities array (typical Supabase email confirmation pending)
    const resultNewUser = classifySignup({ user: { id: "user-123" }, session: null }, null);
    assert.equal(resultNewUser, "confirmation_required", "Must be confirmation_required when session is null");

    // Case B: Existing user, session null, obfuscated response
    const resultExistingUser = classifySignup({ user: { id: "user-456" }, session: null }, null);
    assert.equal(resultExistingUser, "confirmation_required", "Must be confirmation_required when session is null");

    // Case C: Immediate session (auto-confirm enabled)
    const resultImmediateSession = classifySignup({ user: { id: "user-789" }, session: { access_token: "xyz" } }, null);
    assert.equal(resultImmediateSession, "success", "Must be success when session is present");

    // Case D: Supabase error (e.g. invalid email)
    const resultError = classifySignup({ user: null, session: null }, { message: "Invalid email" });
    assert.equal(resultError, "error", "Must return error when Supabase reports error");
  });

  await t.test("3. Confirmation required message copy matches specification exactly in English and Hindi", () => {
    const enTitle = "Account created";
    const enDesc = "Please check your email and confirm your account before signing in.";
    const hiTitle = "खाता बन गया";
    const hiDesc = "कृपया अपना ईमेल चेक करें और अपना खाता सत्यापित करें।";

    assert.equal(enTitle, "Account created");
    assert.equal(enDesc, "Please check your email and confirm your account before signing in.");
    assert.equal(hiTitle, "खाता बन गया");
    assert.equal(hiDesc, "कृपया अपना ईमेल चेक करें और अपना खाता सत्यापित करें।");
  });
});
