"use client";

import * as React from "react";
import Link from "next/link";
import { SearchIcon, PlusIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/components";
import { formatDateMyt } from "@/shared/lib/format-datetime";
import { formatSen } from "@/shared/lib/format-money";
import type { LeaseSummary } from "../types/lease.types";

type LeasesScreenProps = {
  leases: LeaseSummary[];
  isManager: boolean;
  onCreateLease?: () => void;
};

export function LeasesScreen({
  leases,
  isManager,
  onCreateLease,
}: LeasesScreenProps) {
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leases;
    return leases.filter(
      (l) =>
        l.unitName.toLowerCase().includes(q) ||
        l.tenantName.toLowerCase().includes(q),
    );
  }, [leases, search]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-large-title text-label">Leases</h1>
          <p className="text-subheadline text-label-2 mt-1">
            Active and past lease agreements for your organization.
          </p>
        </div>

        {isManager && onCreateLease && (
          <Button
            onClick={onCreateLease}
            className="bg-tint text-on-tint hover:bg-tint/90 gap-1.5 self-start sm:self-auto"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Create lease</span>
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="text-label-2 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Filter by unit or tenant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              title={search ? "No matching leases" : "No leases found"}
              description={
                search
                  ? "Try adjusting your search filter."
                  : "No leases have been created for your organization yet."
              }
              action={
                isManager && !search && onCreateLease
                  ? {
                      label: "Create the first lease",
                      onClick: onCreateLease,
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Monthly Rent</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lease) => (
                  <TableRow
                    key={lease.id}
                    className="hover:bg-muted/60 cursor-pointer"
                  >
                    <TableCell className="text-label font-semibold">
                      <Link
                        href={`/leases/${lease.id}`}
                        className="text-tint block h-full w-full hover:underline"
                      >
                        Unit {lease.unitName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-label font-medium">
                      <Link
                        href={`/leases/${lease.id}`}
                        className="block h-full w-full"
                      >
                        {lease.tenantName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-label-2">
                      <Link
                        href={`/leases/${lease.id}`}
                        className="block h-full w-full"
                      >
                        {formatDateMyt(lease.startDate)} –{" "}
                        {formatDateMyt(lease.endDate)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-label tabular text-right font-medium">
                      <Link
                        href={`/leases/${lease.id}`}
                        className="block h-full w-full"
                      >
                        {formatSen(lease.monthlyRentSen)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-label-2 tabular text-right">
                      <Link
                        href={`/leases/${lease.id}`}
                        className="block h-full w-full"
                      >
                        {formatSen(lease.depositSen)}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
