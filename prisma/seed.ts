/**
 * Seed: the NON-domain part. Run with `pnpm seed` (or `npm run seed`) on a
 * freshly reset database.
 *
 * Creates organizations, the 7 auth users, memberships, tenants and units.
 * Leases (and their invoices) go through the SAME createLease service the API
 * uses, so the seeded data is exactly what the app produces. NO payments yet.
 *
 * Order matters. Auth users come first (the Auth admin API cannot join a
 * database transaction); every domain row is then written in ONE Prisma
 * transaction. So a failure while creating users leaves zero domain rows, and a
 * failed transaction leaves zero domain rows too. In both cases some auth users
 * may exist: the script says so, and `npx supabase db reset` cleans everything.
 *
 * Never prints the password or any key.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Actor } from "@/modules/auth";

// Same files Next.js uses. Loaded before the app's env module is imported.
config({ path: ".env.local" });
config({ path: ".env" });

type OrgKey = "northwind" | "beta";

type Account =
  | {
      email: string;
      org: OrgKey;
      kind: "membership";
      role: "manager" | "staff";
    }
  | { email: string; org: OrgKey; kind: "tenant"; fullName: string };

const ORGANIZATIONS: Record<OrgKey, string> = {
  northwind: "Northwind Properties",
  beta: "Beta Realty",
};

const ACCOUNTS: Account[] = [
  {
    email: "manager@northwind.test",
    org: "northwind",
    kind: "membership",
    role: "manager",
  },
  {
    email: "staff@northwind.test",
    org: "northwind",
    kind: "membership",
    role: "staff",
  },
  {
    email: "aisyah@northwind.test",
    org: "northwind",
    kind: "tenant",
    fullName: "Aisyah Rahman",
  },
  {
    email: "ben@northwind.test",
    org: "northwind",
    kind: "tenant",
    fullName: "Ben Lim",
  },
  {
    email: "probe@northwind.test",
    org: "northwind",
    kind: "tenant",
    fullName: "Probe Tenant",
  },
  {
    email: "manager@beta.test",
    org: "beta",
    kind: "membership",
    role: "manager",
  },
  {
    email: "chen@beta.test",
    org: "beta",
    kind: "tenant",
    fullName: "Chen Wei",
  },
];

const UNITS: Record<OrgKey, string[]> = {
  northwind: ["A-12-3", "B-05-1", "C-01-7", "D-03-2"],
  beta: ["KL-1"],
};

const RESET_HINT = "Run `npx supabase db reset`, then `pnpm seed` again.";

class SeedError extends Error {}

async function main(): Promise<void> {
  const { env } = await import("@/env");
  const { prisma } = await import("@/shared/db/prisma");
  const { createAdminClient } = await import("@/shared/supabase/admin");
  const { createLease } =
    await import("@/modules/leases/services/lease.service");
  const { leaseStore } =
    await import("@/modules/leases/repositories/lease.repository");

  try {
    const password = env.SEED_PASSWORD;
    if (!password) {
      throw new SeedError(
        "SEED_PASSWORD is not set. Add it to .env.local (see .env.example).",
      );
    }

    // 1. Empty database only. Nothing has been written yet.
    if ((await prisma.organization.count()) > 0) {
      throw new SeedError("database not empty, run npx supabase db reset");
    }

    // 2. Auth users (admin API, outside the transaction).
    const admin = createAdminClient();
    const userIds = new Map<string, string>();
    for (const account of ACCOUNTS) {
      const { data, error } = await admin.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) {
        const created = [...userIds.keys()];
        throw new SeedError(
          `creating ${account.email} failed: ${error?.message ?? "no user returned"}\n` +
            `Auth users that exist now: ${created.length ? created.join(", ") : "none"}.\n` +
            RESET_HINT,
        );
      }
      userIds.set(account.email, data.user.id);
      console.log(`created auth user ${account.email}`);
    }

    // 3. Every domain row in ONE transaction: all or nothing.
    try {
      await prisma.$transaction(async (tx) => {
        const orgIds = {} as Record<OrgKey, string>;
        for (const key of Object.keys(ORGANIZATIONS) as OrgKey[]) {
          const org = await tx.organization.create({
            data: { name: ORGANIZATIONS[key] },
          });
          orgIds[key] = org.id;
        }

        const userId = (email: string): string => {
          const id = userIds.get(email);
          if (!id) throw new SeedError(`no auth user id for ${email}`);
          return id;
        };

        await tx.membership.createMany({
          data: ACCOUNTS.flatMap((account) =>
            account.kind === "membership"
              ? [
                  {
                    userId: userId(account.email),
                    orgId: orgIds[account.org],
                    role: account.role,
                  },
                ]
              : [],
          ),
        });

        await tx.tenant.createMany({
          data: ACCOUNTS.flatMap((account) =>
            account.kind === "tenant"
              ? [
                  {
                    orgId: orgIds[account.org],
                    userId: userId(account.email),
                    fullName: account.fullName,
                    email: account.email,
                    phone: null,
                  },
                ]
              : [],
          ),
        });

        await tx.unit.createMany({
          data: (Object.keys(UNITS) as OrgKey[]).flatMap((key) =>
            UNITS[key].map((name) => ({ orgId: orgIds[key], name })),
          ),
        });
      });
    } catch (error) {
      throw new SeedError(
        `writing the domain rows failed (nothing was written): ${errorMessage(error)}\n` +
          `The ${ACCOUNTS.length} auth users above DO exist now. ${RESET_HINT}`,
      );
    }
    console.log("created organizations, memberships, tenants and units");

    // 3b. Leases of the brief (section 2), through the SAME service the API uses,
    // acting as each organization's manager. Invoices come from generateSchedule.
    const managerOf = async (email: string): Promise<Actor> => {
      const membership = await prisma.membership.findUniqueOrThrow({
        where: { userId: userIds.get(email) ?? "" },
      });
      return {
        userId: membership.userId,
        orgId: membership.orgId,
        role: membership.role,
      };
    };
    const northwindManager = await managerOf("manager@northwind.test");
    const betaManager = await managerOf("manager@beta.test");
    const leasePlans = [
      {
        who: northwindManager,
        unit: "A-12-3",
        tenant: "Aisyah Rahman",
        startDate: "2026-01-31",
        endDate: "2026-07-15",
        monthlyRentSen: 150000,
        depositSen: 300000,
        expected: 7,
        lastRent: 77419,
      },
      {
        who: northwindManager,
        unit: "B-05-1",
        tenant: "Ben Lim",
        startDate: "2026-01-01",
        endDate: "2026-04-15",
        monthlyRentSen: 100029,
        depositSen: 0,
        expected: 4,
        lastRent: 50015,
      },
      {
        who: northwindManager,
        unit: "C-01-7",
        tenant: "Probe Tenant",
        startDate: "2026-02-28",
        endDate: "2027-02-27",
        monthlyRentSen: 200000,
        depositSen: 400000,
        expected: 13,
        lastRent: 200000,
      },
      {
        who: betaManager,
        unit: "KL-1",
        tenant: "Chen Wei",
        startDate: "2026-03-15",
        endDate: "2027-03-14",
        monthlyRentSen: 220000,
        depositSen: 440000,
        expected: 13,
        lastRent: 220000,
      },
    ];
    let totalInvoices = 0;
    for (const plan of leasePlans) {
      const unit = await prisma.unit.findFirstOrThrow({
        where: { orgId: plan.who.orgId, name: plan.unit },
      });
      const tenant = await prisma.tenant.findFirstOrThrow({
        where: { orgId: plan.who.orgId, fullName: plan.tenant },
      });
      const { id } = await createLease(leaseStore, plan.who, {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: plan.startDate,
        endDate: plan.endDate,
        monthlyRentSen: plan.monthlyRentSen,
        depositSen: plan.depositSen,
      });
      const count = await prisma.invoice.count({ where: { leaseId: id } });
      const last = await prisma.invoice.findFirstOrThrow({
        where: { leaseId: id, kind: "rent" },
        orderBy: { periodIndex: "desc" },
      });
      totalInvoices += count;
      const ok =
        count === plan.expected && Number(last.amountSen) === plan.lastRent;
      console.log(
        `${ok ? "OK  " : "FAIL"} lease ${plan.unit} ${plan.tenant}: ${count} invoices (expected ${plan.expected}), last rent ${last.amountSen} sen (expected ${plan.lastRent})`,
      );
      if (!ok)
        throw new SeedError(
          `lease ${plan.unit} does not match the brief. ${RESET_HINT}`,
        );
    }
    console.log(`total invoices: ${totalInvoices} (expected 37)`);
    if (totalInvoices !== 37)
      throw new SeedError(
        `invoice total ${totalInvoices} != 37. ${RESET_HINT}`,
      );

    // 4. Verify: every account can sign in with the PUBLISHABLE key.
    const publicClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    let failures = 0;
    for (const account of ACCOUNTS) {
      const { data, error } = await publicClient.auth.signInWithPassword({
        email: account.email,
        password,
      });
      const ok = !error && Boolean(data.session);
      if (!ok) failures += 1;
      console.log(`${ok ? "OK  " : "FAIL"} sign-in ${account.email}`);
      if (ok) await publicClient.auth.signOut();
    }

    console.table({
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
    });

    if (failures > 0) {
      throw new SeedError(`${failures} sign-in check(s) failed. ${RESET_HINT}`);
    }
    console.log("seed (non-domain part) done");
  } finally {
    await prisma.$disconnect();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(
    error instanceof SeedError
      ? error.message
      : `seed failed: ${errorMessage(error)}`,
  );
  process.exitCode = 1;
});
