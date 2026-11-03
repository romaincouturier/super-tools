import { describe, it, expect } from "vitest";
import { requiresStaff, sendsToSubmitter, recipientIsSubmitter } from "./support-notification-access.ts";

describe("requiresStaff", () => {
  it("laisse un déclarant connecté notifier la création de son ticket", () => {
    expect(requiresStaff("new_ticket")).toBe(false);
    expect(requiresStaff("new_ticket_copy")).toBe(false);
  });

  it("réserve au staff la demande d'échange, le ticket résolu et tout type inconnu", () => {
    expect(requiresStaff("discussion_request")).toBe(true);
    expect(requiresStaff(undefined)).toBe(true);
    expect(requiresStaff("autre")).toBe(true);
  });
});

describe("sendsToSubmitter", () => {
  it("seule la notification admin ne va pas au déclarant", () => {
    expect(sendsToSubmitter("new_ticket")).toBe(false);
    expect(sendsToSubmitter("new_ticket_copy")).toBe(true);
    expect(sendsToSubmitter(undefined)).toBe(true);
  });
});

describe("recipientIsSubmitter", () => {
  it("accepte le déclarant du ticket, sans tenir compte de la casse", () => {
    expect(recipientIsSubmitter(" Jean@Acme.fr ", "jean@acme.fr")).toBe(true);
  });

  it("refuse une autre adresse, une adresse vide ou un ticket sans déclarant", () => {
    expect(recipientIsSubmitter("pirate@x.fr", "jean@acme.fr")).toBe(false);
    expect(recipientIsSubmitter("", "jean@acme.fr")).toBe(false);
    expect(recipientIsSubmitter("jean@acme.fr", null)).toBe(false);
  });
});
