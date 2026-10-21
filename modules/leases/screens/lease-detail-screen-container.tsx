"use client";

import * as React from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/supabase/browser";
import { LoadingState, ErrorState } from "@/shared/components";
import { queryKeys } from "@/shared/lib/query-keys";
import { useMe } from "@/modules/auth";
import {
  recordPayment,
  approvePayment,
  rejectPayment,
  voidPayment,
} from "@/modules/payments";
import { useLease } from "../hooks/use-lease";
import { useLeases } from "../hooks/use-leases";
import { useLeaseSlips } from "../hooks/use-lease-slips";
import { LeaseDetailScreen } from "./lease-detail-screen";
import { RecordPaymentDialog } from "../components/record-payment-dialog";
import { ApprovePaymentDialog } from "../components/approve-payment-dialog";
import { RejectPaymentDialog } from "../components/reject-payment-dialog";
import { VoidPaymentDialog } from "../components/void-payment-dialog";
import type { LeasePaymentItem } from "../types/lease.types";

type LeaseDetailScreenContainerProps = {
  leaseId: string;
};

export function LeaseDetailScreenContainer({
  leaseId,
}: LeaseDetailScreenContainerProps) {
  const queryClient = useQueryClient();
  const { data: actor } = useMe();
  const { data: leaseDetail, isLoading, error, refetch } = useLease(leaseId);
  const { data: leasesList } = useLeases();
  const { data: slipPaths = {} } = useLeaseSlips(leaseId);

  // Dialog states
  const [isRecordOpen, setIsRecordOpen] = React.useState(false);
  const [approveTarget, setApproveTarget] =
    React.useState<LeasePaymentItem | null>(null);
  const [rejectTarget, setRejectTarget] =
    React.useState<LeasePaymentItem | null>(null);
  const [voidTarget, setVoidTarget] = React.useState<LeasePaymentItem | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isManager = actor?.role === "manager";

  // Look up unit and tenant names from the list query cache if present
  const summary = React.useMemo(() => {
    return leasesList?.find((l) => l.id === leaseId);
  }, [leasesList, leaseId]);

  // Outstanding balance = sum(amountSen) - sum(paidSen)
  const outstandingBalanceSen = React.useMemo(() => {
    if (!leaseDetail) return 0;
    let totalAmount = 0;
    let totalPaid = 0;
    for (const inv of leaseDetail.invoices) {
      totalAmount += inv.amountSen;
      totalPaid += inv.paidSen;
    }
    return Math.max(0, totalAmount - totalPaid);
  }, [leaseDetail]);

  const invalidateData = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.lease(leaseId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.overdue.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.leases.all }),
      queryClient.invalidateQueries({
        queryKey: ["leases", "slips", leaseId],
      }),
    ]);
  }, [queryClient, leaseId]);

  const handleViewSlip = React.useCallback(async (slipPath: string) => {
    try {
      const supabase = createClient();
      const { data, error: storageError } = await supabase.storage
        .from("payment-slips")
        .createSignedUrl(slipPath, 60);

      if (storageError || !data?.signedUrl) {
        toast.error("Could not load payment slip");
        return;
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not load payment slip");
    }
  }, []);

  const handleRecordPayment = async (data: {
    amountSen: number;
    method: "cash" | "bank_transfer";
    receivedAt: string;
    slipFile?: File;
  }) => {
    if (!actor?.orgId) {
      throw new Error("Unable to identify organization.");
    }

    setIsSubmitting(true);
    let uploadedSlipPath: string | undefined;

    try {
      // 1. Upload slip file if bank transfer
      if (data.method === "bank_transfer" && data.slipFile) {
        const supabase = createClient();
        const ext = data.slipFile.name.split(".").pop() || "jpg";
        const path = `${actor.orgId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("payment-slips")
          .upload(path, data.slipFile, { upsert: false });

        if (uploadError) {
          toast.error("Failed to upload payment slip");
          throw new Error("Failed to upload payment slip. Please try again.");
        }
        uploadedSlipPath = path;
      }

      // 2. Call backend to record payment
      const res = await recordPayment(leaseId, {
        amountSen: data.amountSen,
        method: data.method,
        receivedAt: data.receivedAt,
        slipPath: uploadedSlipPath,
      });

      if (res.status === "approved") {
        toast.success("Payment recorded");
      } else {
        toast.success("Payment recorded, waiting for manager approval");
      }

      await invalidateData();
      setIsRecordOpen(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to record payment.";
      throw new Error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    setIsSubmitting(true);
    try {
      await approvePayment(approveTarget.id);
      toast.success("Payment approved");
      await invalidateData();
      setApproveTarget(null);
    } catch (err: unknown) {
      const errWithStatus = err as { status?: number; message?: string };
      if (errWithStatus.status === 409) {
        toast.error("This payment was already handled");
        void refetch();
      } else {
        toast.error(errWithStatus.message ?? "Could not approve payment");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    setIsSubmitting(true);
    try {
      await rejectPayment(rejectTarget.id, reason);
      toast.success("Payment rejected");
      await invalidateData();
      setRejectTarget(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not reject payment";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoid = async (reason: string) => {
    if (!voidTarget) return;
    setIsSubmitting(true);
    try {
      await voidPayment(voidTarget.id, reason);
      toast.success("Payment voided");
      await invalidateData();
      setVoidTarget(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not void payment";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState label="Loading lease details..." />;
  }

  if (error || !leaseDetail) {
    return (
      <ErrorState
        title="Could not load lease"
        message={
          error?.message ??
          "An unexpected error occurred while loading the lease."
        }
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <>
      <LeaseDetailScreen
        leaseDetail={leaseDetail}
        unitName={summary?.unitName}
        tenantName={summary?.tenantName}
        slipPaths={slipPaths}
        onViewSlip={handleViewSlip}
        onRecordPayment={() => setIsRecordOpen(true)}
        isManager={isManager}
        onApprove={(payment) => setApproveTarget(payment)}
        onReject={(payment) => setRejectTarget(payment)}
        onVoid={(payment) => setVoidTarget(payment)}
      />

      <RecordPaymentDialog
        isOpen={isRecordOpen}
        onOpenChange={setIsRecordOpen}
        outstandingBalanceSen={outstandingBalanceSen}
        onSubmit={handleRecordPayment}
        isSubmitting={isSubmitting}
      />

      {approveTarget && (
        <ApprovePaymentDialog
          isOpen={Boolean(approveTarget)}
          onOpenChange={(open) => !open && setApproveTarget(null)}
          amountSen={approveTarget.amountSen}
          onConfirm={handleApprove}
          isSubmitting={isSubmitting}
        />
      )}

      {rejectTarget && (
        <RejectPaymentDialog
          isOpen={Boolean(rejectTarget)}
          onOpenChange={(open) => !open && setRejectTarget(null)}
          onConfirm={handleReject}
          isSubmitting={isSubmitting}
        />
      )}

      {voidTarget && (
        <VoidPaymentDialog
          isOpen={Boolean(voidTarget)}
          onOpenChange={(open) => !open && setVoidTarget(null)}
          amountSen={voidTarget.amountSen}
          onConfirm={handleVoid}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  );
}
