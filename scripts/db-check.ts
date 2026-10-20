/**
 * Smoke check for the database connection and the Prisma schema.
 * Run with: pnpm db:check   (needs the local Supabase stack and migrations applied)
 *
 * Runs `select 1`, then counts every table through the real Prisma client from
 * shared/db/prisma.ts (same adapter and DATABASE_URL as the app). Prints counts
 * only: no secrets, no row data. Read-only.
 */
import { config } from "dotenv";

// Same files Next.js uses. Loaded before the app's env module is imported.
config({ path: ".env.local" });
config({ path: ".env" });

async function main(): Promise<void> {
  const { prisma } = await import("@/shared/db/prisma");

  try {
    const ping = await prisma.$queryRaw<{ ok: number }[]>`select 1 as ok`;
    console.log(`select 1 -> ${ping[0]?.ok ?? "no result"}`);

    const counts = {
      organizations: await prisma.organization.count(),
      memberships: await prisma.membership.count(),
      units: await prisma.unit.count(),
      tenants: await prisma.tenant.count(),
      leases: await prisma.lease.count(),
      invoices: await prisma.invoice.count(),
      payments: await prisma.payment.count(),
      payment_allocations: await prisma.paymentAllocation.count(),
      gateway_bills: await prisma.gatewayBill.count(),
      audit_log: await prisma.auditLog.count(),
    };
    console.table(counts);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    "db:check failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
