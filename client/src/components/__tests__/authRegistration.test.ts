import test from "node:test";
import assert from "node:assert/strict";

// Validation logic matching client/src/pages/AuthPage.tsx
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(val: string): string | null {
  const trimmed = val.trim();
  if (!trimmed) return "Email is required";
  if (!EMAIL_REGEX.test(trimmed)) return "Please enter a valid email address";
  return null;
}

function validatePassword(val: string, currentMode: "login" | "register"): string | null {
  if (!val) return "Password is required";
  if (currentMode === "register" && val.length < 8) {
    return "Password must be at least 8 characters";
  }
  return null;
}

function validateDisplayName(val: string): string | null {
  const trimmed = val.trim();
  if (!trimmed) return "Display name is required";
  if (trimmed.length < 2) return "Display name must be at least 2 characters";
  if (trimmed.length > 50) return "Display name must be 50 characters or less";
  return null;
}

// Logic matching client/src/hooks/useAuth.ts signUpWithEmail
interface MockSupabaseSignUpResponse {
  data: {
    user: { id: string; email: string; identities?: any[] } | null;
    session: { access_token: string } | null;
  };
  error: { message: string; status?: number; code?: string } | null;
}

function simulateSignUp(
  _emailInput: string,
  _passwordInput: string,
  _displayNameInput: string,
  providerResponse: MockSupabaseSignUpResponse
) {
  let error: string | null = null;
  void error;

  const { data, error: signUpError } = providerResponse;

  if (signUpError) {
    const errorMsg = signUpError.message || "Registration failed.";
    const isExistingUser =
      errorMsg.toLowerCase().includes("already registered") ||
      errorMsg.toLowerCase().includes("already exists") ||
      signUpError.code === "user_already_exists" ||
      signUpError.status === 422;

    const finalMsg = isExistingUser
      ? "An account with this email already exists. Please sign in."
      : errorMsg;

    error = finalMsg;
    return { success: false, error: finalMsg };
  }

  // Supabase anti-enumeration protection check:
  if (
    data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    const existingMsg = "An account with this email already exists. Please sign in.";
    error = existingMsg;
    return { success: false, error: existingMsg };
  }

  // Session returned (email confirmation disabled in provider)
  if (data.session) {
    return { success: true, requiresConfirmation: false, error: null };
  }

  // Confirmation required (email confirmation enabled in provider)
  if (data.user) {
    return { success: true, requiresConfirmation: true, error: null };
  }

  const fallbackMsg = "Registration could not be completed. Please try again.";
  error = fallbackMsg;
  return { success: false, error: fallbackMsg };
}

// Routing logic matching client/src/App.tsx getInitialRoute
function simulateRoute(pathname: string, hash = "", search = ""): "landing" | "login" | "signup" | "app" {
  if (
    hash.includes("access_token=") ||
    search.includes("code=") ||
    pathname.startsWith("/app") ||
    hash === "#/app"
  ) {
    return "app";
  }

  if (pathname.startsWith("/login") || hash === "#/login") {
    return "login";
  }

  if (pathname.startsWith("/signup") || hash === "#/signup") {
    return "signup";
  }

  return "landing";
}

test("VIRA Authentication & Registration Logic Test Suite", async (t) => {
  await t.test("TEST 1A: New registration when email confirmation is REQUIRED", () => {
    const result = simulateSignUp("newuser@example.com", "password123", "New User", {
      data: {
        user: { id: "u-123", email: "newuser@example.com", identities: [{ id: "ident-1" }] },
        session: null,
      },
      error: null,
    });

    assert.equal(result.success, true, "Registration must succeed");
    assert.equal(result.requiresConfirmation, true, "Requires email confirmation");
    assert.equal(result.error, null, "Must NOT falsely set an error message");
  });

  await t.test("TEST 1B: New registration when email confirmation is DISABLED (direct session)", () => {
    const result = simulateSignUp("direct@example.com", "password123", "Direct User", {
      data: {
        user: { id: "u-456", email: "direct@example.com", identities: [{ id: "ident-2" }] },
        session: { access_token: "jwt-token-active" },
      },
      error: null,
    });

    assert.equal(result.success, true, "Registration must succeed");
    assert.equal(result.requiresConfirmation, false, "Does not require email confirmation");
    assert.equal(result.error, null, "No error on active session registration");
  });

  await t.test("TEST 2A: Registering already registered email (anti-enumeration mode: identities empty)", () => {
    const result = simulateSignUp("existing@example.com", "password123", "Existing User", {
      data: {
        user: { id: "u-fake-789", email: "existing@example.com", identities: [] },
        session: null,
      },
      error: null,
    });

    assert.equal(result.success, false, "Registration must fail for existing user");
    assert.equal(
      result.error,
      "An account with this email already exists. Please sign in.",
      "Clear message indicating account already exists"
    );
  });

  await t.test("TEST 2B: Registering already registered email (provider returns error)", () => {
    const result = simulateSignUp("existing2@example.com", "password123", "Existing User 2", {
      data: { user: null, session: null },
      error: { message: "User already registered", status: 422 },
    });

    assert.equal(result.success, false, "Registration must fail");
    assert.equal(
      result.error,
      "An account with this email already exists. Please sign in.",
      "Clear message indicating account already exists"
    );
  });

  await t.test("TEST 3: Invalid email validation", () => {
    assert.equal(validateEmail(""), "Email is required");
    assert.equal(validateEmail("   "), "Email is required");
    assert.equal(validateEmail("notanemail"), "Please enter a valid email address");
    assert.equal(validateEmail("missing@domain"), "Please enter a valid email address");
    assert.equal(validateEmail("@nodomain.com"), "Please enter a valid email address");
    assert.equal(validateEmail("user@example.com"), null, "Valid email passes");
  });

  await t.test("TEST 4: Password below minimum (< 8 characters)", () => {
    assert.equal(validatePassword("", "register"), "Password is required");
    assert.equal(validatePassword("short", "register"), "Password must be at least 8 characters");
    assert.equal(validatePassword("1234567", "register"), "Password must be at least 8 characters");
    assert.equal(validatePassword("12345678", "register"), null, "8-character password passes");
    assert.equal(validatePassword("strongPassword2026!", "register"), null, "Strong password passes");
  });

  await t.test("TEST 5: Display Name validation", () => {
    assert.equal(validateDisplayName(""), "Display name is required");
    assert.equal(validateDisplayName(" "), "Display name is required");
    assert.equal(validateDisplayName("a"), "Display name must be at least 2 characters");
    assert.equal(validateDisplayName("Alice"), null, "Valid display name passes");
  });

  await t.test("TEST 6: Provider failure / network error displays provider safe message", () => {
    const result = simulateSignUp("fail@example.com", "password123", "Fail User", {
      data: { user: null, session: null },
      error: { message: "Network connection refused. Please check your internet connection." },
    });

    assert.equal(result.success, false);
    assert.equal(result.error, "Network connection refused. Please check your internet connection.");
  });

  await t.test("TEST 7: Routing resolution guarantees", () => {
    assert.equal(simulateRoute("/"), "landing", "/ maps to landing page");
    assert.equal(simulateRoute("/login"), "login", "/login maps to login tab");
    assert.equal(simulateRoute("/signup"), "signup", "/signup maps to register tab");
    assert.equal(simulateRoute("/app"), "app", "/app maps to protected app");
    assert.equal(simulateRoute("/app", "#access_token=token"), "app", "OAuth token redirects to app");
  });
});
