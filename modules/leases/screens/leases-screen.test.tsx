import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeasesScreen } from "./leases-screen";

const MOCK_LEASES = [
  {
    id: "lease-1",
    unitName: "A-12-3",
    tenantName: "Aisyah",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    monthlyRentSen: 200000,
    depositSen: 400000,
  },
  {
    id: "lease-2",
    unitName: "B-05-1",
    tenantName: "Ben",
    startDate: "2026-02-01",
    endDate: "2027-01-31",
    monthlyRentSen: 180000,
    depositSen: 360000,
  },
];

describe("LeasesScreen", () => {
  it("renders leases table and handles client search filtering", () => {
    render(
      <LeasesScreen
        leases={MOCK_LEASES}
        isManager={true}
        onCreateLease={vi.fn()}
      />,
    );

    expect(screen.getByText("Unit A-12-3")).toBeInTheDocument();
    expect(screen.getByText("Unit B-05-1")).toBeInTheDocument();
    expect(screen.getByText("Aisyah")).toBeInTheDocument();
    expect(screen.getByText("Ben")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(
      /filter by unit or tenant/i,
    );
    fireEvent.change(searchInput, { target: { value: "Aisyah" } });

    expect(screen.getByText("Unit A-12-3")).toBeInTheDocument();
    expect(screen.queryByText("Unit B-05-1")).not.toBeInTheDocument();
  });

  it("shows Create Lease button for manager", () => {
    const handleCreate = vi.fn();
    render(
      <LeasesScreen
        leases={MOCK_LEASES}
        isManager={true}
        onCreateLease={handleCreate}
      />,
    );

    const createBtn = screen.getByRole("button", { name: /create lease/i });
    expect(createBtn).toBeInTheDocument();
    fireEvent.click(createBtn);
    expect(handleCreate).toHaveBeenCalledTimes(1);
  });

  it("does not show Create Lease button for staff", () => {
    render(<LeasesScreen leases={MOCK_LEASES} isManager={false} />);
    expect(
      screen.queryByRole("button", { name: /create lease/i }),
    ).not.toBeInTheDocument();
  });
});
