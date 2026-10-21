import Link from "next/link";
import { AlertTriangleIcon, ArrowRightIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

type OverdueStatCardProps = {
  overdueCount: number;
};

export function OverdueStatCard({ overdueCount }: OverdueStatCardProps) {
  const isOverdue = overdueCount > 0;

  return (
    <Card className={isOverdue ? "border-red/30 bg-red-soft/20" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-title-2 text-label">
          Overdue Invoices
        </CardTitle>
        {isOverdue && (
          <AlertTriangleIcon className="text-red h-5 w-5" aria-hidden="true" />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p
            className={`text-large-title tabular font-bold ${
              isOverdue ? "text-red" : "text-label"
            }`}
          >
            {overdueCount}
          </p>
          <p className="text-footnote text-label-2 mt-1">
            {isOverdue
              ? `${overdueCount} invoice${overdueCount === 1 ? "" : "s"} past due in Malaysia time`
              : "All invoices are fully paid or up to date"}
          </p>
        </div>

        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/leases">
            <span>View leases</span>
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
