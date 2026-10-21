"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { parseRinggitToSen, generateSchedule } from "@/lib/billing";
import { formatSen } from "@/shared/lib/format-money";
import type { LeaseFormOption } from "../hooks/use-lease-form-options";

type CreateLeaseDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    unitId: string;
    tenantId: string;
    startDate: string;
    endDate: string;
    monthlyRentSen: number;
    depositSen: number;
  }) => Promise<void>;
  isSubmitting: boolean;
  unitOptions: LeaseFormOption[];
  tenantOptions: LeaseFormOption[];
};

function CreateLeaseForm({
  onSubmit,
  onCancel,
  isSubmitting,
  unitOptions,
  tenantOptions,
}: {
  onSubmit: CreateLeaseDialogProps["onSubmit"];
  onCancel: () => void;
  isSubmitting: boolean;
  unitOptions: LeaseFormOption[];
  tenantOptions: LeaseFormOption[];
}) {
  const [unitId, setUnitId] = React.useState("");
  const [tenantId, setTenantId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [monthlyRent, setMonthlyRent] = React.useState("");
  const [deposit, setDeposit] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );

  // Compute live schedule preview if inputs are valid
  const schedulePreview = React.useMemo(() => {
    try {
      if (!startDate || !endDate || !monthlyRent || !deposit) return null;
      const rentSen = parseRinggitToSen(monthlyRent);
      const depSen = parseRinggitToSen(deposit);
      if (rentSen <= 0 || depSen < 0 || startDate >= endDate) return null;
      return generateSchedule({
        startDate,
        endDate,
        monthlyRentSen: rentSen,
        depositSen: depSen,
      });
    } catch {
      return null;
    }
  }, [startDate, endDate, monthlyRent, deposit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errors: Record<string, string> = {};

    if (!unitId) errors.unitId = "Please select a unit.";
    if (!tenantId) errors.tenantId = "Please select a tenant.";
    if (!startDate) errors.startDate = "Start date is required.";
    if (!endDate) errors.endDate = "End date is required.";
    if (startDate && endDate && startDate >= endDate) {
      errors.endDate = "End date must be strictly after start date.";
    }

    let rentSen = 0;
    try {
      rentSen = parseRinggitToSen(monthlyRent);
      if (rentSen <= 0) errors.monthlyRent = "Monthly rent must be > 0.";
    } catch {
      errors.monthlyRent = "Enter rent like 2,000.00";
    }

    let depSen = 0;
    try {
      depSen = parseRinggitToSen(deposit);
      if (depSen < 0) errors.deposit = "Deposit cannot be negative.";
    } catch {
      errors.deposit = "Enter deposit like 4,000.00";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      await onSubmit({
        unitId,
        tenantId,
        startDate,
        endDate,
        monthlyRentSen: rentSen,
        depositSen: depSen,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create lease.";
      setFormError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-title-2 text-label">
          Create New Lease
        </DialogTitle>
        <DialogDescription className="text-subheadline text-label-2">
          Set up a new lease agreement with deposit and recurring rent schedule.
        </DialogDescription>
      </DialogHeader>

      {formError && (
        <div
          role="alert"
          className="bg-red-soft text-red border-red/20 text-subheadline rounded-md border p-3"
        >
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lease-unit" className="text-label">
            Unit
          </Label>
          <Select
            value={unitId}
            onValueChange={setUnitId}
            disabled={isSubmitting}
          >
            <SelectTrigger id="lease-unit">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  Unit {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.unitId && (
            <p className="text-footnote text-red">{fieldErrors.unitId}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lease-tenant" className="text-label">
            Tenant
          </Label>
          <Select
            value={tenantId}
            onValueChange={setTenantId}
            disabled={isSubmitting}
          >
            <SelectTrigger id="lease-tenant">
              <SelectValue placeholder="Select tenant" />
            </SelectTrigger>
            <SelectContent>
              {tenantOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.tenantId && (
            <p className="text-footnote text-red">{fieldErrors.tenantId}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lease-start" className="text-label">
            Start Date
          </Label>
          <Input
            id="lease-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isSubmitting}
          />
          {fieldErrors.startDate && (
            <p className="text-footnote text-red">{fieldErrors.startDate}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lease-end" className="text-label">
            End Date
          </Label>
          <Input
            id="lease-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isSubmitting}
          />
          {fieldErrors.endDate && (
            <p className="text-footnote text-red">{fieldErrors.endDate}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lease-rent" className="text-label">
            Monthly Rent (RM)
          </Label>
          <Input
            id="lease-rent"
            type="text"
            inputMode="decimal"
            placeholder="2,000.00"
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(e.target.value)}
            disabled={isSubmitting}
          />
          {fieldErrors.monthlyRent && (
            <p className="text-footnote text-red">{fieldErrors.monthlyRent}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lease-deposit" className="text-label">
            Deposit (RM)
          </Label>
          <Input
            id="lease-deposit"
            type="text"
            inputMode="decimal"
            placeholder="4,000.00"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            disabled={isSubmitting}
          />
          {fieldErrors.deposit && (
            <p className="text-footnote text-red">{fieldErrors.deposit}</p>
          )}
        </div>
      </div>

      {schedulePreview && (
        <div className="bg-muted/40 space-y-1.5 rounded-md border p-3">
          <p className="text-footnote text-label font-medium">
            Schedule Preview ({schedulePreview.length} invoices)
          </p>
          <p className="text-caption text-label-2">
            Deposit: {formatSen(schedulePreview[0]?.amountSen ?? 0)} · Rent
            periods: {schedulePreview.length - 1} months
          </p>
        </div>
      )}

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-tint text-on-tint hover:bg-tint/90"
          disabled={isSubmitting}
        >
          {isSubmitting && (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isSubmitting ? "Creating..." : "Create Lease"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CreateLeaseDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  isSubmitting,
  unitOptions,
  tenantOptions,
}: CreateLeaseDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        {isOpen && (
          <CreateLeaseForm
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            isSubmitting={isSubmitting}
            unitOptions={unitOptions}
            tenantOptions={tenantOptions}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
