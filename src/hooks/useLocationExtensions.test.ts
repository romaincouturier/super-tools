import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { latestSignature, type LocationExtensionSignature } from "./useLocationExtensions";

const sig = (status: LocationExtensionSignature["status"], created_at: string): LocationExtensionSignature => ({
  status,
  created_at,
  signed_at: null,
  email_sent_at: created_at,
  signed_pdf_url: null,
});

describe("latestSignature", () => {
  it("retient le dernier envoi, quel que soit l'ordre renvoyé par la base", () => {
    const signed = sig("signed", "2026-10-15T09:00:00Z");
    expect(latestSignature([sig("pending", "2026-10-14T09:00:00Z"), signed, sig("expired", "2026-10-01T09:00:00Z")])).toBe(signed);
  });

  it("renvoie null sans aucun envoi", () => {
    expect(latestSignature([])).toBeNull();
    expect(latestSignature(null)).toBeNull();
  });
});
