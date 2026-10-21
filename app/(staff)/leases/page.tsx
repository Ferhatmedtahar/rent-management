import type { Metadata } from "next";
import { LeasesPlaceholderContainer } from "@/modules/leases";

export const metadata: Metadata = {
  title: "Leases",
  description: "View and manage all active and past property leases",
};

export default function LeasesPage() {
  return <LeasesPlaceholderContainer />;
}
