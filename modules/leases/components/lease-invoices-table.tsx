import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusBadge } from "@/shared/components";
import { formatDateMyt } from "@/shared/lib/format-datetime";
import { formatSen } from "@/shared/lib/format-money";
import type { LeaseInvoiceItem } from "../types/lease.types";

type LeaseInvoicesTableProps = {
  invoices: LeaseInvoiceItem[];
};

export function LeaseInvoicesTable({ invoices }: LeaseInvoicesTableProps) {
  // Integer additions only - no floats, no rounding.
  let totalAmountSen = 0;
  let totalPaidSen = 0;
  for (const inv of invoices) {
    totalAmountSen += inv.amountSen;
    totalPaidSen += inv.paidSen;
  }
  const totalBalanceSen = totalAmountSen - totalPaidSen;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-title-2 text-label">Invoices</CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {invoices.length === 0 ? (
          <div className="text-subheadline text-label-2 py-8 text-center">
            No invoices generated for this lease.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const balanceSen = inv.amountSen - inv.paidSen;
                const periodLabel =
                  inv.kind === "deposit"
                    ? "Deposit"
                    : inv.periodStart && inv.periodEnd
                      ? `${formatDateMyt(inv.periodStart)} – ${formatDateMyt(inv.periodEnd)}`
                      : `Period ${inv.periodIndex ?? 1}`;

                return (
                  <TableRow key={inv.id}>
                    <TableCell className="text-label font-medium">
                      {periodLabel}
                    </TableCell>
                    <TableCell className="text-label-2">
                      {formatDateMyt(inv.dueDate)}
                    </TableCell>
                    <TableCell className="text-label tabular text-right font-medium">
                      {formatSen(inv.amountSen)}
                    </TableCell>
                    <TableCell className="text-label-2 tabular text-right">
                      {formatSen(inv.paidSen)}
                    </TableCell>
                    <TableCell className="text-label tabular text-right font-medium">
                      {formatSen(balanceSen)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <StatusBadge status={inv.status} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="font-semibold">
                <TableCell colSpan={2} className="text-label">
                  Total
                </TableCell>
                <TableCell className="text-label tabular text-right">
                  {formatSen(totalAmountSen)}
                </TableCell>
                <TableCell className="text-label tabular text-right">
                  {formatSen(totalPaidSen)}
                </TableCell>
                <TableCell className="text-label tabular text-right">
                  {formatSen(totalBalanceSen)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
