import type { Metadata } from "next";
import { TenantPortalScreenContainer } from "@/modules/portal";

export const metadata: Metadata = {
  title: "Tenant Portal | Rent Collection",
  description: "View rent invoices, payment history, and pay online.",
  robots: { index: false },
};

export default function TenantPortalPage() {
  return <TenantPortalScreenContainer />;
}
