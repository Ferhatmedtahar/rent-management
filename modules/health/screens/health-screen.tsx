import type { HealthStatus } from "../types/health.types";

type HealthScreenProps = {
  health: HealthStatus | undefined;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
};

/** Pure view: props in, markup out. No fetching, no hooks, no side effects. */
export function HealthScreen({
  health,
  isLoading,
  errorMessage,
  onRetry,
}: HealthScreenProps) {
  if (isLoading) {
    return <p role="status">Checking service status…</p>;
  }

  if (errorMessage) {
    return (
      <div role="alert">
        <p>{errorMessage}</p>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (!health) {
    return (
      <div>
        <p>No status available yet.</p>
        <button type="button" onClick={onRetry}>
          Check now
        </button>
      </div>
    );
  }

  return (
    <p>
      Service is <strong>{health.status}</strong> (server time {health.time})
    </p>
  );
}
