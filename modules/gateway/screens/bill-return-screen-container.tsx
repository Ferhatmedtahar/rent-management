"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useBill } from "../hooks/use-bill";
import { BillReturnScreen } from "./bill-return-screen";

/** Reads only `bill_id`. The `paid=` parameter is deliberately never read. */
function BillReturnContent() {
  const params = useSearchParams();
  const billId = params.get("bill_id");
  const { data, isPending, error, refetch } = useBill(billId);

  return (
    <BillReturnScreen
      billId={billId}
      bill={data}
      isLoading={billId !== null && isPending}
      errorMessage={error ? error.message : null}
      onRetry={() => void refetch()}
    />
  );
}

/** Container: wires hooks to the pure view. page.tsx renders exactly this. */
export function BillReturnScreenContainer() {
  return (
    <Suspense fallback={<p role="status">Checking your payment…</p>}>
      <BillReturnContent />
    </Suspense>
  );
}
