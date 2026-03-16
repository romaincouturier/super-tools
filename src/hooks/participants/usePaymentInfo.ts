import { useState, useEffect } from "react";
import { fetchCouponCode } from "@/services/participants";
import type { Participant } from "@/hooks/useEditParticipant";

export interface UsePaymentInfoOptions {
  participant: Participant;
  open: boolean;
  formatFormation?: string | null;
  trainingElearningDuration?: number | null;
}

export interface UsePaymentInfoReturn {
  paymentMode: "online" | "invoice";
  setPaymentMode: React.Dispatch<React.SetStateAction<"online" | "invoice">>;
  soldPriceHt: string;
  setSoldPriceHt: React.Dispatch<React.SetStateAction<string>>;
  elearningDuration: string;
  setElearningDuration: React.Dispatch<React.SetStateAction<string>>;
  couponCode: string | null;
}

export function usePaymentInfo({
  participant,
  open,
  formatFormation,
  trainingElearningDuration,
}: UsePaymentInfoOptions): UsePaymentInfoReturn {
  const [paymentMode, setPaymentMode] = useState<"online" | "invoice">(
    (participant.payment_mode as "online" | "invoice") || "invoice",
  );
  const [soldPriceHt, setSoldPriceHt] = useState(
    participant.sold_price_ht != null ? String(participant.sold_price_ht) : "",
  );
  const [elearningDuration, setElearningDuration] = useState(
    participant.elearning_duration != null
      ? String(participant.elearning_duration)
      : trainingElearningDuration != null
        ? String(trainingElearningDuration)
        : "",
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
    setElearningDuration(
      participant.elearning_duration != null
        ? String(participant.elearning_duration)
        : trainingElearningDuration != null
          ? String(trainingElearningDuration)
          : "",
    );
  }, [participant, trainingElearningDuration]);

  useEffect(() => {
    if (!open || formatFormation !== "e_learning") return;
    fetchCouponCode(participant.id).then(setCouponCode);
  }, [open, formatFormation, participant.id]);

  return {
    paymentMode,
    setPaymentMode,
    soldPriceHt,
    setSoldPriceHt,
    elearningDuration,
    setElearningDuration,
    couponCode,
  };
}
