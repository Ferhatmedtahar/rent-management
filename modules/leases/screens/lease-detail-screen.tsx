import { LeaseHeader } from "../components/lease-header";
import { LeaseInvoicesTable } from "../components/lease-invoices-table";
import { LeasePaymentsTable } from "../components/lease-payments-table";
import type {
  LeaseDetailResponse,
  LeasePaymentItem,
} from "../types/lease.types";

type LeaseDetailScreenProps = {
  leaseDetail: LeaseDetailResponse;
  unitName?: string;
  tenantName?: string;
  slipPaths: Record<string, string>;
  onViewSlip: (slipPath: string) => void;
  onRecordPayment?: () => void;
  isManager?: boolean;
  onApprove?: (payment: LeasePaymentItem) => void;
  onReject?: (payment: LeasePaymentItem) => void;
  onVoid?: (payment: LeasePaymentItem) => void;
};

export function LeaseDetailScreen({
  leaseDetail,
  unitName,
  tenantName,
  slipPaths,
  onViewSlip,
  onRecordPayment,
  isManager = false,
  onApprove,
  onReject,
  onVoid,
}: LeaseDetailScreenProps) {
  return (
    <div className="space-y-6 pb-12">
      <LeaseHeader
        lease={leaseDetail.lease}
        unitName={unitName}
        tenantName={tenantName}
        onRecordPayment={onRecordPayment}
      />

      <LeaseInvoicesTable invoices={leaseDetail.invoices} />

      <LeasePaymentsTable
        payments={leaseDetail.payments}
        slipPaths={slipPaths}
        onViewSlip={onViewSlip}
        isManager={isManager}
        onApprove={onApprove}
        onReject={onReject}
        onVoid={onVoid}
      />
    </div>
  );
}
