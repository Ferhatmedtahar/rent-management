import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RejectPaymentDialog } from "./reject-payment-dialog";
import { VoidPaymentDialog } from "./void-payment-dialog";

describe("RejectPaymentDialog", () => {
  it("rejects reason with less than 5 characters", async () => {
    const handleConfirm = vi.fn();
    render(
      <RejectPaymentDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        onConfirm={handleConfirm}
        isSubmitting={false}
      />,
    );

    const textarea = screen.getByLabelText(/reason for rejection/i);
    fireEvent.change(textarea, { target: { value: "bad" } });

    const submitBtn = screen.getByRole("button", { name: /reject payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/please provide a reason of at least 5 characters/i),
      ).toBeInTheDocument();
    });
    expect(handleConfirm).not.toHaveBeenCalled();
  });

  it("submits valid reason successfully", async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <RejectPaymentDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        onConfirm={handleConfirm}
        isSubmitting={false}
      />,
    );

    const textarea = screen.getByLabelText(/reason for rejection/i);
    fireEvent.change(textarea, {
      target: { value: "Bank slip unreadable or forged" },
    });

    const submitBtn = screen.getByRole("button", { name: /reject payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledWith(
        "Bank slip unreadable or forged",
      );
    });
  });
});

describe("VoidPaymentDialog", () => {
  it("rejects reason with less than 5 characters", async () => {
    const handleConfirm = vi.fn();
    render(
      <VoidPaymentDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        amountSen={100000}
        onConfirm={handleConfirm}
        isSubmitting={false}
      />,
    );

    const textarea = screen.getByLabelText(/reason for voiding/i);
    fireEvent.change(textarea, { target: { value: " " } });

    const submitBtn = screen.getByRole("button", { name: /void payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/please provide a reason of at least 5 characters/i),
      ).toBeInTheDocument();
    });
    expect(handleConfirm).not.toHaveBeenCalled();
  });

  it("submits valid void reason successfully", async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <VoidPaymentDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        amountSen={100000}
        onConfirm={handleConfirm}
        isSubmitting={false}
      />,
    );

    const textarea = screen.getByLabelText(/reason for voiding/i);
    fireEvent.change(textarea, {
      target: { value: "Cheque bounced by receiving bank" },
    });

    const submitBtn = screen.getByRole("button", { name: /void payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledWith(
        "Cheque bounced by receiving bank",
      );
    });
  });
});
