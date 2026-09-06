import { useState } from "react";

export type SecurityState = "active" | "limited" | "warning" | "offline" | "idle";

interface SecurityIndicatorProps {
  state?: SecurityState;
  tooltipText?: string;
  showLabel?: boolean;
}

const STATE_CONFIG: Record<
  SecurityState,
  { label: string; dotClass: string; description: string }
> = {
  active: {
    label: "Voice Protection Active",
    dotClass: "active",
    description: "VIRA analyzes speech independently from call audio playback.",
  },
  limited: {
    label: "Analysis Limited",
    dotClass: "limited",
    description: "Voice analysis is buffering or operating under noisy acoustic conditions.",
  },
  warning: {
    label: "Voice Warning",
    dotClass: "warning",
    description: "Possible synthetic speech or speaker mismatch detected.",
  },
  offline: {
    label: "Voice Analysis Unavailable",
    dotClass: "offline",
    description: "Voice integrity analysis engine is currently offline.",
  },
  idle: {
    label: "Protection Standby",
    dotClass: "active",
    description: "Voice protection is ready and will activate during active calls.",
  },
};

export function SecurityIndicator({
  state = "idle",
  tooltipText,
  showLabel = true,
}: SecurityIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG.idle;

  return (
    <div
      className="security-indicator-wrapper"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="status"
      aria-label={cfg.label}
    >
      <span className={`sec-dot ${cfg.dotClass}`} aria-hidden="true" />
      {showLabel && <span>{cfg.label}</span>}

      {showTooltip && (
        <div className="security-tooltip" role="tooltip">
          <p style={{ fontWeight: 600, marginBottom: "3px" }}>{cfg.label}</p>
          <p>{tooltipText ?? cfg.description}</p>
        </div>
      )}
    </div>
  );
}
