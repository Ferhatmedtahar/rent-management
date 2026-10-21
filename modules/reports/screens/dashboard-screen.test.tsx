import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardScreen } from "./dashboard-screen";

describe("DashboardScreen", () => {
  it("renders overdue invoices card and collections table", () => {
    render(
      <DashboardScreen
        overdueCount={3}
        collections={[
          { month: "2026-01", collectedSen: 500000 },
          { month: "2026-02", collectedSen: 700000 },
        ]}
      />,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/3 invoices past due/i)).toBeInTheDocument();
    expect(screen.getByText("Jan 2026")).toBeInTheDocument();
    expect(screen.getByText("Feb 2026")).toBeInTheDocument();
    expect(screen.getByText("RM 5,000.00")).toBeInTheDocument();
    expect(screen.getByText("RM 7,000.00")).toBeInTheDocument();
    expect(screen.getByText("RM 12,000.00")).toBeInTheDocument(); // Total
  });

  it("renders empty state when there are no collections", () => {
    render(<DashboardScreen overdueCount={0} collections={[]} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(
      screen.getByText("All invoices are fully paid or up to date"),
    ).toBeInTheDocument();
    expect(screen.getByText("Nothing collected yet.")).toBeInTheDocument();
  });
});
