"use client";

import { useHealth } from "../hooks/use-health";
import { HealthScreen } from "./health-screen";

/** Container: wires hooks to the pure view. page.tsx renders exactly this. */
export function HealthScreenContainer() {
  const { data, isPending, error, refetch } = useHealth();

  return (
    <HealthScreen
      health={data}
      isLoading={isPending}
      errorMessage={error ? error.message : null}
      onRetry={() => void refetch()}
    />
  );
}
