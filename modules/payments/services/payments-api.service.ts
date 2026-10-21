import { api } from "@/shared/lib/api-client";

export type RecordPaymentPayload = {
  amountSen: number;
  method: "cash" | "bank_transfer";
  receivedAt: string; // ISO with +08:00
  slipPath?: string;
};

export type RecordPaymentResponse = {
  id: string;
  status: "pending_verification" | "approved";
};

export type ReviewPaymentResponse = {
  status: "approved" | "rejected" | "voided";
};

export function recordPayment(
  leaseId: string,
  payload: RecordPaymentPayload,
  signal?: AbortSignal,
): Promise<RecordPaymentResponse> {
  return api.post<RecordPaymentResponse>(`/leases/${leaseId}/payments`, {
    body: payload,
    signal,
  });
}

export function approvePayment(
  paymentId: string,
  signal?: AbortSignal,
): Promise<ReviewPaymentResponse> {
  return api.post<ReviewPaymentResponse>(`/payments/${paymentId}/approve`, {
    signal,
  });
}

export function rejectPayment(
  paymentId: string,
  reason: string,
  signal?: AbortSignal,
): Promise<ReviewPaymentResponse> {
  return api.post<ReviewPaymentResponse>(`/payments/${paymentId}/reject`, {
    body: { reason },
    signal,
  });
}

export function voidPayment(
  paymentId: string,
  reason: string,
  signal?: AbortSignal,
): Promise<ReviewPaymentResponse> {
  return api.post<ReviewPaymentResponse>(`/payments/${paymentId}/void`, {
    body: { reason },
    signal,
  });
}
