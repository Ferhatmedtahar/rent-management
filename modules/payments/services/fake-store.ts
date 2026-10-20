/**
 * In-memory PaymentStore for unit tests (no database). Faithful where it
 * matters: transactions are copy-on-write (a throw discards every write) and
 * serialized through one queue, modelling the lease row lock; transitions are
 * status-guarded like the real UPDATE.
 */
import type {
  AllocatableInvoice,
  AllocationRow,
  AuditEntry,
  NewPayment,
  PaymentDeps,
  PaymentStatus,
  PaymentTx,
} from "../types/payment.types";

export const ORG_A = "11111111-1111-4111-8111-111111111111";
export const ORG_B = "22222222-2222-4222-8222-222222222222";
export const LEASE = "cccccccc-0000-4000-8000-000000000001";
export const TENANT_ROW = "dddddddd-0000-4000-8000-000000000001";

export type FakePayment = Omit<
  NewPayment,
  "status" | "method" | "recordedBy" | "reviewedBy"
> & {
  id: string;
  method: NewPayment["method"] | "online";
  recordedBy: string | null;
  reviewedBy: string | null;
  status: PaymentStatus;
  rejectReason?: string;
  voidedBy?: string;
  voidReason?: string;
};

export type FakeDb = {
  invoices: AllocatableInvoice[];
  payments: FakePayment[];
  allocations: (AllocationRow & { paymentId: string })[];
  audits: AuditEntry[];
};

// Aisyah: deposit 300000 + 5 x 150000 + 77419 = 1,127,419
export const aisyahInvoices = (): AllocatableInvoice[] => [
  {
    id: "DEP",
    kind: "deposit",
    periodIndex: null,
    dueDate: "2026-01-31",
    amountSen: 300000,
    allocatedSen: 0,
  },
  {
    id: "P0",
    kind: "rent",
    periodIndex: 0,
    dueDate: "2026-01-31",
    amountSen: 150000,
    allocatedSen: 0,
  },
  {
    id: "P1",
    kind: "rent",
    periodIndex: 1,
    dueDate: "2026-02-28",
    amountSen: 150000,
    allocatedSen: 0,
  },
  {
    id: "P2",
    kind: "rent",
    periodIndex: 2,
    dueDate: "2026-03-31",
    amountSen: 150000,
    allocatedSen: 0,
  },
  {
    id: "P3",
    kind: "rent",
    periodIndex: 3,
    dueDate: "2026-04-30",
    amountSen: 150000,
    allocatedSen: 0,
  },
  {
    id: "P4",
    kind: "rent",
    periodIndex: 4,
    dueDate: "2026-05-31",
    amountSen: 150000,
    allocatedSen: 0,
  },
  {
    id: "P5",
    kind: "rent",
    periodIndex: 5,
    dueDate: "2026-06-30",
    amountSen: 77419,
    allocatedSen: 0,
  },
];
export const TOTAL = 1_127_419;

export type FakeOptions = {
  invoices?: AllocatableInvoice[];
  seedPayments?: FakePayment[];
  seedAllocations?: FakeDb["allocations"];
  failAt?: "insert" | "audit" | "transition";
  slipExists?: boolean;
  slipReferenced?: boolean;
};

