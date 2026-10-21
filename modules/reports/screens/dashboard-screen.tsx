import { OverdueStatCard } from "../components/overdue-stat-card";
import { CollectionsTable } from "../components/collections-table";
import type { MonthlyCollection } from "../types/reports-api.types";

type DashboardScreenProps = {
  overdueCount: number;
  collections: MonthlyCollection[];
};

export function DashboardScreen({
  overdueCount,
  collections,
}: DashboardScreenProps) {
  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-large-title text-label">Dashboard</h1>
        <p className="text-subheadline text-label-2 mt-1">
          Collections overview and overdue invoices for your organization.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <OverdueStatCard overdueCount={overdueCount} />
        </div>

        <div className="md:col-span-2">
          <CollectionsTable collections={collections} />
        </div>
      </div>
    </div>
  );
}
