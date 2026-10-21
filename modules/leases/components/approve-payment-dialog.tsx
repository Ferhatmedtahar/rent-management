"use client";

import { Loader2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { formatSen } from "@/shared/lib/format-money";

type ApprovePaymentDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  amountSen: number;
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
};

export function ApprovePaymentDialog({
  isOpen,
  onOpenChange,
  amountSen,
  onConfirm,
  isSubmitting,
}: ApprovePaymentDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-title-2 text-label">
            Approve Payment?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-subheadline text-label-2">
            Are you sure you want to approve this payment of{" "}
            <span className="text-label tabular font-semibold">
              {formatSen(amountSen)}
            </span>
            ? This will apply allocations to the oldest unpaid invoices.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            disabled={isSubmitting}
            className="bg-tint text-on-tint hover:bg-tint/90"
          >
            {isSubmitting && (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isSubmitting ? "Approving..." : "Approve Payment"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
