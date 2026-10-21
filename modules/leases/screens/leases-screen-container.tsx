"use client";

import * as React from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState } from "@/shared/components";
import { queryKeys } from "@/shared/lib/query-keys";
import { useMe } from "@/modules/auth";
import { useLeases } from "../hooks/use-leases";
import { useLeaseFormOptions } from "../hooks/use-lease-form-options";
import { createLease } from "../services/leases-api.service";
import { LeasesScreen } from "./leases-screen";
import { CreateLeaseDialog } from "../components/create-lease-dialog";

export function LeasesScreenContainer() {
  const queryClient = useQueryClient();
  const { data: actor } = useMe();
  const { data: leases = [], isLoading, error, refetch } = useLeases();

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isManager = actor?.role === "manager";
  const { data: formOptions } = useLeaseFormOptions(isManager);

  const handleCreateLease = async (data: {
    unitId: string;
    tenantId: string;
    startDate: string;
    endDate: string;
    monthlyRentSen: number;
    depositSen: number;
  }) => {
    setIsSubmitting(true);
    try {
      await createLease(data);
      toast.success("Lease created successfully");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.leases.all,
      });
      setIsCreateOpen(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create lease.";
      throw new Error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState label="Loading leases..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load leases"
        message={error.message ?? "An error occurred while loading leases."}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <>
      <LeasesScreen
        leases={leases}
        isManager={isManager}
        onCreateLease={isManager ? () => setIsCreateOpen(true) : undefined}
      />

      {isManager && (
        <CreateLeaseDialog
          isOpen={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSubmit={handleCreateLease}
          isSubmitting={isSubmitting}
          unitOptions={formOptions?.units ?? []}
          tenantOptions={formOptions?.tenants ?? []}
        />
      )}
    </>
  );
}
