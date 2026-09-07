import { FormEvent, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { UseAuthResult } from "../hooks/useAuth";
import { useEasyMode } from "../context/EasyModeContext";
import { EasyModeNavToggle } from "../components/EasyModeNavToggle";
import { TranslationSchema } from "../utils/easyModeTranslations";

interface AuthPageProps {
  auth: UseAuthResult;
  initialMode?: "login" | "register";
  onBackToLanding?: () => void;
  onSuccess?: () => void;
  onAuthSuccessStart?: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ marginRight: "4px", flexShrink: 0 }}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function AuthPage({
  auth,
  initialMode = "login",
  onBackToLanding,
  onSuccess,
  onAuthSuccessStart,
}: AuthPageProps) {
  let isEasyMode = false;
  let t: (key: keyof TranslationSchema) => string = () => "";
  try {
    const easy = useEasyMode();
    isEasyMode = easy.isEasyMode;
    t = easy.t;
  } catch {
    // Fallback if rendered outside EasyModeProvider
  }

  const [mode, setMode] = useState<"login" | "register">(initialMode);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [signupConfirmationRequired, setSignupConfirmationRequired] =
    useState(false);

  const [errors, setErrors] = useState<{ email?: string; password?: string; displayName?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean; displayName?: boolean }>({});

  const switchMode = (newMode: "login" | "register") => {
    if (newMode === mode) {
      setErrors({});
      setTouched({});
      setSignupConfirmationRequired(false);
      setIsSuccess(false);

      if (auth.error) {
        auth.dismissError();
      }

      return;
    }

    setMode(newMode);

    setErrors({});
    setTouched({});
    setShowPassword(false);
    setSignupConfirmationRequired(false);
    setIsSuccess(false);

    if (auth.error) {
      auth.dismissError();
    }

    try {
      window.history.replaceState(
        null,
        "",
        newMode === "register" ? "/signup" : "/login"
      );
    } catch {
      // Ignore
    }
  };

  const getEmailError = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return isEasyMode ? t("authEmailRequired") : "Email is required";
    if (!EMAIL_REGEX.test(trimmed)) return isEasyMode ? t("authEmailInvalid") : "Please enter a valid email address";
    return null;
  };

  const getPasswordError = (val: string, currentMode: "login" | "register"): string | null => {
    if (!val) return isEasyMode ? t("authPasswordRequired") : "Password is required";
    if (currentMode === "register" && val.length < 8) {
      return isEasyMode ? t("authPasswordTooShort") : "Password must be at least 8 characters";
    }
    return null;
  };

  const getDisplayNameError = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return isEasyMode ? t("authDisplayNameRequired") : "Display name is required";
    if (trimmed.length < 2) return isEasyMode ? t("authDisplayNameTooShort") : "Display name must be at least 2 characters";
    if (trimmed.length > 50) return isEasyMode ? t("authDisplayNameTooLong") : "Display name must be 50 characters or less";
    return null;
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (touched.email) {
      const err = getEmailError(val);
      setErrors((prev) => ({ ...prev, email: err || undefined }));
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (touched.password) {
      const err = getPasswordError(val, mode);
      setErrors((prev) => ({ ...prev, password: err || undefined }));
    }
  };

  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    if (touched.displayName) {
      const err = getDisplayNameError(val);
      setErrors((prev) => ({ ...prev, displayName: err || undefined }));
    }
  };

  const handleBlur = (field: "email" | "password" | "displayName") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "email") {
      const err = getEmailError(email);
      setErrors((prev) => ({ ...prev, email: err || undefined }));
    } else if (field === "password") {
      const err = getPasswordError(password, mode);
      setErrors((prev) => ({ ...prev, password: err || undefined }));
    } else if (field === "displayName") {
      const err = getDisplayNameError(displayName);
      setErrors((prev) => ({ ...prev, displayName: err || undefined }));
    }
  };

  const handleGoogleSignIn = useCallback(async () => {
    if (isGoogleConnecting || auth.isLoading || isSubmitting || isSuccess) return;
    setIsGoogleConnecting(true);
    if (auth.error) auth.dismissError();
    try {
      await auth.signInWithGoogle();
    } catch {
      setIsGoogleConnecting(false);
    }
  }, [auth, isGoogleConnecting, isSubmitting, isSuccess]);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting || auth.isLoading || isGoogleConnecting || isSuccess) return;

    setTouched({ displayName: true, email: true, password: true });
    const nameErr = getDisplayNameError(displayName);
    const emailErr = getEmailError(email);
    const passwordErr = getPasswordError(password, "register");

    if (nameErr || emailErr || passwordErr) {
      setErrors({
        displayName: nameErr || undefined,
        email: emailErr || undefined,
        password: passwordErr || undefined,
      });
      return;
    }

    if (auth.error) auth.dismissError();
    setSignupConfirmationRequired(false);
    setIsSubmitting(true);
    try {
      const result = await auth.signUpWithEmail(email, password, displayName);
      if (result === "success") {
        // Immediate authenticated signup.
        setIsSuccess(true);
        onAuthSuccessStart?.();
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            window.location.href = "/app";
          }
        }, 750);
      } else if (result === "confirmation_required") {
        // Account created, but email confirmation is required.
        setSignupConfirmationRequired(true);
        setIsSuccess(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting || auth.isLoading || isGoogleConnecting || isSuccess) return;

    setTouched({ email: true, password: true });
    const emailErr = getEmailError(email);
    const passwordErr = getPasswordError(password, "login");

    if (emailErr || passwordErr) {
      setErrors({
        email: emailErr || undefined,
        password: passwordErr || undefined,
      });
      return;
    }

    if (auth.error) auth.dismissError();
    setIsSubmitting(true);
    try {
      const success = await auth.signInWithEmail(email, password);
      if (success) {
        setIsSuccess(true);
        onAuthSuccessStart?.();
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            window.location.href = "/app";
          }
        }, 750);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormBusy = isSubmitting || auth.isLoading || isGoogleConnecting || isSuccess;

  return (
    <div
      className="page-container auth-page-card"
      style={{ maxWidth: "380px", textAlign: "left", marginTop: "60px" }}
    >
      {isEasyMode ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          {onBackToLanding ? (
            <button
              type="button"
              onClick={onBackToLanding}
              className="auth-back-link"
              style={{ margin: 0 }}
              aria-label={t("authBackLink")}
            >
              <span className="auth-back-arrow" aria-hidden="true">
                &larr;
              </span>
              <span>{t("authBackLink")}</span>
            </button>
          ) : (
            <div />
          )}
          <EasyModeNavToggle />
        </div>
      ) : (
        onBackToLanding && (
          <button
            type="button"
            onClick={onBackToLanding}
            className="auth-back-link"
            aria-label="Back to VIRA Overview"
          >
            <span className="auth-back-arrow" aria-hidden="true">
              &larr;
            </span>
            <span>Back to VIRA Overview</span>
          </button>
        )
      )}

      <h1 className="brand-logo-text" style={{ fontSize: "24px", marginBottom: "6px" }}>
        VIRA
      </h1>
      <p
        style={{
          fontSize: "13.5px",
          color: "var(--text-secondary)",
          margin: "0 0 24px 0",
          lineHeight: 1.4,
        }}
      >
        {isEasyMode ? t("authSubtitle") : "Real-time voice integrity and speaker authentication."}
      </p>

      {/* Google Sign In */}
      <button
        type="button"
        className="google-btn"
        onClick={handleGoogleSignIn}
        disabled={isFormBusy}
        aria-label={
          isGoogleConnecting
            ? isEasyMode
              ? t("connectingGoogle")
              : "Connecting to Google..."
            : isEasyMode
              ? t("continueWithGoogle")
              : "Continue with Google"
        }
      >
        {isGoogleConnecting ? (
          <>
            <span className="auth-spinner dark" aria-hidden="true" />
            <span>{isEasyMode ? t("connectingGoogle") : "Connecting to Google..."}</span>
          </>
        ) : (
          <>
            <GoogleIcon />
            <span>{isEasyMode ? t("continueWithGoogle") : "Continue with Google"}</span>
          </>
        )}
      </button>

      <div className="auth-divider">
        <span>{isEasyMode ? t("orDivider") : "or"}</span>
      </div>

      {/* Auth Tabs */}
      <div className="auth-tabs" role="tablist" aria-label="Authentication Options">
        <button
          type="button"
          className={mode === "login" ? "auth-tab active" : "auth-tab"}
          onClick={() => switchMode("login")}
          role="tab"
          aria-selected={mode === "login"}
        >
          <span>{isEasyMode ? t("authSignInTab") : "Sign In"}</span>
          {mode === "login" && (
            <motion.div
              className="auth-tab-underline"
              layoutId="auth-tab-underline"
              transition={{ type: "spring", stiffness: 450, damping: 35 }}
            />
          )}
        </button>
        <button
          type="button"
          className={mode === "register" ? "auth-tab active" : "auth-tab"}
          onClick={() => switchMode("register")}
          role="tab"
          aria-selected={mode === "register"}
        >
          <span>{isEasyMode ? t("authRegisterTab") : "Register"}</span>
          {mode === "register" && (
            <motion.div
              className="auth-tab-underline"
              layoutId="auth-tab-underline"
              transition={{ type: "spring", stiffness: 450, damping: 35 }}
            />
          )}
        </button>
      </div>

      {auth.error && (
        <div className="error-banner" role="alert">
          <span>{auth.error}</span>
          <button type="button" onClick={auth.dismissError} aria-label="Dismiss error">
            &times;
          </button>
        </div>
      )}

      {isSuccess ? (
        <div className="auth-success-state" role="status" aria-live="polite">
          <div className="auth-success-badge" aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="auth-success-title">
            {signupConfirmationRequired
              ? isEasyMode
                ? "खाता बन गया"
                : "Account created"
              : isEasyMode
                ? t("authSuccessTitle")
                : "Authentication successful"}
          </div>
          <div className="auth-success-desc">
            {signupConfirmationRequired
              ? isEasyMode
                ? "कृपया अपना ईमेल चेक करें और अपना खाता सत्यापित करें।"
                : "Please check your email and confirm your account before signing in."
              : isEasyMode
                ? t("authSuccessDesc")
                : "Entering VIRA..."}
          </div>
        </div>
      ) : mode === "login" ? (
        <form onSubmit={handleLogin} className="auth-form" noValidate>
          <div>
            <label htmlFor="login-email">{isEasyMode ? t("authEmailLabel") : "Email"}</label>
            <input
              id="login-email"
              type="email"
              placeholder={isEasyMode ? t("authEmailPlaceholder") : "name@example.com"}
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={() => handleBlur("email")}
              className={errors.email && touched.email ? "input-has-error" : ""}
              aria-invalid={!!errors.email && touched.email}
              aria-describedby={errors.email && touched.email ? "login-email-error" : undefined}
              autoFocus
              required
              disabled={isFormBusy}
            />
            {errors.email && touched.email && (
              <span className="auth-field-error" id="login-email-error" role="alert">
                {errors.email}
              </span>
            )}
          </div>
          <div>
            <label htmlFor="login-password">{isEasyMode ? t("authPasswordLabel") : "Password"}</label>
            <div className="auth-password-wrapper">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() => handleBlur("password")}
                className={errors.password && touched.password ? "input-has-error" : ""}
                aria-invalid={!!errors.password && touched.password}
                aria-describedby={errors.password && touched.password ? "login-password-error" : undefined}
                required
                disabled={isFormBusy}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword
                    ? isEasyMode
                      ? t("authHidePassword")
                      : "Hide password"
                    : isEasyMode
                      ? t("authShowPassword")
                      : "Show password"
                }
                tabIndex={0}
                disabled={isFormBusy}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && touched.password && (
              <span className="auth-field-error" id="login-password-error" role="alert">
                {errors.password}
              </span>
            )}
          </div>
          <button
            type="submit"
            className="btn-black"
            disabled={isFormBusy}
            style={{ width: "100%", padding: "10px", marginTop: "4px" }}
          >
            {isSubmitting ? (
              <>
                <span className="auth-spinner" aria-hidden="true" />
                <span>{isEasyMode ? t("authSigningInBtn") : "Signing in..."}</span>
              </>
            ) : (
              isEasyMode ? t("authSignInBtn") : "Sign In"
            )}
          </button>
          {isEasyMode && (
            <div style={{ marginTop: "16px", textAlign: "center", fontSize: "13px", color: "var(--text-secondary)" }}>
              <span>{t("authDontHaveAccount")} </span>
              <button
                type="button"
                onClick={() => switchMode("register")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent-primary, #ffffff)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  font: "inherit",
                  fontWeight: 600,
                }}
              >
                {t("authCreateAccountBtn")}
              </button>
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={handleRegister} className="auth-form" noValidate>
          <div>
            <label htmlFor="reg-name">{isEasyMode ? t("authDisplayNameLabel") : "Display Name"}</label>
            <input
              id="reg-name"
              type="text"
              placeholder={isEasyMode ? t("authDisplayNamePlaceholder") : "Your name"}
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              onBlur={() => handleBlur("displayName")}
              className={errors.displayName && touched.displayName ? "input-has-error" : ""}
              aria-invalid={!!errors.displayName && touched.displayName}
              aria-describedby={errors.displayName && touched.displayName ? "reg-name-error" : undefined}
              autoFocus
              required
              disabled={isFormBusy}
            />
            {errors.displayName && touched.displayName && (
              <span className="auth-field-error" id="reg-name-error" role="alert">
                {errors.displayName}
              </span>
            )}
          </div>
          <div>
            <label htmlFor="reg-email">{isEasyMode ? t("authEmailLabel") : "Email"}</label>
            <input
              id="reg-email"
              type="email"
              placeholder={isEasyMode ? t("authEmailPlaceholder") : "name@example.com"}
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={() => handleBlur("email")}
              className={errors.email && touched.email ? "input-has-error" : ""}
              aria-invalid={!!errors.email && touched.email}
              aria-describedby={errors.email && touched.email ? "reg-email-error" : undefined}
              required
              disabled={isFormBusy}
            />
            {errors.email && touched.email && (
              <span className="auth-field-error" id="reg-email-error" role="alert">
                {errors.email}
              </span>
            )}
          </div>
          <div>
            <label htmlFor="reg-password">{isEasyMode ? t("authPasswordLabel") : "Password"}</label>
            <div className="auth-password-wrapper">
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                placeholder={isEasyMode ? t("authPasswordPlaceholderRegister") : "Minimum 8 characters"}
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() => handleBlur("password")}
                className={errors.password && touched.password ? "input-has-error" : ""}
                aria-invalid={!!errors.password && touched.password}
                aria-describedby={errors.password && touched.password ? "reg-password-error" : undefined}
                required
                minLength={8}
                disabled={isFormBusy}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword
                    ? isEasyMode
                      ? t("authHidePassword")
                      : "Hide password"
                    : isEasyMode
                      ? t("authShowPassword")
                      : "Show password"
                }
                tabIndex={0}
                disabled={isFormBusy}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && touched.password && (
              <span className="auth-field-error" id="reg-password-error" role="alert">
                {errors.password}
              </span>
            )}
          </div>
          <button
            type="submit"
            className="btn-black"
            disabled={isFormBusy}
            style={{ width: "100%", padding: "10px", marginTop: "4px" }}
          >
            {isSubmitting ? (
              <>
                <span className="auth-spinner" aria-hidden="true" />
                <span>{isEasyMode ? t("authCreatingAccountBtn") : "Creating account..."}</span>
              </>
            ) : (
              isEasyMode ? t("authCreateAccountBtn") : "Create Account"
            )}
          </button>
          {isEasyMode && (
            <div style={{ marginTop: "16px", textAlign: "center", fontSize: "13px", color: "var(--text-secondary)" }}>
              <span>{t("authAlreadyHaveAccount")} </span>
              <button
                type="button"
                onClick={() => switchMode("login")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent-primary, #ffffff)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  font: "inherit",
                  fontWeight: 600,
                }}
              >
                {t("authSignInBtn")}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
