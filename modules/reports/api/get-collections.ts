import { authenticate } from "@/modules/auth/api/guards";
import { json, withErrorHandling } from "@/shared/lib/api-response";
import { reportStore } from "../repositories/report.repository";
import { getCollections } from "../services/report.service";

/** GET /api/reports/collections?from=YYYY-MM&to=YYYY-MM. Staff and managers. */
export const GET = withErrorHandling(async (request: Request) => {
  const actor = await authenticate(request);
  const params = new URL(request.url).searchParams;
  const rows = await getCollections(reportStore, actor, {
    from: params.getAll("from"),
    to: params.getAll("to"),
  });
  return json(rows);
});
