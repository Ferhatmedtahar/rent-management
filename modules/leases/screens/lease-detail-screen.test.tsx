import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeaseDetailScreen } from "./lease-detail-screen";
import type { LeaseDetailResponse } from "../types/lease.types";

const MOCK_LEASE_DETAIL: LeaseDetailResponse = {
  lease: {
    id: "11111111-1111-1111-1111-111111111111",
    unitId: "unit-1",
    tenantId: "tenant-1",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    monthlyRentSen: 200000,
    depositSen: 400000,
  },
  invoices: [
    {
      id: "inv-deposit",
      kind: "deposit",
      periodIndex: null,
      periodStart: null,
      periodEnd: null,
      dueDate: "2026-01-01",
      amountSen: 400000,
      paidSen: 400000,
      status: "paid",
    },
    {
      id: "inv-rent-1",
      kind: "rent",
      periodIndex: 0,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      dueDate: "2026-01-01",
      amountSen: 200000,
      paidSen: 100000,
      status: "partially_paid",
    },
    {
      id: "inv-rent-2",
      kind: "rent",
      periodIndex: 1,
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
      dueDate: "2026-02-01",
      amountSen: 200000,
      paidSen: 0,
      status: "overdue",
    },
  ],
  payments: [
    {
      id: "pay-1",
      amountSen: 400000,
      unappliedSen: 0,
      method: "cash",
      status: "approved",
      receivedAt: "2026-01-01T10:00:00+08:00",
    },
    {
      id: "pay-2",
      amountSen: 100000,
      unappliedSen: 0,
      method: "bank_transfer",
      status: "approved",
      receivedAt: "2026-01-05T14:30:00+08:00",
    },
  ],
};

describe("LeaseDetailScreen", () => {
  it("renders lease header information correctly", () => {
    render(
      <LeaseDetailScreen
        leaseDetail={MOCK_LEASE_DETAIL}
        unitName="A-12-3"
        tenantName="Aisyah"
        slipPaths={{}}
        onViewSlip={vi.fn()}
      />,
    );

    expect(screen.getByText("Unit A-12-3")).toBeInTheDocument();
    expect(screen.getByText("Aisyah")).toBeInTheDocument();
    expect(screen.getAllByText("RM 2,000.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("RM 4,000.00").length).toBeGreaterThanOrEqual(1);
  });

  it("renders invoices and calculates totals correctly", () => {
    render(
      <LeaseDetailScreen
        leaseDetail={MOCK_LEASE_DETAIL}
        unitName="A-12-3"
        tenantName="Aisyah"
        slipPaths={{}}
        onViewSlip={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Deposit").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("1 Jan 2026 – 31 Jan 2026")).toBeInTheDocument();
    expect(screen.getByText("1 Feb 2026 – 28 Feb 2026")).toBeInTheDocument();

    // Check status badges and table columns
    expect(screen.getAllByText("Paid").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Partially paid")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();

    // Invoices sum: 400,000 + 200,000 + 200,000 = 800,000 sen = RM 8,000.00
    // Paid sum: 400,000 + 100,000 + 0 = 500,000 sen = RM 5,000.00
    // Balance sum: 800,000 - 500,000 = 300,000 sen = RM 3,000.00
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("RM 8,000.00")).toBeInTheDocument();
    expect(screen.getByText("RM 5,000.00")).toBeInTheDocument();
    expect(screen.getByText("RM 3,000.00")).toBeInTheDocument();
  });

  it("renders payments and handles slip link click", () => {
    const handleViewSlip = vi.fn();
    render(
      <LeaseDetailScreen
        leaseDetail={MOCK_LEASE_DETAIL}
        unitName="A-12-3"
        tenantName="Aisyah"
        slipPaths={{ "pay-2": "slips/slip-123.jpg" }}
        onViewSlip={handleViewSlip}
      />,
    );

    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.getByText("Bank transfer")).toBeInTheDocument();

    const viewSlipButton = screen.getByRole("button", { name: /view slip/i });
    expect(viewSlipButton).toBeInTheDocument();

    fireEvent.click(viewSlipButton);
    expect(handleViewSlip).toHaveBeenCalledWith("slips/slip-123.jpg");
  });

  it("renders empty state messages when invoices or payments are empty", () => {
    const emptyDetail: LeaseDetailResponse = {
      ...MOCK_LEASE_DETAIL,
      invoices: [],
      payments: [],
    };

    render(
      <LeaseDetailScreen
        leaseDetail={emptyDetail}
        slipPaths={{}}
        onViewSlip={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No invoices generated for this lease."),
    ).toBeInTheDocument();
    expect(screen.getByText("No payments recorded yet.")).toBeInTheDocument();
  });
});
