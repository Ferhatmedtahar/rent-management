import type { Metadata } from "next";
import { DashboardScreenContainer } from "@/modules/reports";

export const metadata: Metadata = {
  title: "Dashboard | Rent Collection",
  description: "Staff and manager dashboard (collections and overdue reports)",
  robots: { index: false },
};

export default function DashboardPage() {
  return <DashboardScreenContainer />;
}
