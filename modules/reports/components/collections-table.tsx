import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatSen } from "@/shared/lib/format-money";
import { formatMonthMyt } from "@/shared/lib/format-datetime";
import type { MonthlyCollection } from "../types/reports-api.types";

type CollectionsTableProps = {
  collections: MonthlyCollection[];
};

export function CollectionsTable({ collections }: CollectionsTableProps) {
  let totalSen = 0;
  for (const item of collections) {
    totalSen += item.collectedSen;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-title-2 text-label">
          Collections (Last 6 Months)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {collections.length === 0 ? (
          <div className="text-subheadline text-label-2 py-8 text-center">
            Nothing collected yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Collected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.map((item) => (
                <TableRow key={item.month}>
                  <TableCell className="text-label font-medium">
                    {formatMonthMyt(item.month)}
                  </TableCell>
                  <TableCell className="text-label tabular text-right font-medium">
                    {formatSen(item.collectedSen)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="font-semibold">
                <TableCell className="text-label">Total</TableCell>
                <TableCell className="text-label tabular text-right">
                  {formatSen(totalSen)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
