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
import { parseRinggitToSen } from "@/lib/billing";
import { formatSen } from "@/shared/lib/format-money";
import {
  defaultMalaysiaNowInput,
  malaysiaInputToIso,
} from "@/shared/lib/format-datetime";
import { validateSlipFile } from "@/modules/payments";

type RecordPaymentDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  outstandingBalanceSen: number;
  onSubmit: (data: {
    amountSen: number;
    method: "cash" | "bank_transfer";
    receivedAt: string;
    slipFile?: File;
  }) => Promise<void>;
  isSubmitting: boolean;
};

type RecordPaymentFormProps = {
  outstandingBalanceSen: number;
  onSubmit: RecordPaymentDialogProps["onSubmit"];
  onCancel: () => void;
  isSubmitting: boolean;
};

function RecordPaymentForm({
  outstandingBalanceSen,
  onSubmit,
  onCancel,
  isSubmitting,
}: RecordPaymentFormProps) {
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<"cash" | "bank_transfer">("cash");
  const [receivedAt, setReceivedAt] = React.useState(() =>
    defaultMalaysiaNowInput(new Date()),
  );
  const [slipFile, setSlipFile] = React.useState<File | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{
    amount?: string;
    receivedAt?: string;
    slip?: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errors: typeof fieldErrors = {};

    // 1. Validate Amount
    let amountSen = 0;
    try {
      amountSen = parseRinggitToSen(amount);
      if (amountSen <= 0) {
        errors.amount = "Amount must be greater than zero.";
      } else if (amountSen > outstandingBalanceSen) {
        errors.amount = `Amount exceeds what is still owed (${formatSen(outstandingBalanceSen)}).`;
      }
    } catch {
      errors.amount = "Enter an amount like 1,500.00";
    }

    // 2. Validate Received Date
    let isoReceivedAt = "";
    try {
      isoReceivedAt = malaysiaInputToIso(receivedAt);
    } catch {
      errors.receivedAt = "Please enter a valid Malaysia date and time.";
    }

    // 3. Validate Slip for Bank Transfer
    if (method === "bank_transfer") {
      if (!slipFile) {
        errors.slip = "A bank transfer requires a payment slip.";
      } else {
        const validation = validateSlipFile(slipFile);
        if (!validation.valid) {
          errors.slip = validation.error;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      await onSubmit({
        amountSen,
        method,
        receivedAt: isoReceivedAt,
        slipFile:
          method === "bank_transfer" ? (slipFile ?? undefined) : undefined,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to record payment.";
      setFormError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-title-2 text-label">
          Record Payment
        </DialogTitle>
        <DialogDescription className="text-subheadline text-label-2">
          Record an offline payment. Outstanding balance is{" "}
          <span className="text-label tabular font-semibold">
            {formatSen(outstandingBalanceSen)}
          </span>
          .
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

      <div className="space-y-1.5">
        <Label htmlFor="payment-amount" className="text-label">
          Amount (RM)
        </Label>
        <Input
          id="payment-amount"
          type="text"
          inputMode="decimal"
          placeholder="1,500.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={Boolean(fieldErrors.amount)}
          aria-describedby={
            fieldErrors.amount ? "payment-amount-error" : undefined
          }
          disabled={isSubmitting}
        />
        {fieldErrors.amount && (
          <p id="payment-amount-error" className="text-footnote text-red">
            {fieldErrors.amount}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="payment-method" className="text-label">
          Payment Method
        </Label>
        <Select
          value={method}
          onValueChange={(val: "cash" | "bank_transfer") => setMethod(val)}
          disabled={isSubmitting}
        >
          <SelectTrigger id="payment-method">
            <SelectValue placeholder="Select method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="bank_transfer">Bank transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="payment-received" className="text-label">
          Received (Malaysia time)
        </Label>
        <Input
          id="payment-received"
          type="datetime-local"
          value={receivedAt}
          onChange={(e) => setReceivedAt(e.target.value)}
          aria-invalid={Boolean(fieldErrors.receivedAt)}
          aria-describedby={
            fieldErrors.receivedAt ? "payment-received-error" : undefined
          }
          disabled={isSubmitting}
        />
        {fieldErrors.receivedAt && (
          <p id="payment-received-error" className="text-footnote text-red">
            {fieldErrors.receivedAt}
          </p>
        )}
      </div>

      {method === "bank_transfer" && (
        <div className="space-y-1.5">
          <Label htmlFor="payment-slip" className="text-label">
            Payment Slip (JPEG, PNG, PDF · max 5 MB)
          </Label>
          <Input
            id="payment-slip"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setSlipFile(file);
            }}
            aria-invalid={Boolean(fieldErrors.slip)}
            aria-describedby={
              fieldErrors.slip ? "payment-slip-error" : undefined
            }
            disabled={isSubmitting}
          />
          {fieldErrors.slip && (
            <p id="payment-slip-error" className="text-footnote text-red">
              {fieldErrors.slip}
            </p>
          )}
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
          {isSubmitting ? "Recording..." : "Record Payment"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RecordPaymentDialog({
  isOpen,
  onOpenChange,
  outstandingBalanceSen,
  onSubmit,
  isSubmitting,
}: RecordPaymentDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {isOpen && (
          <RecordPaymentForm
            outstandingBalanceSen={outstandingBalanceSen}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            isSubmitting={isSubmitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
