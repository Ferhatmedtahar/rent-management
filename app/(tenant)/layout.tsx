import type { Metadata } from "next";
import { TenantShell } from "@/shared/components";

export const metadata: Metadata = {
  robots: { index: false },
};

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TenantShell>{children}</TenantShell>;
}
