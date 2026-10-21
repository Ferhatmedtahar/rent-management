import { ExternalLinkIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { StatusBadge } from "@/shared/components";
import { formatDateTimeMyt } from "@/shared/lib/format-datetime";
import { formatSen } from "@/shared/lib/format-money";
import type { LeasePaymentItem } from "../types/lease.types";

type LeasePaymentsTableProps = {
  payments: LeasePaymentItem[];
  slipPaths: Record<string, string>;
  onViewSlip: (slipPath: string) => void;
  isManager?: boolean;
  onApprove?: (payment: LeasePaymentItem) => void;
  onReject?: (payment: LeasePaymentItem) => void;
  onVoid?: (payment: LeasePaymentItem) => void;
};

const METHOD_LABELS: Record<LeasePaymentItem["method"], string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  online: "Online",
};

export function LeasePaymentsTable({
  payments,
  slipPaths,
  onViewSlip,
  isManager = false,
  onApprove,
  onReject,
  onVoid,
}: LeasePaymentsTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-title-2 text-label">Payments</CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {payments.length === 0 ? (
          <div className="text-subheadline text-label-2 py-8 text-center">
            No payments recorded yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Unapplied</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="text-right">Slip</TableHead>
                {isManager && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => {
                const slipPath = slipPaths[p.id];
                const isBankTransfer = p.method === "bank_transfer";

                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-label font-medium whitespace-nowrap">
                      {formatDateTimeMyt(p.receivedAt)}{" "}
                      <span className="text-caption text-label-2 font-normal">
                        MYT
                      </span>
                    </TableCell>
                    <TableCell className="text-label-2">
                      {METHOD_LABELS[p.method]}
                    </TableCell>
                    <TableCell className="text-label tabular text-right font-medium">
                      {formatSen(p.amountSen)}
                    </TableCell>
                    <TableCell className="text-label-2 tabular text-right">
                      {p.unappliedSen > 0 ? formatSen(p.unappliedSen) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <StatusBadge status={p.status} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {isBankTransfer && slipPath ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-tint hover:text-tint h-8 gap-1.5"
                          onClick={() => onViewSlip(slipPath)}
                        >
                          <span>View slip</span>
                          <ExternalLinkIcon className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="text-label-2">—</span>
                      )}
                    </TableCell>
                    {isManager && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {p.status === "pending_verification" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green hover:text-green hover:bg-green-soft border-green/30 h-8"
                                onClick={() => onApprove?.(p)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red hover:text-red hover:bg-red-soft border-red/30 h-8"
                                onClick={() => onReject?.(p)}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {p.status === "approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red hover:text-red hover:bg-red-soft border-red/30 h-8"
                              onClick={() => onVoid?.(p)}
                            >
                              Void
                            </Button>
                          )}
                          {(p.status === "rejected" ||
                            p.status === "voided") && (
                            <span className="text-label-2">—</span>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
