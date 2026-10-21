import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { formatDateMyt } from "@/shared/lib/format-datetime";
import { formatSen } from "@/shared/lib/format-money";
import type { LeaseDetailResponse } from "../types/lease.types";

type LeaseHeaderProps = {
  lease: LeaseDetailResponse["lease"];
  unitName?: string;
  tenantName?: string;
  onRecordPayment?: () => void;
};

export function LeaseHeader({
  lease,
  unitName,
  tenantName,
  onRecordPayment,
}: LeaseHeaderProps) {
  const displayTitle = unitName
    ? `Unit ${unitName}`
    : `Lease ${lease.id.slice(0, 8)}`;
  const displayTenant = tenantName ?? "Assigned Tenant";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href="/leases">
            <ArrowLeftIcon className="h-4 w-4" />
            <span>All Leases</span>
          </Link>
        </Button>

        {onRecordPayment && (
          <Button
            onClick={onRecordPayment}
            className="bg-tint text-on-tint hover:bg-tint/90"
          >
            Record payment
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-large-title text-label">{displayTitle}</h1>
          <p className="text-subheadline text-label-2 mt-1">
            Tenant:{" "}
            <span className="text-label font-medium">{displayTenant}</span>
            {" · "}
            Period:{" "}
            <span className="text-label font-medium">
              {formatDateMyt(lease.startDate)} – {formatDateMyt(lease.endDate)}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-footnote text-label-2">Monthly Rent</p>
            <p className="text-title-2 text-label tabular mt-1 font-semibold">
              {formatSen(lease.monthlyRentSen)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-footnote text-label-2">Deposit</p>
            <p className="text-title-2 text-label tabular mt-1 font-semibold">
              {formatSen(lease.depositSen)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-footnote text-label-2">Start Date</p>
            <p className="text-title-2 text-label mt-1 font-semibold">
              {formatDateMyt(lease.startDate)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-footnote text-label-2">End Date</p>
            <p className="text-title-2 text-label mt-1 font-semibold">
              {formatDateMyt(lease.endDate)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
