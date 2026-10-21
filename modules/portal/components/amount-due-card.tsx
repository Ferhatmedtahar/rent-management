"use client";

import { CreditCardIcon, Loader2Icon, CheckCircle2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { formatSen } from "@/shared/lib/format-money";

type AmountDueCardProps = {
  amountDueSen: number;
  onPayNow: () => void;
  isCreatingBill: boolean;
};

export function AmountDueCard({
  amountDueSen,
  onPayNow,
  isCreatingBill,
}: AmountDueCardProps) {
  const isDue = amountDueSen > 0;

  return (
    <Card className={isDue ? "border-tint/40 bg-tint-fill/30" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-title-2 text-label">
          Amount Due Now
        </CardTitle>
        {isDue ? (
          <CreditCardIcon className="text-tint h-5 w-5" aria-hidden="true" />
        ) : (
          <CheckCircle2Icon className="text-green h-5 w-5" aria-hidden="true" />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p
            className={`text-large-title tabular font-bold ${
              isDue ? "text-tint" : "text-label"
            }`}
          >
            {formatSen(amountDueSen)}
          </p>
          <p className="text-footnote text-label-2 mt-1">
            {isDue
              ? "Unpaid invoices due on or before today in Malaysia time."
              : "You are completely up to date! No payments due right now."}
          </p>
        </div>

        <Button
          onClick={onPayNow}
          disabled={!isDue || isCreatingBill}
          className="bg-tint text-on-tint hover:bg-tint/90 w-full font-medium"
        >
          {isCreatingBill && (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isCreatingBill
            ? "Creating Payment Bill..."
            : isDue
              ? `Pay Now · ${formatSen(amountDueSen)}`
              : "Nothing Due"}
        </Button>
      </CardContent>
    </Card>
  );
}
