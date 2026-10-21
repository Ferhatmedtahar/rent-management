/** An invoice as the allocation sees it. dueDate is YYYY-MM-DD. */
export type AllocatableInvoice = {
  id: string;
  kind: "deposit" | "rent";
  periodIndex: number | null;
  dueDate: string;
  amountSen: number;
  /** Already allocated by this lease's other approved payments. */
  allocatedSen: number;
};

export type AllocationRow = { invoiceId: string; amountSen: number };

/**
 * Allocation order of ASSESSMENT.md section 4: due date, then deposit before
 * rent, then period index. Pure: data in, data out. Integer sen only.
 */
const KIND_ORDER = { deposit: 0, rent: 1 } as const;

function compareInvoices(a: AllocatableInvoice, b: AllocatableInvoice): number {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  return (a.periodIndex ?? -1) - (b.periodIndex ?? -1);
}

/**
 * Fills each invoice up to its unpaid amount before moving to the next,
 * including invoices not yet due. Whatever is left once everything is fully
 * paid is `unappliedSen`.
 */
export function allocatePayment(
  amountSen: number,
  invoices: readonly AllocatableInvoice[],
): { allocations: AllocationRow[]; unappliedSen: number } {
  const allocations: AllocationRow[] = [];
  let remaining = amountSen;
  for (const invoice of [...invoices].sort(compareInvoices)) {
    if (remaining <= 0) break;
    const unpaid = invoice.amountSen - invoice.allocatedSen;
    if (unpaid <= 0) continue;
    const take = remaining < unpaid ? remaining : unpaid;
    allocations.push({ invoiceId: invoice.id, amountSen: take });
    remaining -= take;
  }
  return { allocations, unappliedSen: remaining };
}
