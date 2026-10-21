import type { Metadata } from "next";
import { LeasesScreenContainer } from "@/modules/leases";

export const metadata: Metadata = {
  title: "Leases | Rent Collection",
  description: "View and manage property leases, tenants, and units",
  robots: { index: false },
};

export default function LeasesPage() {
  return <LeasesScreenContainer />;
}
