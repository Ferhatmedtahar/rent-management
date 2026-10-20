import "server-only";

import { prisma } from "@/shared/db/prisma";
import type { ReportStore } from "../types/report.types";

export const reportStore: ReportStore = {
  // One range scan on the partial index (org_id, received_at) WHERE status = 'approved'.
  // Months are bounded by the service as +08:00 instants: no timezone cast in SQL.
  listPaymentsReceivedBetween: (orgId, start, endExclusive) =>
    prisma.payment.findMany({
      where: {
        orgId,
        status: "approved",
        receivedAt: { gte: start, lt: endExclusive },
      },
      select: { receivedAt: true, amountSen: true, status: true },
    }),
};
