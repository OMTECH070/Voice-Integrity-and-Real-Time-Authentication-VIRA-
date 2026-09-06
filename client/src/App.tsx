import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./hooks/useAuth";
import { AuthPage } from "./pages/AuthPage";
import { ClaimUsername } from "./pages/ClaimUsername";
import { Home } from "./pages/Home";
import { LandingPage } from "./pages/LandingPage";
import { AdminDatasetView } from "./components/AdminDatasetView";
import { EasyModeProvider } from "./context/EasyModeContext";
import { EasyModeLanguageModal } from "./components/EasyModeLanguageModal";
import { ViraAppSkeleton } from "./components/ViraAppSkeleton";
import "./App.css";

type Route = "landing" | "login" | "signup" | "app" | "admin-dataset";

function getInitialRoute(): Route {
  const path = window.location.pathname;
  const hash = window.location.hash;
  const search = window.location.search;

  // If returning from Google OAuth (tokens or code present), land directly on app
  if (
    hash.includes("access_token=") ||
    search.includes("code=") ||
    path.startsWith("/app") ||
    hash === "#/app"
  ) {
    return "app";
  }

  if (path.startsWith("/admin/dataset") || hash === "#/admin/dataset") {
    return "admin-dataset";
  }

  if (path.startsWith("/login") || hash === "#/login") {
    return "login";
  }

  if (path.startsWith("/signup") || hash === "#/signup") {
    return "signup";
  }

  return "landing";
}

function AppContent() {
  const auth = useAuth();
  const [currentRoute, setCurrentRoute] = useState<Route>(getInitialRoute);
  const [authSuccessPending, setAuthSuccessPending] = useState(false);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;

      if (
        hash.includes("access_token=") ||
        search.includes("code=") ||
        path.startsWith("/app") ||
        hash === "#/app"
      ) {
        setCurrentRoute("app");
      } else if (path.startsWith("/admin/dataset") || hash === "#/admin/dataset") {
        setCurrentRoute("admin-dataset");
      } else if (path.startsWith("/login") || hash === "#/login") {
        setCurrentRoute("login");
      } else if (path.startsWith("/signup") || hash === "#/signup") {
        setCurrentRoute("signup");
      } else {
        setCurrentRoute("landing");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToApp = useCallback(() => {
    setCurrentRoute("app");
    try {
      window.history.pushState(null, "", "/app");
    } catch {
      window.location.hash = "#/app";
    }
    window.scrollTo(0, 0);
  }, []);

  const navigateToLogin = useCallback(() => {
    if (auth.user) {
      navigateToApp();
      return;
    }
    setCurrentRoute("login");
    try {
      window.history.pushState(null, "", "/login");
    } catch {
      window.location.hash = "#/login";
    }
    window.scrollTo(0, 0);
  }, [auth.user, navigateToApp]);

  const navigateToSignUp = useCallback(() => {
    if (auth.user) {
      navigateToApp();
      return;
    }
    setCurrentRoute("signup");
    try {
      window.history.pushState(null, "", "/signup");
    } catch {
      window.location.hash = "#/signup";
    }
    window.scrollTo(0, 0);
  }, [auth.user, navigateToApp]);

  const navigateToLanding = useCallback(() => {
    setCurrentRoute("landing");
    try {
      window.history.pushState(null, "", "/");
    } catch {
      window.location.hash = "";
    }
    window.scrollTo(0, 0);
  }, []);

  const navigateToAdminDataset = useCallback(() => {
    setCurrentRoute("admin-dataset");
    try {
      window.history.pushState(null, "", "/admin/dataset");
    } catch {
      window.location.hash = "#/admin/dataset";
    }
    window.scrollTo(0, 0);
  }, []);

  // When user successfully authenticates while on login or signup route, automatically redirect to app
  useEffect(() => {
    if (auth.user && (currentRoute === "login" || currentRoute === "signup") && !authSuccessPending) {
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash.includes("access_token=") || search.includes("code=")) {
        navigateToApp();
      }
    }
  }, [auth.user, currentRoute, authSuccessPending, navigateToApp]);

  // When user logs out while on protected /app route, transition SPA route to /login
  useEffect(() => {
    if (!auth.isLoading && !auth.user && currentRoute === "app") {
      navigateToLogin();
    }
  }, [auth.isLoading, auth.user, currentRoute, navigateToLogin]);

  // 1. Landing Page route (at '/')
  if (currentRoute === "landing") {
    return (
      <LandingPage
        onLaunchApp={auth.user ? navigateToApp : navigateToLogin}
        onLogin={auth.user ? navigateToApp : navigateToLogin}
        onSignUp={auth.user ? navigateToApp : navigateToSignUp}
        isAuthenticated={!!auth.user}
      />
    );
  }

  // 2. Explicit Login Route ('/login') & Sign Up Route ('/signup')
  if (currentRoute === "login" || currentRoute === "signup") {
    if (auth.user && !authSuccessPending) {
      if (auth.needsUsername) {
        return <ClaimUsername auth={auth} />;
      }
      return <Home auth={auth} onBackToLanding={navigateToLanding} onLogout={navigateToLogin} />;
    }
    return (
      <AuthPage
        auth={auth}
        initialMode={currentRoute === "signup" ? "register" : "login"}
        onBackToLanding={navigateToLanding}
        onSuccess={() => {
          setAuthSuccessPending(false);
          navigateToApp();
        }}
        onAuthSuccessStart={() => setAuthSuccessPending(true)}
      />
    );
  }

  // 3. Protected Admin Dataset route (at '/admin/dataset')
  if (currentRoute === "admin-dataset") {
    if (auth.isLoading) {
      return (
        <div className="page-container" style={{ textAlign: "center", marginTop: "100px" }}>
          <h1 className="brand-logo-text" style={{ fontSize: "24px", marginBottom: "8px" }}>VIRA</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: "0 0 20px 0" }}>
            Verifying reviewer credentials...
          </p>
          <div className="cyber-spinner" />
        </div>
      );
    }
    if (!auth.user || authSuccessPending) {
      return (
        <AuthPage
          auth={auth}
          initialMode="login"
          onBackToLanding={navigateToLanding}
          onSuccess={() => {
            setAuthSuccessPending(false);
            navigateToAdminDataset();
          }}
          onAuthSuccessStart={() => setAuthSuccessPending(true)}
        />
      );
    }
    return <AdminDatasetView auth={auth} onBack={navigateToApp} />;
  }

  // 3. Application route (at '/app')
  if (auth.isLoading) {
    return <ViraAppSkeleton message="Authenticating secure session..." />;
  }

  // Protected route: unauthenticated user trying to access /app is shown AuthPage
  if (!auth.user || authSuccessPending) {
    return (
      <AuthPage
        auth={auth}
        initialMode="login"
        onBackToLanding={navigateToLanding}
        onSuccess={() => {
          setAuthSuccessPending(false);
          navigateToApp();
        }}
        onAuthSuccessStart={() => setAuthSuccessPending(true)}
      />
    );
  }

  if (auth.needsUsername) {
    return <ClaimUsername auth={auth} />;
  }

  return <Home auth={auth} onBackToLanding={navigateToLanding} onLogout={navigateToLogin} />;
}

export default function App() {
  return (
    <EasyModeProvider>
      <AppContent />
      <EasyModeLanguageModal />
    </EasyModeProvider>
  );
}
