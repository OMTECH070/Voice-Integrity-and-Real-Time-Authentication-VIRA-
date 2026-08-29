import { CallError } from "../types/call";

interface ErrorBannerProps {
  error: CallError;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  return (
    <div className="error-banner">
      <span>{error.message}</span>
      <button onClick={onDismiss}>&times;</button>
    </div>
  );
}
