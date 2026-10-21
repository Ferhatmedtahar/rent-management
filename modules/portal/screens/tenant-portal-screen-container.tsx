"use client";

import * as React from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/supabase/browser";
import { LoadingState, ErrorState, EmptyState } from "@/shared/components";
import { queryKeys } from "@/shared/lib/query-keys";
import { todayInMalaysia } from "@/shared/lib/malaysia-time";
import { useMe } from "@/modules/auth";
import { useLease } from "@/modules/leases";
import { createGatewayBill } from "@/modules/gateway";
import { TenantPortalScreen } from "./tenant-portal-screen";
import { PayNowDialog } from "../components/pay-now-dialog";
import type { TenantProfile, TenantLeaseSummary } from "../types/portal.types";

export function TenantPortalScreenContainer() {
  const queryClient = useQueryClient();
  const { data: actor, isLoading: isAuthLoading } = useMe();
  const userId = actor?.userId;

  // 1. Supabase-js query for tenant data under RLS
  const {
    data: tenantData,
    isLoading: isTenantLoading,
    error: tenantError,
    refetch: refetchTenant,
  } = useQuery({
    queryKey: queryKeys.tenantPortal.data(userId),
    queryFn: async () => {
      if (!userId) return null;
      const supabase = createClient();

      const [tenantRes, leasesRes, unitsRes] = await Promise.all([
        supabase
          .from("tenants")
          .select("id, name, email, phone")
          .eq("user_id", userId)
          .single(),
        supabase
          .from("leases")
          .select(
            "id, unit_id, start_date, end_date, monthly_rent_sen, deposit_sen",
          )
          .order("start_date", { ascending: false }),
        supabase.from("units").select("id, name"),
      ]);

      if (tenantRes.error) {
        throw new Error(
          tenantRes.error.message || "Could not load tenant profile",
        );
      }

      const unitsMap = new Map<string, string>();
      for (const u of unitsRes.data ?? []) {
        unitsMap.set(u.id, u.name);
      }

      const leases: TenantLeaseSummary[] = (leasesRes.data ?? []).map((l) => ({
        id: l.id,
        unitId: l.unit_id,
        unitName: unitsMap.get(l.unit_id) ?? "Unknown",
        startDate: l.start_date,
        endDate: l.end_date,
        monthlyRentSen: Number(l.monthly_rent_sen),
        depositSen: Number(l.deposit_sen),
      }));

      return {
        profile: tenantRes.data as TenantProfile,
        leases,
      };
    },
    enabled: Boolean(userId),
  });

  const leases = React.useMemo(() => tenantData?.leases ?? [], [tenantData]);
  const profile = tenantData?.profile;

  // Selected lease defaults to the first (latest) lease until the tenant picks one.
  const [pickedLeaseId, setPickedLeaseId] = React.useState<string | null>(null);
  const selectedLeaseId = pickedLeaseId ?? leases[0]?.id ?? "";

  // 2. Lease detail query via /api/leases/:id
  const {
    data: leaseDetail,
    error: leaseError,
    refetch: refetchLease,
  } = useLease(selectedLeaseId);

  // 3. Amount Due Now in Malaysia time, derived from the loaded lease.
  //    `leaseDetail` only exists after the client-side fetch, so this cannot
  //    cause a server/client hydration mismatch.
  const amountDueSen = React.useMemo(() => {
    if (!leaseDetail) return 0;
    const today = todayInMalaysia(new Date());
    let due = 0;
    for (const inv of leaseDetail.invoices) {
      const unpaid = inv.amountSen - inv.paidSen;
      if (inv.dueDate <= today && unpaid > 0) {
        due += unpaid;
      }
    }
    return due;
  }, [leaseDetail]);

  // 4. Pay now modal & bill creation state
  const [createdBill, setCreatedBill] = React.useState<{
    billId: string;
    amountSen: number;
  } | null>(null);
  const [isPayNowOpen, setIsPayNowOpen] = React.useState(false);
  const [isCreatingBill, setIsCreatingBill] = React.useState(false);

  const handlePayNow = async () => {
    if (!selectedLeaseId || amountDueSen <= 0) return;
    setIsCreatingBill(true);
    try {
      const res = await createGatewayBill(selectedLeaseId);
      setCreatedBill(res);
      setIsPayNowOpen(true);
    } catch (err: unknown) {
      const errObj = err as { status?: number; message?: string };
      if (errObj.status === 422) {
        toast.error("Nothing is due right now.");
      } else {
        toast.error(errObj.message ?? "Could not create payment bill.");
      }
    } finally {
      setIsCreatingBill(false);
    }
  };

  // 5. Phone update mutation
  const [isUpdatingPhone, setIsUpdatingPhone] = React.useState(false);

  const handleUpdatePhone = async (phone: string | null) => {
    if (!userId) return;
    setIsUpdatingPhone(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("tenants")
        .update({ phone })
        .eq("user_id", userId);

      if (updateError) {
        toast.error("Could not update phone");
        throw updateError;
      }

      toast.success("Phone updated");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tenantPortal.all,
      });
    } catch (err) {
      if (!(err as { message?: string })?.message) {
        toast.error("Could not update phone");
      }
      throw err;
    } finally {
      setIsUpdatingPhone(false);
    }
  };

  if (isAuthLoading || isTenantLoading) {
    return <LoadingState label="Loading tenant portal..." />;
  }

  const error = tenantError || leaseError;
  if (error) {
    return (
      <ErrorState
        title="Could not load portal"
        message={
          error.message ?? "An error occurred while loading your tenant data."
        }
        onRetry={() => {
          void refetchTenant();
          void refetchLease();
        }}
      />
    );
  }

  if (!profile) {
    return (
      <EmptyState
        title="No tenant profile found"
        description="Your account is not linked to an active tenant profile. Please contact your property manager."
      />
    );
  }

  return (
    <>
      <TenantPortalScreen
        profile={profile}
        leases={leases}
        selectedLeaseId={selectedLeaseId}
        onSelectLease={setPickedLeaseId}
        leaseDetail={leaseDetail ?? null}
        amountDueSen={amountDueSen}
        onPayNow={handlePayNow}
        isCreatingBill={isCreatingBill}
        onUpdatePhone={handleUpdatePhone}
        isUpdatingPhone={isUpdatingPhone}
      />

      <PayNowDialog
        isOpen={isPayNowOpen}
        onOpenChange={setIsPayNowOpen}
        bill={createdBill}
      />
    </>
  );
}
