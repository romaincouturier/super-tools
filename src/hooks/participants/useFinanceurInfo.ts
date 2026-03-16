import { useState, useEffect } from "react";
import { fetchExistingFinanceurs } from "@/services/participants";
import type { Participant } from "@/hooks/useEditParticipant";

export interface UseFinanceurInfoOptions {
  participant: Participant;
  open: boolean;
  isInterEntreprise: boolean;
}

export interface UseFinanceurInfoReturn {
  financeurSameAsSponsor: boolean;
  setFinanceurSameAsSponsor: React.Dispatch<React.SetStateAction<boolean>>;
  financeurName: string;
  setFinanceurName: React.Dispatch<React.SetStateAction<string>>;
  financeurUrl: string;
  setFinanceurUrl: React.Dispatch<React.SetStateAction<string>>;
  financeurPopoverOpen: boolean;
  setFinanceurPopoverOpen: React.Dispatch<React.SetStateAction<boolean>>;
  existingFinanceurs: string[];
}

export function useFinanceurInfo({
  participant,
  open,
  isInterEntreprise,
}: UseFinanceurInfoOptions): UseFinanceurInfoReturn {
  const [financeurSameAsSponsor, setFinanceurSameAsSponsor] = useState(
    participant.financeur_same_as_sponsor ?? true,
  );
  const [financeurName, setFinanceurName] = useState(
    participant.financeur_name || "",
  );
  const [financeurUrl, setFinanceurUrl] = useState(
    participant.financeur_url || "",
  );
  const [financeurPopoverOpen, setFinanceurPopoverOpen] = useState(false);
  const [existingFinanceurs, setExistingFinanceurs] = useState<string[]>([]);

  useEffect(() => {
    setFinanceurSameAsSponsor(participant.financeur_same_as_sponsor ?? true);
    setFinanceurName(participant.financeur_name || "");
    setFinanceurUrl(participant.financeur_url || "");
  }, [participant]);

  useEffect(() => {
    if (!open || !isInterEntreprise) return;
    fetchExistingFinanceurs().then(setExistingFinanceurs);
  }, [open, isInterEntreprise]);

  return {
    financeurSameAsSponsor,
    setFinanceurSameAsSponsor,
    financeurName,
    setFinanceurName,
    financeurUrl,
    setFinanceurUrl,
    financeurPopoverOpen,
    setFinanceurPopoverOpen,
    existingFinanceurs,
  };
}
