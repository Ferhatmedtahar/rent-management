import type { Metadata } from "next";
import { LeaseDetailScreenContainer } from "@/modules/leases";

export const metadata: Metadata = {
  title: "Lease Details | Rent Collection",
  description: "View lease invoices, payments, and balances.",
  robots: { index: false },
};

type Props = {
  params: Promise<{ leaseId: string }>;
};

export default async function LeaseDetailPage({ params }: Props) {
  const { leaseId } = await params;
  return <LeaseDetailScreenContainer leaseId={leaseId} />;
}
