import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { StatusBadge, LoadingState, ErrorState } from "@/shared/components";
import { formatSen } from "@/shared/lib/format-money";
import type { BillView } from "../types/gateway.types";

type BillReturnScreenProps = {
  billId: string | null;
  bill: BillView | undefined;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
};

const STATUS_INFO: Record<
  BillView["status"],
  { title: string; detail: string }
> = {
  paid: {
    title: "Payment Received",
    detail:
      "The payment gateway has confirmed this payment and it has been applied to your lease invoices.",
  },
  pending: {
    title: "Waiting for Confirmation",
    detail:
      "Waiting for the payment gateway... This page updates automatically once confirmed.",
  },
  failed: {
    title: "Payment Failed",
    detail:
      "The payment gateway reported that this payment failed. Please return to the portal and try again.",
  },
};

export function BillReturnScreen({
  billId,
  bill,
  isLoading,
  errorMessage,
  onRetry,
}: BillReturnScreenProps) {
  if (billId === null) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-title-2 text-label">
              No Bill Specified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-subheadline text-label-2">
              This page requires a valid bill reference. Return to the tenant
              portal to make an online payment.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              asChild
              className="bg-tint text-on-tint hover:bg-tint/90 w-full"
            >
              <Link href="/portal">Back to Tenant Portal</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <LoadingState label="Checking payment status..." />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <ErrorState
              title="Could not check payment"
              message={errorMessage}
              onRetry={onRetry}
            />
          </CardContent>
          <CardFooter className="pt-0">
            <Button asChild variant="outline" className="w-full">
              <Link href="/portal">Back to Tenant Portal</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-title-2 text-label">
              Bill Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-subheadline text-label-2">
              No details were found for bill{" "}
              <span className="text-label font-mono break-all">{billId}</span>.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              asChild
              className="bg-tint text-on-tint hover:bg-tint/90 w-full"
            >
              <Link href="/portal">Back to Tenant Portal</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const info = STATUS_INFO[bill.status];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-footnote text-label-2 font-medium">
              Payment Gateway
            </span>
            <StatusBadge status={bill.status} />
          </div>
          <CardTitle className="text-title-2 text-label">
            {info.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-subheadline text-label-2">{info.detail}</p>

          <div className="bg-inset text-subheadline border-outline space-y-2 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-label-2">Amount</span>
              <span className="text-label tabular font-semibold">
                {formatSen(bill.amountSen)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-label-2">Bill ID</span>
              <span className="text-footnote text-label font-mono select-all">
                {bill.billId}
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild variant="outline" className="w-full gap-2">
            <Link href="/portal">
              <ArrowLeftIcon className="h-4 w-4" />
              <span>Back to Tenant Portal</span>
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
