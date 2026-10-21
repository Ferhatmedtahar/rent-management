import type { Metadata } from "next";
import { PortalPlaceholderContainer } from "@/modules/auth";

export const metadata: Metadata = {
  title: "Tenant Portal",
  description: "View your lease, billing periods, and payment records",
};

export default function PortalPage() {
  return <PortalPlaceholderContainer />;
}
