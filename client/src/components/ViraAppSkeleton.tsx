import React from "react";
import { useEasyMode } from "../context/EasyModeContext";

interface ViraAppSkeletonProps {
  message?: string;
  error?: string | null;
  onRetry?: () => void;
}

export const ViraAppSkeleton: React.FC<ViraAppSkeletonProps> = ({
  message = "Connecting to secure WebRTC signaling network...",
  error,
  onRetry,
}) => {
  let isEasyMode = false;
  try {
    const easy = useEasyMode();
    isEasyMode = easy.isEasyMode;
  } catch {
    // Fallback if rendered outside EasyModeProvider
  }

  return (
    <div
      className="vira-skeleton-page-wrapper"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={error ? `Connection error: ${error}` : message}
    >
      <div className="vira-skeleton-container">
        {/* Status / Initializing Pill Indicator */}
        <div className="vira-skeleton-status-bar">
          <div className="vira-skeleton-status-pill">
            <span
              className={`vira-skeleton-status-dot ${error ? "error" : "pulsing"}`}
              aria-hidden="true"
            />
            <span className="vira-skeleton-status-text">
              {error ? error : message}
            </span>
          </div>
          {error && onRetry && (
            <button
              onClick={onRetry}
              className="vira-skeleton-retry-btn"
              type="button"
            >
              Retry Connection
            </button>
          )}
        </div>

        {/* Top Navigation Skeleton */}
        <nav
          className="vira-skeleton-navbar"
          aria-label="Navigation Loading Placeholder"
          aria-hidden="true"
        >
          <div className="vira-skeleton-nav-brand">
            <div className="vira-skeleton-brand-logo">VIRA</div>
            <div className="vira-skeleton-nav-links">
              <div className="vira-skeleton-block nav-link-item active" />
              <div className="vira-skeleton-block nav-link-item" />
              <div className="vira-skeleton-block nav-link-item" />
              <div className="vira-skeleton-block nav-link-item" />
            </div>
          </div>
          <div className="vira-skeleton-nav-right">
            <div className="vira-skeleton-block toggle-pill" />
            <div className="vira-skeleton-block user-pill" />
            <div className="vira-skeleton-block icon-pill" />
            <div className="vira-skeleton-block text-btn" />
            <div className="vira-skeleton-block text-btn" />
          </div>
        </nav>

        {isEasyMode ? (
          /* Easy Mode Skeleton View */
          <div className="vira-skeleton-easy-content" aria-hidden="true">
            {/* Header Area */}
            <div className="vira-skeleton-easy-header">
              <div>
                <div className="vira-skeleton-block easy-title" />
                <div className="vira-skeleton-block easy-subtitle" />
              </div>
              <div className="vira-skeleton-block easy-listen-btn" />
            </div>

            {/* Safety Rules Banner */}
            <div className="vira-skeleton-easy-rules">
              <div className="vira-skeleton-easy-rule-card">
                <div className="vira-skeleton-block icon-block" />
                <div className="vira-skeleton-block card-title" />
                <div className="vira-skeleton-block card-desc" />
                <div className="vira-skeleton-block card-desc short" />
              </div>
              <div className="vira-skeleton-easy-rule-card">
                <div className="vira-skeleton-block icon-block" />
                <div className="vira-skeleton-block card-title" />
                <div className="vira-skeleton-block card-desc" />
                <div className="vira-skeleton-block card-desc short" />
              </div>
            </div>

            {/* Easy Contacts Card */}
            <div className="vira-skeleton-easy-contacts">
              <div className="vira-skeleton-block section-heading" />
              <div className="vira-skeleton-block section-subheading" />

              <div className="vira-skeleton-easy-contact-list">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="vira-skeleton-easy-contact-row">
                    <div className="contact-meta">
                      <div className="vira-skeleton-block contact-name" />
                      <div className="vira-skeleton-block contact-status" />
                    </div>
                    <div className="vira-skeleton-block contact-call-btn" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Standard Editorial Skeleton View */
          <div className="vira-skeleton-editorial-content" aria-hidden="true">
            {/* Editorial Header Section */}
            <section className="vira-skeleton-editorial-header">
              <div className="vira-skeleton-block title-line" />
              <div className="vira-skeleton-block subtitle-line" />
              <div className="vira-skeleton-block subtitle-line short" />
              <div className="vira-skeleton-actions-row">
                <div className="vira-skeleton-block btn-pill primary" />
                <div className="vira-skeleton-block btn-pill outline" />
              </div>
            </section>

            <div className="vira-skeleton-divider" />

            {/* Voice ID Section */}
            <section className="vira-skeleton-section">
              <div className="vira-skeleton-block section-label" />
              <div className="vira-skeleton-voice-row">
                <div className="voice-info-col">
                  <div className="vira-skeleton-block status-tag" />
                  <div className="vira-skeleton-block voice-title" />
                  <div className="vira-skeleton-block voice-desc" />
                </div>
                <div className="vira-skeleton-block btn-pill outline" />
              </div>
            </section>

            <div className="vira-skeleton-divider" />

            {/* People Directory Section */}
            <section className="vira-skeleton-section">
              <div className="vira-skeleton-people-header">
                <div className="vira-skeleton-block section-label" />
                <div className="vira-skeleton-block search-input" />
              </div>

              <div className="vira-skeleton-people-list">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="vira-skeleton-person-row">
                    <div className="person-left">
                      <div className="vira-skeleton-block person-avatar" />
                      <div className="person-text-group">
                        <div className="vira-skeleton-block person-name" />
                        <div className="vira-skeleton-block person-handle" />
                      </div>
                    </div>
                    <div className="person-right">
                      <div className="vira-skeleton-block person-status" />
                      <div className="vira-skeleton-block call-button" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="vira-skeleton-divider" />

            {/* System Status Table Section */}
            <section className="vira-skeleton-section">
              <div className="vira-skeleton-block section-label" />
              <div className="vira-skeleton-system-table">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="vira-skeleton-system-row">
                    <div className="vira-skeleton-block system-label" />
                    <div className="vira-skeleton-block system-val" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
