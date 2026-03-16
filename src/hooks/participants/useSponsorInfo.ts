import { useState, useEffect } from "react";
import type { Participant } from "@/hooks/useEditParticipant";

export interface UseSponsorInfoOptions {
  participant: Participant;
}

export interface UseSponsorInfoReturn {
  sponsorFirstName: string;
  setSponsorFirstName: React.Dispatch<React.SetStateAction<string>>;
  sponsorLastName: string;
  setSponsorLastName: React.Dispatch<React.SetStateAction<string>>;
  sponsorEmail: string;
  setSponsorEmail: React.Dispatch<React.SetStateAction<string>>;
}

export function useSponsorInfo({
  participant,
}: UseSponsorInfoOptions): UseSponsorInfoReturn {
  const [sponsorFirstName, setSponsorFirstName] = useState(
    participant.sponsor_first_name || "",
  );
  const [sponsorLastName, setSponsorLastName] = useState(
    participant.sponsor_last_name || "",
  );
  const [sponsorEmail, setSponsorEmail] = useState(
    participant.sponsor_email || "",
  );

  useEffect(() => {
    setSponsorFirstName(participant.sponsor_first_name || "");
    setSponsorLastName(participant.sponsor_last_name || "");
    setSponsorEmail(participant.sponsor_email || "");
  }, [participant]);

  return {
    sponsorFirstName,
    setSponsorFirstName,
    sponsorLastName,
    setSponsorLastName,
    sponsorEmail,
    setSponsorEmail,
  };
}
