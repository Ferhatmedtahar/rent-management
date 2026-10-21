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
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { formatSen } from "@/shared/lib/format-money";

type VoidPaymentDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  amountSen: number;
  onConfirm: (reason: string) => Promise<void>;
  isSubmitting: boolean;
};

type VoidPaymentFormProps = {
  amountSen: number;
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
};

function VoidPaymentForm({
  amountSen,
  onConfirm,
  onCancel,
  isSubmitting,
}: VoidPaymentFormProps) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError("Please provide a reason of at least 5 characters.");
      return;
    }
    setError(null);
    await onConfirm(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-title-2 text-label">
          Void Payment
        </DialogTitle>
        <DialogDescription className="text-subheadline text-label-2">
          Voiding this payment of{" "}
          <span className="text-label tabular font-semibold">
            {formatSen(amountSen)}
          </span>{" "}
          will reverse its allocations and restore the invoice balances. A
          reason is required for the audit log.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="void-reason" className="text-label">
          Reason for voiding
        </Label>
        <Textarea
          id="void-reason"
          placeholder="e.g. Bank bounced payment check"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (error && e.target.value.trim().length >= 5) {
              setError(null);
            }
          }}
          rows={3}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "void-reason-error" : undefined}
          disabled={isSubmitting}
        />
        {error && (
          <p id="void-reason-error" className="text-footnote text-red">
            {error}
          </p>
        )}
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" variant="destructive" disabled={isSubmitting}>
          {isSubmitting && (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isSubmitting ? "Voiding..." : "Void Payment"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function VoidPaymentDialog({
  isOpen,
  onOpenChange,
  amountSen,
  onConfirm,
  isSubmitting,
}: VoidPaymentDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        {isOpen && (
          <VoidPaymentForm
            amountSen={amountSen}
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
            isSubmitting={isSubmitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
