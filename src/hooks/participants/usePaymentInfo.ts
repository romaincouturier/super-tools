import { useState, useEffect } from "react";
import { fetchCouponCode } from "@/services/participants";
import type { Participant } from "@/hooks/useEditParticipant";

export interface UsePaymentInfoOptions {
  participant: Participant;
  open: boolean;
  formatFormation?: string | null;
}

export interface UsePaymentInfoReturn {
  paymentMode: "online" | "invoice";
  setPaymentMode: React.Dispatch<React.SetStateAction<"online" | "invoice">>;
  soldPriceHt: string;
  setSoldPriceHt: React.Dispatch<React.SetStateAction<string>>;
  couponCode: string | null;
}

export function usePaymentInfo({
  participant,
  open,
  formatFormation,
}: UsePaymentInfoOptions): UsePaymentInfoReturn {
  const [paymentMode, setPaymentMode] = useState<"online" | "invoice">(
    (participant.payment_mode as "online" | "invoice") || "invoice",
  );
  const [soldPriceHt, setSoldPriceHt] = useState(
    participant.sold_price_ht != null ? String(participant.sold_price_ht) : "",
  );
  const [couponCode, setCouponCode] = useState<string | null>(null);

  useEffect(() => {
    setPaymentMode(
      (participant.payment_mode as "online" | "invoice") || "invoice",
    );
    setSoldPriceHt(
      participant.sold_price_ht != null
        ? String(participant.sold_price_ht)
        : "",
    );
  }, [participant]);

  useEffect(() => {
    if (!open || formatFormation !== "e_learning") return;
    fetchCouponCode(participant.id).then(setCouponCode);
  }, [open, formatFormation, participant.id]);

  return {
    paymentMode,
    setPaymentMode,
    soldPriceHt,
    setSoldPriceHt,
    couponCode,
  };
}
