import { useMemo } from "react";

export interface ParsedParticipant {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  sponsorFirstName?: string;
  sponsorLastName?: string;
  sponsorEmail?: string;
}

interface ParseResult {
  participants: ParsedParticipant[];
  errors: string[];
}

const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.\w+/g;

function extractNameParts(text: string): { firstName?: string; lastName?: string } {
  const nameParts = text.split(/\s+/).filter(Boolean);
  return {
    firstName: nameParts.length >= 1 ? nameParts[0] : undefined,
    lastName: nameParts.length >= 2 ? nameParts.slice(1).join(" ") : undefined,
  };
}

function parseInterEntrepriseLine(line: string): { participant?: ParsedParticipant; error?: string } {
  const parts = line.split("|").map((p) => p.trim());
  const participantPart = parts[0];
  const sponsorPart = parts[1] || "";

  const participantEmails = participantPart.match(EMAIL_REGEX);
  if (!participantEmails || participantEmails.length === 0) {
    return { error: "Email du participant invalide" };
  }

  const email = participantEmails[0].toLowerCase();
  let firstName: string | undefined;
  let lastName: string | undefined;
  let company: string | undefined;

  if (participantPart.includes(",")) {
    const [beforeComma, afterComma] = participantPart.split(",").map((p) => p.trim());
    company = afterComma || undefined;
    const beforeEmail = beforeComma.replace(EMAIL_REGEX, "").trim();
    if (beforeEmail) {
      ({ firstName, lastName } = extractNameParts(beforeEmail));
    }
  } else {
    const beforeEmail = participantPart.replace(EMAIL_REGEX, "").trim();
    if (beforeEmail) {
      ({ firstName, lastName } = extractNameParts(beforeEmail));
    }
  }

  let sponsorFirstName: string | undefined;
  let sponsorLastName: string | undefined;
  let sponsorEmail: string | undefined;

  if (sponsorPart) {
    const sponsorEmails = sponsorPart.match(EMAIL_REGEX);
    if (sponsorEmails && sponsorEmails.length > 0) {
      sponsorEmail = sponsorEmails[0].toLowerCase();
      const beforeSponsorEmail = sponsorPart.replace(EMAIL_REGEX, "").trim();
      if (beforeSponsorEmail) {
        const sponsorNames = extractNameParts(beforeSponsorEmail);
        sponsorFirstName = sponsorNames.firstName;
        sponsorLastName = sponsorNames.lastName;
      }
    }
  }

  return {
    participant: { email, firstName, lastName, company, sponsorFirstName, sponsorLastName, sponsorEmail },
  };
}

function parseStandardLine(line: string): { participant?: ParsedParticipant; error?: string } {
  const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (!emailMatch) {
    return { error: "Email invalide" };
  }

  const email = emailMatch[0].toLowerCase();
  let firstName: string | undefined;
  let lastName: string | undefined;
  let company: string | undefined;

  if (line.includes(",")) {
    const [beforeComma, afterComma] = line.split(",").map((p) => p.trim());
    company = afterComma || undefined;
    const beforeEmail = beforeComma.replace(/[\w.-]+@[\w.-]+\.\w+/, "").trim();
    if (beforeEmail) {
      ({ firstName, lastName } = extractNameParts(beforeEmail));
    }
  } else {
    const beforeEmail = line.replace(/[\w.-]+@[\w.-]+\.\w+/, "").trim();
    if (beforeEmail) {
      ({ firstName, lastName } = extractNameParts(beforeEmail));
    }
  }

  return { participant: { email, firstName, lastName, company } };
}

export function parseParticipants(text: string, isInterEntreprise: boolean): ParseResult {
  const lines = text.split("\n").filter((line) => line.trim());
  const participants: ParsedParticipant[] = [];
  const errors: string[] = [];

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    const result = isInterEntreprise
      ? parseInterEntrepriseLine(trimmedLine)
      : parseStandardLine(trimmedLine);

    if (result.error) {
      errors.push(`Ligne ${index + 1}: ${result.error}`);
    } else if (result.participant) {
      participants.push(result.participant);
    }
  });

  return { participants, errors };
}

export function useParticipantParser(text: string, isInterEntreprise: boolean) {
  return useMemo(() => {
    if (!text) {
      return { parsedParticipants: [] as ParsedParticipant[], parseErrors: [] as string[] };
    }
    const result = parseParticipants(text, isInterEntreprise);
    return { parsedParticipants: result.participants, parseErrors: result.errors };
  }, [text, isInterEntreprise]);
}
