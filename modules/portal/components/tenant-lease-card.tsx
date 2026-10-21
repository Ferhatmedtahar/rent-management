"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { formatDateMyt } from "@/shared/lib/format-datetime";
import { formatSen } from "@/shared/lib/format-money";
import type { TenantLeaseSummary } from "../types/portal.types";

type TenantLeaseCardProps = {
  leases: TenantLeaseSummary[];
  selectedLeaseId: string;
  onSelectLease: (id: string) => void;
};

export function TenantLeaseCard({
  leases,
  selectedLeaseId,
  onSelectLease,
}: TenantLeaseCardProps) {
  const currentLease =
    leases.find((l) => l.id === selectedLeaseId) ?? leases[0];

  if (!currentLease) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-title-2 text-label">My Lease</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-subheadline text-label-2">
            No active lease found for your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-title-2 text-label">My Lease</CardTitle>
        {leases.length > 1 && (
          <div className="w-full sm:w-48">
            <Select value={selectedLeaseId} onValueChange={onSelectLease}>
              <SelectTrigger>
                <SelectValue placeholder="Switch lease" />
              </SelectTrigger>
              <SelectContent>
                {leases.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    Unit {l.unitName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h2 className="text-large-title text-label">
            Unit {currentLease.unitName}
          </h2>
          <p className="text-subheadline text-label-2 mt-1">
            Period:{" "}
            <span className="text-label font-medium">
              {formatDateMyt(currentLease.startDate)} –{" "}
              {formatDateMyt(currentLease.endDate)}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-inset border-outline rounded-lg border p-3">
            <p className="text-footnote text-label-2">Monthly Rent</p>
            <p className="text-title-2 text-label tabular mt-0.5 font-semibold">
              {formatSen(currentLease.monthlyRentSen)}
            </p>
          </div>

          <div className="bg-inset border-outline rounded-lg border p-3">
            <p className="text-footnote text-label-2">Deposit</p>
            <p className="text-title-2 text-label tabular mt-0.5 font-semibold">
              {formatSen(currentLease.depositSen)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
