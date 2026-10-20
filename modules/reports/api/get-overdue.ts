import { authenticate } from "@/modules/auth/api/guards";
import { requireRole } from "@/modules/auth/api/policy";
import { json, withErrorHandling } from "@/shared/lib/api-response";
import { reportStore } from "../repositories/report.repository";
import { getOverdueReport } from "../services/report.service";

/** GET /api/reports/overdue. Staff and managers. */
export const GET = withErrorHandling(async (request: Request) => {
  const actor = await authenticate(request);
  requireRole(actor, ["manager", "staff"]);
  const report = await getOverdueReport(reportStore, actor, new Date());
  return json(report);
});
