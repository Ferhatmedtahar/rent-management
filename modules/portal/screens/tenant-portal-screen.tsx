import { TenantProfileCard } from "../components/tenant-profile-card";
import { TenantLeaseCard } from "../components/tenant-lease-card";
import { AmountDueCard } from "../components/amount-due-card";
import {
  LeaseInvoicesTable,
  LeasePaymentsTable,
  type LeaseDetailResponse,
} from "@/modules/leases";
import type { TenantProfile, TenantLeaseSummary } from "../types/portal.types";

type TenantPortalScreenProps = {
  profile: TenantProfile;
  leases: TenantLeaseSummary[];
  selectedLeaseId: string;
  onSelectLease: (id: string) => void;
  leaseDetail: LeaseDetailResponse | null;
  amountDueSen: number;
  onPayNow: () => void;
  isCreatingBill: boolean;
  onUpdatePhone: (phone: string | null) => Promise<void>;
  isUpdatingPhone: boolean;
};

export function TenantPortalScreen({
  profile,
  leases,
  selectedLeaseId,
  onSelectLease,
  leaseDetail,
  amountDueSen,
  onPayNow,
  isCreatingBill,
  onUpdatePhone,
  isUpdatingPhone,
}: TenantPortalScreenProps) {
  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-large-title text-label">Tenant Portal</h1>
        <p className="text-subheadline text-label-2 mt-1">
          Welcome back,{" "}
          <span className="text-label font-medium">{profile.name}</span>. View
          your invoices, payment history, and pay rent online.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <TenantProfileCard
          profile={profile}
          onUpdatePhone={onUpdatePhone}
          isUpdatingPhone={isUpdatingPhone}
        />

        <AmountDueCard
          amountDueSen={amountDueSen}
          onPayNow={onPayNow}
          isCreatingBill={isCreatingBill}
        />

        <TenantLeaseCard
          leases={leases}
          selectedLeaseId={selectedLeaseId}
          onSelectLease={onSelectLease}
        />
      </div>

      {leaseDetail && (
        <>
          <LeaseInvoicesTable invoices={leaseDetail.invoices} />
          <LeasePaymentsTable
            payments={leaseDetail.payments}
            slipPaths={{}}
            onViewSlip={() => {}}
            isManager={false}
          />
        </>
      )}
    </div>
  );
}
