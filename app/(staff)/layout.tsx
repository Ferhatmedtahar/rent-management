import type { Metadata } from "next";
import { StaffShell } from "@/shared/components";

export const metadata: Metadata = {
  robots: { index: false },
};

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StaffShell>{children}</StaffShell>;
}