export function setup(options: FakeOptions = {}) {
  const db: FakeDb = {
    invoices: options.invoices ?? aisyahInvoices(),
    payments: options.seedPayments ? structuredClone(options.seedPayments) : [],
    allocations: options.seedAllocations
      ? structuredClone(options.seedAllocations)
      : [],
    audits: [],
  };
  const calls = {
    removed: [] as string[],
    exists: [] as string[],
    order: [] as string[],
  };
  let queue: Promise<unknown> = Promise.resolve();

  const tx = (draft: FakeDb): PaymentTx => ({
    lockLease: async (leaseId, orgId) => {
      calls.order.push("lock");
      return leaseId === LEASE && orgId === ORG_A;
    },
    leaseBalance: async () => {
      calls.order.push("balance");
      return {
        invoicedSen: draft.invoices.reduce((s, i) => s + i.amountSen, 0),
        allocatedSen: draft.allocations.reduce((s, a) => s + a.amountSen, 0),
        pendingSen: draft.payments
          .filter((p) => p.status === "pending_verification")
          .reduce((s, p) => s + p.amountSen, 0),
      };
    },
    listInvoicesForAllocation: async () =>
      draft.invoices.map((i) => ({
        ...i,
        allocatedSen: draft.allocations
          .filter((a) => a.invoiceId === i.id)
          .reduce((s, a) => s + a.amountSen, 0),
      })),
    insertPayment: async (p) => {
      if (options.failAt === "insert") throw new Error("boom insert");
      const row: FakePayment = {
        ...p,
        id: `ffffffff-0000-4000-8000-${String(draft.payments.length + 100).padStart(12, "0")}`,
      };
      draft.payments.push(row);
      return { id: row.id };
    },
    insertAllocations: async (_o, _l, paymentId, rows) => {
      draft.allocations.push(...rows.map((r) => ({ ...r, paymentId })));
    },
    insertAudit: async (e) => {
      if (options.failAt === "audit") throw new Error("boom audit");
      draft.audits.push(e);
    },
    getPayment: async (id) => {
      calls.order.push("getPayment");
      const p = draft.payments.find((row) => row.id === id);
      return p
        ? {
            id: p.id,
            leaseId: p.leaseId,
            amountSen: p.amountSen,
            unappliedSen: p.unappliedSen,
            status: p.status,
          }
        : null;
    },
    transitionPayment: async (id, from, patch) => {
      if (options.failAt === "transition") throw new Error("boom transition");
      const p = draft.payments.find(
        (row) => row.id === id && row.status === from,
      );
      if (!p) return false;
      p.status = patch.status;
      if (patch.reviewedBy !== undefined) p.reviewedBy = patch.reviewedBy;
      if (patch.reviewedAt !== undefined) p.reviewedAt = patch.reviewedAt;
      if (patch.rejectReason !== undefined) p.rejectReason = patch.rejectReason;
      if (patch.voidedBy !== undefined) p.voidedBy = patch.voidedBy;
      if (patch.voidReason !== undefined) p.voidReason = patch.voidReason;
      if (patch.unappliedSen !== undefined) p.unappliedSen = patch.unappliedSen;
      return true;
    },
    listAllocations: async (id) =>
      draft.allocations
        .filter((a) => a.paymentId === id)
        .map(({ invoiceId, amountSen }) => ({ invoiceId, amountSen })),
    deleteAllocations: async (id) => {
      draft.allocations = draft.allocations.filter((a) => a.paymentId !== id);
    },
  });

  const deps: PaymentDeps = {
    store: {
      findLeaseInOrg: async (id, orgId) =>
        id === LEASE && orgId === ORG_A ? { id, tenantId: TENANT_ROW } : null,
      findPaymentInOrg: async (id, orgId) =>
        orgId === ORG_A && db.payments.some((p) => p.id === id)
          ? { id, leaseId: LEASE, leaseTenantId: TENANT_ROW }
          : null,
      isSlipReferenced: async () => options.slipReferenced ?? false,
      transaction: (work) => {
        // One at a time, like the lease row lock. Copy-on-write: a throw discards everything.
        const run = async () => {
          const draft = structuredClone(db);
          const result = await work(tx(draft));
          db.invoices = draft.invoices;
          db.payments = draft.payments;
          db.allocations = draft.allocations;
          db.audits = draft.audits;
          return result;
        };
        const next = queue.then(run, run);
        queue = next.catch(() => undefined);
        return next;
      },
    },
    slips: {
      exists: async (path) => {
        calls.exists.push(path);
        return options.slipExists ?? true;
      },
      remove: async (path) => {
        calls.removed.push(path);
      },
    },
  };
  return { deps, db, calls };
}
