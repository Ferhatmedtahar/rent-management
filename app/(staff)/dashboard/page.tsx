import type { Metadata } from "next";
import { DashboardPlaceholderContainer } from "@/modules/reports";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Collections and overdue summary for staff and managers",
};

export default function DashboardPage() {
  return <DashboardPlaceholderContainer />;
}
