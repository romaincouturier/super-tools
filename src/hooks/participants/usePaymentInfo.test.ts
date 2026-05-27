import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { Participant } from "@/hooks/useEditParticipant";

const mockFetchCouponCode = vi.fn();
vi.mock("@/services/participants", () => ({
  fetchCouponCode: (...args: unknown[]) => mockFetchCouponCode(...args),
}));

import { usePaymentInfo } from "./usePaymentInfo";

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: "p-1",
    payment_mode: null,
    sold_price_ht: null,
    ...overrides,
  } as Participant;
}

beforeEach(() => {
  mockFetchCouponCode.mockReset();
});

describe("usePaymentInfo", () => {
  it("defaults paymentMode to invoice when payment_mode is null", () => {
    const { result } = renderHook(() =>
      usePaymentInfo({ participant: makeParticipant({ payment_mode: null }), open: false }),
    );
    expect(result.current.paymentMode).toBe("invoice");
  });

  it("defaults paymentMode to invoice when payment_mode is undefined", () => {
    const { result } = renderHook(() =>
      usePaymentInfo({ participant: makeParticipant({ payment_mode: undefined }), open: false }),
    );
    expect(result.current.paymentMode).toBe("invoice");
  });

  it("uses participant payment_mode when present", () => {
    const { result } = renderHook(() =>
      usePaymentInfo({ participant: makeParticipant({ payment_mode: "online" }), open: false }),
    );
    expect(result.current.paymentMode).toBe("online");
  });

  it("soldPriceHt is empty string when sold_price_ht is null", () => {
    const { result } = renderHook(() =>
      usePaymentInfo({ participant: makeParticipant({ sold_price_ht: null }), open: false }),
    );
    expect(result.current.soldPriceHt).toBe("");
  });

  it("soldPriceHt is stringified number when sold_price_ht is present", () => {
    const { result } = renderHook(() =>
      usePaymentInfo({ participant: makeParticipant({ sold_price_ht: 1200 }), open: false }),
    );
    expect(result.current.soldPriceHt).toBe("1200");
  });

  it("resets state when participant prop changes", () => {
    const p1 = makeParticipant({ payment_mode: "online", sold_price_ht: 500 });
    const p2 = makeParticipant({ id: "p-2", payment_mode: null, sold_price_ht: null });

    const { result, rerender } = renderHook(
      ({ participant }) => usePaymentInfo({ participant, open: false }),
      { initialProps: { participant: p1 } },
    );

    expect(result.current.paymentMode).toBe("online");
    expect(result.current.soldPriceHt).toBe("500");

    rerender({ participant: p2 });

    expect(result.current.paymentMode).toBe("invoice");
    expect(result.current.soldPriceHt).toBe("");
  });

  it("does not call fetchCouponCode when open is false", () => {
    renderHook(() =>
      usePaymentInfo({
        participant: makeParticipant(),
        open: false,
        formatFormation: "e_learning",
      }),
    );
    expect(mockFetchCouponCode).not.toHaveBeenCalled();
  });

  it("does not call fetchCouponCode when formatFormation is not e_learning", () => {
    renderHook(() =>
      usePaymentInfo({
        participant: makeParticipant(),
        open: true,
        formatFormation: "presentiel",
      }),
    );
    expect(mockFetchCouponCode).not.toHaveBeenCalled();
  });

  it("calls fetchCouponCode and populates couponCode when open and e_learning", async () => {
    mockFetchCouponCode.mockResolvedValue("PROMO50");

    const { result } = renderHook(() =>
      usePaymentInfo({
        participant: makeParticipant({ id: "p-1" }),
        open: true,
        formatFormation: "e_learning",
      }),
    );

    expect(mockFetchCouponCode).toHaveBeenCalledWith("p-1");

    await waitFor(() => {
      expect(result.current.couponCode).toBe("PROMO50");
    });
  });

  it("keeps couponCode null when fetchCouponCode resolves to null", async () => {
    mockFetchCouponCode.mockResolvedValue(null);

    const { result } = renderHook(() =>
      usePaymentInfo({
        participant: makeParticipant(),
        open: true,
        formatFormation: "e_learning",
      }),
    );

    await waitFor(() => {
      expect(mockFetchCouponCode).toHaveBeenCalled();
    });

    expect(result.current.couponCode).toBeNull();
  });

  it("setPaymentMode updates paymentMode", async () => {
    const participant = makeParticipant();
    const { result } = renderHook(() =>
      usePaymentInfo({ participant, open: false }),
    );

    await act(async () => {
      result.current.setPaymentMode("online");
    });

    expect(result.current.paymentMode).toBe("online");
  });

  it("setSoldPriceHt updates soldPriceHt", async () => {
    const participant = makeParticipant();
    const { result } = renderHook(() =>
      usePaymentInfo({ participant, open: false }),
    );

    await act(async () => {
      result.current.setSoldPriceHt("750");
    });

    expect(result.current.soldPriceHt).toBe("750");
  });
});
