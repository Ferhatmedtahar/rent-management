"use client";

import * as React from "react";
import Link from "next/link";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { formatSen } from "@/shared/lib/format-money";

type PayNowDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  bill: { billId: string; amountSen: number } | null;
};

export function PayNowDialog({
  isOpen,
  onOpenChange,
  bill,
}: PayNowDialogProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!bill) return;
    try {
      await navigator.clipboard.writeText(bill.billId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  if (!bill) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-title-2 text-label">
            Payment Bill Created
          </DialogTitle>
          <DialogDescription className="text-subheadline text-label-2">
            A gateway bill of{" "}
            <span className="text-label tabular font-semibold">
              {formatSen(bill.amountSen)}
            </span>{" "}
            was generated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <p className="text-footnote text-label-2 font-medium">
              Bill Reference ID
            </p>
            <div className="bg-inset border-outline flex items-center gap-2 rounded-lg border p-2.5">
              <span className="text-footnote text-label flex-1 font-mono break-all select-all">
                {bill.billId}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 shrink-0 gap-1.5 px-2"
              >
                {copied ? (
                  <>
                    <CheckIcon className="text-green h-3.5 w-3.5" />
                    <span className="text-footnote text-green">Copied</span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="h-3.5 w-3.5" />
                    <span className="text-footnote">Copy</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 border-outline text-subheadline text-label-2 space-y-1 rounded-lg border p-3.5">
            <p className="text-label text-footnote font-medium">
              Simulator Notice
            </p>
            <p className="text-caption">
              In production, you would be redirected to the online payment
              gateway. For this test assessment, complete payment using the
              provided gateway simulator script:
            </p>
            <pre className="text-caption bg-inset border-outline mt-1.5 overflow-x-auto rounded border p-2 font-mono">
              node gateway-sim.mjs {bill.billId} {bill.amountSen}
            </pre>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            asChild
            className="bg-tint text-on-tint hover:bg-tint/90 gap-1.5"
          >
            <Link
              href={`/payments/return?bill_id=${encodeURIComponent(bill.billId)}`}
            >
              <span>Check payment status</span>
              <ExternalLinkIcon className="h-4 w-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
