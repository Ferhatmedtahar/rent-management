import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RecordPaymentDialog } from "./record-payment-dialog";

describe("RecordPaymentDialog", () => {
  it("rejects invalid ringgit amount input", async () => {
    const handleSubmit = vi.fn();
    render(
      <RecordPaymentDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        outstandingBalanceSen={500000} // RM 5,000.00
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: "invalid" } });

    const submitBtn = screen.getByRole("button", { name: /record payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/enter an amount like 1,500.00/i),
      ).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("rejects payment exceeding outstanding balance", async () => {
    const handleSubmit = vi.fn();
    render(
      <RecordPaymentDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        outstandingBalanceSen={300000} // RM 3,000.00
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: "3,500.00" } });

    const submitBtn = screen.getByRole("button", { name: /record payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/amount exceeds what is still owed/i),
      ).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("submits valid cash payment successfully", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordPaymentDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        outstandingBalanceSen={500000} // RM 5,000.00
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: "1,500.00" } });

    const submitBtn = screen.getByRole("button", { name: /record payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          amountSen: 150000,
          method: "cash",
        }),
      );
    });
  });

  it("disables submit button and shows loading state while submitting", () => {
    render(
      <RecordPaymentDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        outstandingBalanceSen={500000}
        onSubmit={vi.fn()}
        isSubmitting={true}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /recording.../i });
    expect(submitBtn).toBeDisabled();
  });
});
