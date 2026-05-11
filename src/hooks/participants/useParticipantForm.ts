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
  companyAddress: string;
  setCompanyAddress: React.Dispatch<React.SetStateAction<string>>;
  companyZip: string;
  setCompanyZip: React.Dispatch<React.SetStateAction<string>>;
  companyCity: string;
  setCompanyCity: React.Dispatch<React.SetStateAction<string>>;
}

export function useParticipantForm({
  participant,
}: UseParticipantFormOptions): UseParticipantFormReturn {
  const [firstName, setFirstName] = useState(participant.first_name || "");
  const [lastName, setLastName] = useState(participant.last_name || "");
  const [email, setEmail] = useState(participant.email);
  const [company, setCompany] = useState(participant.company || "");
  const [companyAddress, setCompanyAddress] = useState(participant.company_address || "");
  const [companyZip, setCompanyZip] = useState(participant.company_zip || "");
  const [companyCity, setCompanyCity] = useState(participant.company_city || "");

  useEffect(() => {
    setFirstName(participant.first_name || "");
    setLastName(participant.last_name || "");
    setEmail(participant.email);
    setCompany(participant.company || "");
    setCompanyAddress(participant.company_address || "");
    setCompanyZip(participant.company_zip || "");
    setCompanyCity(participant.company_city || "");
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
    companyAddress,
    setCompanyAddress,
    companyZip,
    setCompanyZip,
    companyCity,
    setCompanyCity,
  };
}
