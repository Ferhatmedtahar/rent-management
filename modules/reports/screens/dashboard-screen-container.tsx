"use client";

import * as React from "react";
import { LoadingState, ErrorState } from "@/shared/components";
import { getLastNMonthsMyt } from "@/shared/lib/format-datetime";
import { useOverdue } from "../hooks/use-overdue";
import { useCollections } from "../hooks/use-collections";
import { DashboardScreen } from "./dashboard-screen";

export function DashboardScreenContainer() {
  // Range is fixed per mount (last 6 Malaysia months). The lazy initializer runs
  // once; it is not rendered, so a server/client clock difference cannot cause
  // a hydration mismatch.
  const [range] = React.useState(() => getLastNMonthsMyt(new Date(), 6));

  const {
    data: overdueData,
    isLoading: isOverdueLoading,
    error: overdueError,
    refetch: refetchOverdue,
  } = useOverdue();

  const {
    data: collectionsData = [],
    isLoading: isCollectionsLoading,
    error: collectionsError,
    refetch: refetchCollections,
  } = useCollections(range.from, range.to);

  if (isOverdueLoading || isCollectionsLoading) {
    return <LoadingState label="Loading dashboard metrics..." />;
  }

  const error = overdueError || collectionsError;
  if (error) {
    return (
      <ErrorState
        title="Could not load dashboard"
        message={error.message ?? "An error occurred while loading reports."}
        onRetry={() => {
          void refetchOverdue();
          void refetchCollections();
        }}
      />
    );
  }

  return (
    <DashboardScreen
      overdueCount={overdueData?.overdueCount ?? 0}
      collections={collectionsData}
    />
  );
}
