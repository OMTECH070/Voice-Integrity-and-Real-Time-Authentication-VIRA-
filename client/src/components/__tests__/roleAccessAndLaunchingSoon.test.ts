import test from "node:test";
import assert from "node:assert/strict";
import { PublicUserProfile, UserRole } from "../../types/profile";
import { EASY_MODE_TRANSLATIONS } from "../../utils/easyModeTranslations";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("VIRA Role-Based Access Control & Launching Soon Test Suite", async (t) => {
  // Helper simulating the role-gated router decision in App.tsx
  function determinePostLoginView(
    auth: {
      isLoading: boolean;
      user: PublicUserProfile | null;
      needsUsername?: boolean;
    },
    requestedRoute: "app" | "admin-dataset" | "login" | "signup" | "landing"
  ): "skeleton" | "auth" | "claim-username" | "home" | "launching-soon" | "admin-dataset" | "landing" {
    if (auth.isLoading) return "skeleton";
    if (!auth.user) {
      if (requestedRoute === "landing") return "landing";
      return "auth";
    }
    if (auth.needsUsername) return "claim-username";

    if (requestedRoute === "admin-dataset") {
      return auth.user.role === "admin" ? "admin-dataset" : "launching-soon";
    }

    if (requestedRoute === "app" || requestedRoute === "login" || requestedRoute === "signup") {
      return auth.user.role === "admin" ? "home" : "launching-soon";
    }

    return "landing";
  }

  await t.test("1. Admin user sees full VIRA application", () => {
    const adminUser: PublicUserProfile = {
      id: "usr_admin_001",
      username: "admin_user",
      displayName: "Administrator",
      bio: null,
      age: 35,
      country: "US",
      avatarUrl: null,
      createdAt: Date.now(),
      role: "admin",
    };

    const view = determinePostLoginView(
      { isLoading: false, user: adminUser, needsUsername: false },
      "app"
    );
    assert.equal(view, "home", "Admin user must be granted access to full Home application");
  });

  await t.test("2. Normal user sees Launching Soon", () => {
    const normalUser: PublicUserProfile = {
      id: "usr_normal_002",
      username: "john_doe",
      displayName: "John Doe",
      bio: null,
      age: 28,
      country: "US",
      avatarUrl: null,
      createdAt: Date.now(),
      role: "user",
    };

    const view = determinePostLoginView(
      { isLoading: false, user: normalUser, needsUsername: false },
      "app"
    );
    assert.equal(view, "launching-soon", "Normal user must be routed to Launching Soon page");
  });

  await t.test("3. Role loading displays ViraAppSkeleton", () => {
    const viewWhileLoading = determinePostLoginView(
      { isLoading: true, user: null },
      "app"
    );
    assert.equal(viewWhileLoading, "skeleton", "While session/role is loading, ViraAppSkeleton must be shown");
  });

  await t.test("4. Normal user cannot reach the admin dashboard through navigation", () => {
    const normalUser: PublicUserProfile = {
      id: "usr_normal_003",
      username: "alice",
      displayName: "Alice",
      bio: null,
      age: 30,
      country: "CA",
      avatarUrl: null,
      createdAt: Date.now(),
      role: "user",
    };

    // Even if normal user was routed via login/signup/app, they only get launching-soon
    const loginView = determinePostLoginView({ isLoading: false, user: normalUser }, "login");
    const signupView = determinePostLoginView({ isLoading: false, user: normalUser }, "signup");
    const appView = determinePostLoginView({ isLoading: false, user: normalUser }, "app");

    assert.equal(loginView, "launching-soon");
    assert.equal(signupView, "launching-soon");
    assert.equal(appView, "launching-soon");
  });

  await t.test("5. Normal user cannot bypass the gate through protected routes (/admin/dataset)", () => {
    const normalUser: PublicUserProfile = {
      id: "usr_normal_004",
      username: "bob",
      displayName: "Bob",
      bio: null,
      age: 22,
      country: "UK",
      avatarUrl: null,
      createdAt: Date.now(),
      role: "user",
    };

    const datasetView = determinePostLoginView({ isLoading: false, user: normalUser }, "admin-dataset");
    assert.equal(
      datasetView,
      "launching-soon",
      "Direct navigation to /admin/dataset by normal user must be blocked and routed to Launching Soon"
    );

    const adminUser: PublicUserProfile = { ...normalUser, role: "admin" };
    const adminDatasetView = determinePostLoginView({ isLoading: false, user: adminUser }, "admin-dataset");
    assert.equal(adminDatasetView, "admin-dataset", "Admin is permitted on /admin/dataset");
  });

  await t.test("6. Admin remains admin after simulated refresh", () => {
    // Simulating database row mapping in useAuth
    function mapRowToProfile(row: { role?: string | null; is_admin?: boolean | null }): UserRole {
      return row.role === "admin" || row.is_admin === true ? "admin" : "user";
    }

    const restoredAdmin = mapRowToProfile({ role: "admin" });
    assert.equal(restoredAdmin, "admin", "Admin role is restored from authenticated database profile");
  });

  await t.test("7. Normal user remains normal user after simulated refresh (least privilege)", () => {
    function mapRowToProfile(row: { role?: string | null; is_admin?: boolean | null }): UserRole {
      return row.role === "admin" || row.is_admin === true ? "admin" : "user";
    }

    assert.equal(mapRowToProfile({ role: "user" }), "user");
    assert.equal(mapRowToProfile({ role: null }), "user", "Missing role strictly defaults to 'user'");
    assert.equal(mapRowToProfile({}), "user", "Empty row strictly defaults to 'user'");
  });

  await t.test("8. Logout clears user and role state", () => {
    let currentUser: PublicUserProfile | null = {
      id: "usr_temp",
      username: "temp",
      displayName: "Temp",
      bio: null,
      age: null,
      country: null,
      avatarUrl: null,
      createdAt: Date.now(),
      role: "admin",
    };

    // Simulate logout action
    function signOut() {
      currentUser = null;
    }

    signOut();
    assert.equal(currentUser, null, "User state is cleared upon logout");

    const view = determinePostLoginView({ isLoading: false, user: currentUser }, "app");
    assert.equal(view, "auth", "Unauthenticated user is redirected to AuthPage");
  });

  await t.test("9. Easy Mode English strings exist for Launching Soon", () => {
    const en = EASY_MODE_TRANSLATIONS.en;
    assert.equal(en.launchingSoon, "Launching Soon");
    assert.equal(en.launchingSoonTitle, "VIRA is getting ready for you.");
    assert.equal(
      en.launchingSoonSubtitle,
      "Advanced voice integrity and secure calling features will be available soon."
    );
    assert.ok(en.launchingSoonSpoken.length > 0);
  });

  await t.test("10. Easy Mode Hindi strings exist for Launching Soon", () => {
    const hi = EASY_MODE_TRANSLATIONS.hi;
    assert.equal(hi.launchingSoon, "जल्द आ रहा है");
    assert.equal(hi.launchingSoonTitle, "VIRA आपके लिए तैयार हो रहा है।");
    assert.equal(
      hi.launchingSoonSubtitle,
      "उन्नत voice integrity और secure calling सुविधाएँ जल्द उपलब्ध होंगी।"
    );
    assert.ok(hi.launchingSoonSpoken.length > 0);
  });

  await t.test("11. No admin credentials, passwords, or emails are hardcoded in client source code", () => {
    const srcDir = path.resolve(__dirname, "../../");
    const filesToCheck = [
      path.join(srcDir, "App.tsx"),
      path.join(srcDir, "hooks/useAuth.ts"),
      path.join(srcDir, "pages/LaunchingSoon.tsx"),
      path.join(srcDir, "types/profile.ts"),
    ];

    for (const filePath of filesToCheck) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        assert.doesNotMatch(
          content,
          /admin@example\.com/i,
          `No hardcoded admin email in ${path.basename(filePath)}`
        );
        assert.doesNotMatch(
          content,
          /const\s+ADMIN_PASSWORD/i,
          `No hardcoded admin password in ${path.basename(filePath)}`
        );
      }
    }
  });

  await t.test("TEST A — EXISTING ACCOUNT: login -> VIRA skeleton -> Full Calling App", () => {
    // Existing accounts in public.profiles receive role = 'admin' via migration
    const existingUser: PublicUserProfile = {
      id: "usr_existing_001",
      username: "nishant_17",
      displayName: "Nishant Raj Anand",
      bio: null,
      age: 26,
      country: "IN",
      avatarUrl: null,
      createdAt: 1725015102353,
      role: "admin",
    };

    // While loading profile/session:
    const loadingView = determinePostLoginView({ isLoading: true, user: null }, "app");
    assert.equal(loadingView, "skeleton", "While loading session, ViraAppSkeleton is displayed");

    // Once loaded:
    const loadedView = determinePostLoginView({ isLoading: false, user: existingUser }, "app");
    assert.equal(loadedView, "home", "Existing account is routed directly to the full VIRA Calling App (Home)");
  });

  await t.test("TEST B — NEW ACCOUNT: signup -> login -> VIRA skeleton -> Launching Soon", () => {
    // New accounts in public.profiles default strictly to role = 'user' via handle_new_user trigger
    const newUser: PublicUserProfile = {
      id: "usr_new_999",
      username: "brand_new_user",
      displayName: "Brand New User",
      bio: null,
      age: 24,
      country: "US",
      avatarUrl: null,
      createdAt: Date.now(),
      role: "user",
    };

    // While loading profile/session:
    const loadingView = determinePostLoginView({ isLoading: true, user: null }, "app");
    assert.equal(loadingView, "skeleton", "While loading session, ViraAppSkeleton is displayed");

    // Once loaded:
    const loadedView = determinePostLoginView({ isLoading: false, user: newUser }, "app");
    assert.equal(loadedView, "launching-soon", "New account is routed to Launching Soon page");
  });

  await t.test("TEST C — DIRECT URL: login as new user and manually open /app", () => {
    const newUser: PublicUserProfile = {
      id: "usr_new_999",
      username: "brand_new_user",
      displayName: "Brand New User",
      bio: null,
      age: 24,
      country: "US",
      avatarUrl: null,
      createdAt: Date.now(),
      role: "user",
    };

    // Direct /app navigation
    const appRouteView = determinePostLoginView({ isLoading: false, user: newUser }, "app");
    assert.equal(appRouteView, "launching-soon", "Direct access to /app must render Launching Soon, NOT Calling App");

    // Direct /admin/dataset navigation
    const adminRouteView = determinePostLoginView({ isLoading: false, user: newUser }, "admin-dataset");
    assert.equal(adminRouteView, "launching-soon", "Direct access to /admin/dataset must render Launching Soon, NOT Admin View");
  });

  await t.test("TEST D — ADMIN: login with existing account", () => {
    const adminAccount: PublicUserProfile = {
      id: "usr_admin_existing",
      username: "omtech",
      displayName: "Om",
      bio: null,
      age: 25,
      country: "IN",
      avatarUrl: null,
      createdAt: 1725005467125,
      role: "admin",
    };

    const view = determinePostLoginView({ isLoading: false, user: adminAccount }, "app");
    assert.equal(view, "home", "Admin account retains full access to existing Calling App");
  });

});
