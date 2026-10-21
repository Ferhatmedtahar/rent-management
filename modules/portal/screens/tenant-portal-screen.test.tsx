import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TenantPortalScreen } from "./tenant-portal-screen";
import type { TenantProfile, TenantLeaseSummary } from "../types/portal.types";

const MOCK_PROFILE: TenantProfile = {
  id: "tenant-1",
  name: "Aisyah",
  email: "aisyah@northwind.test",
  phone: "+60 12-345 6789",
};

const MOCK_LEASES: TenantLeaseSummary[] = [
  {
    id: "lease-1",
    unitId: "unit-1",
    unitName: "A-12-3",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    monthlyRentSen: 200000,
    depositSen: 400000,
  },
];

describe("TenantPortalScreen", () => {
  it("renders tenant profile and lease cards", () => {
    render(
      <TenantPortalScreen
        profile={MOCK_PROFILE}
        leases={MOCK_LEASES}
        selectedLeaseId="lease-1"
        onSelectLease={vi.fn()}
        leaseDetail={null}
        amountDueSen={200000} // RM 2,000.00
        onPayNow={vi.fn()}
        isCreatingBill={false}
        onUpdatePhone={vi.fn()}
        isUpdatingPhone={false}
      />,
    );

    expect(screen.getByText("Tenant Portal")).toBeInTheDocument();
    expect(screen.getAllByText("Aisyah").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("aisyah@northwind.test")).toBeInTheDocument();
    expect(screen.getByText("+60 12-345 6789")).toBeInTheDocument();
    expect(screen.getByText("Unit A-12-3")).toBeInTheDocument();
    expect(screen.getAllByText("RM 2,000.00").length).toBeGreaterThanOrEqual(1);
  });

  it("handles Pay Now button click when amount is due", () => {
    const handlePayNow = vi.fn();
    render(
      <TenantPortalScreen
        profile={MOCK_PROFILE}
        leases={MOCK_LEASES}
        selectedLeaseId="lease-1"
        onSelectLease={vi.fn()}
        leaseDetail={null}
        amountDueSen={200000}
        onPayNow={handlePayNow}
        isCreatingBill={false}
        onUpdatePhone={vi.fn()}
        isUpdatingPhone={false}
      />,
    );

    const payButton = screen.getByRole("button", { name: /pay now/i });
    expect(payButton).toBeEnabled();
    fireEvent.click(payButton);
    expect(handlePayNow).toHaveBeenCalledTimes(1);
  });

  it("disables Pay Now button when nothing is due", () => {
    render(
      <TenantPortalScreen
        profile={MOCK_PROFILE}
        leases={MOCK_LEASES}
        selectedLeaseId="lease-1"
        onSelectLease={vi.fn()}
        leaseDetail={null}
        amountDueSen={0}
        onPayNow={vi.fn()}
        isCreatingBill={false}
        onUpdatePhone={vi.fn()}
        isUpdatingPhone={false}
      />,
    );

    const payButton = screen.getByRole("button", { name: /nothing due/i });
    expect(payButton).toBeDisabled();
  });
});
