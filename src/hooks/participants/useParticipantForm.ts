import { useState, useEffect } from "react";
import type { Participant } from "@/hooks/useEditParticipant";

export interface UseParticipantFormOptions {
  participant: Participant;
}

export interface UseParticipantFormReturn {
  firstName: string;
  setFirstName: React.Dispatch<React.SetStateAction<string>>;
  lastName: string;
  setLastName: React.Dispatch<React.SetStateAction<string>>;
  email: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  company: string;
  setCompany: React.Dispatch<React.SetStateAction<string>>;
}

export function useParticipantForm({
  participant,
}: UseParticipantFormOptions): UseParticipantFormReturn {
  const [firstName, setFirstName] = useState(participant.first_name || "");
  const [lastName, setLastName] = useState(participant.last_name || "");
  const [email, setEmail] = useState(participant.email);
  const [company, setCompany] = useState(participant.company || "");

  useEffect(() => {
    setFirstName(participant.first_name || "");
    setLastName(participant.last_name || "");
    setEmail(participant.email);
    setCompany(participant.company || "");
  }, [participant]);

  return {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    company,
    setCompany,
  };
}
