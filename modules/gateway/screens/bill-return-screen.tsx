import { formatSen } from "@/shared/lib/format-money";
import type { BillView } from "../types/gateway.types";

type BillReturnScreenProps = {
  billId: string | null;
  bill: BillView | undefined;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
};

const STATUS_TEXT: Record<
  BillView["status"],
  { title: string; detail: string }
> = {
  paid: {
    title: "Payment received",
    detail:
      "The payment gateway confirmed this payment and it has been recorded.",
  },
  pending: {
    title: "Waiting for confirmation",
    detail:
      "We have not heard from the payment gateway yet. This page updates by itself.",
  },
  failed: {
    title: "Payment not completed",
    detail:
      "The payment gateway reported that this payment failed. You can try again.",
  },
};

/**
 * Pure view: props in, markup out. It shows the bill's status as stored in our
 * database. It never reads the `paid=` value the gateway appends to the return
 * URL, and nothing here can settle a bill.
 */
export function BillReturnScreen({
  billId,
  bill,
  isLoading,
  errorMessage,
  onRetry,
}: BillReturnScreenProps) {
  if (billId === null) {
    return (
      <main className="mx-auto w-full max-w-lg p-6">
        <h1 className="text-xl font-semibold">No bill to show</h1>
        <p className="mt-2">
          This page needs a bill reference. Go back to your lease and use Pay
          now.
        </p>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-lg p-6">
        <p role="status">Checking your payment…</p>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="mx-auto w-full max-w-lg p-6">
        <div role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={onRetry} className="mt-3 underline">
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!bill) {
    return (
      <main className="mx-auto w-full max-w-lg p-6">
        <p>No details are available for this bill yet.</p>
        <button type="button" onClick={onRetry} className="mt-3 underline">
          Check now
        </button>
      </main>
    );
  }

  const text = STATUS_TEXT[bill.status];
  return (
    <main className="mx-auto w-full max-w-lg p-6">
      <h1 className="text-xl font-semibold">{text.title}</h1>
      <p className="mt-2">{text.detail}</p>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt>Amount</dt>
        <dd className="tabular-nums">{formatSen(bill.amountSen)}</dd>
        <dt>Status</dt>
        <dd>{bill.status}</dd>
        <dt>Bill</dt>
        <dd className="font-mono text-sm break-all">{bill.billId}</dd>
      </dl>
    </main>
  );
}
