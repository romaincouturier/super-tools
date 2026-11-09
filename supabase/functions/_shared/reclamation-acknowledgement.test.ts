import { describe, it, expect } from "vitest";
import {
  acknowledgementBlocker,
  canAcknowledge,
  blockerMessage,
} from "./reclamation-acknowledgement.ts";

const soumise = {
  status: "open",
  client_email: "client@example.com",
  acknowledgement_sent_at: null,
};

describe("acknowledgementBlocker", () => {
  it("laisse passer une réclamation soumise avec une adresse", () => {
    expect(acknowledgementBlocker(soumise)).toBeNull();
    expect(canAcknowledge(soumise)).toBe(true);
  });

  // Un lien créé mais jamais rempli reste en brouillon : il n'y a rien à
  // accuser, et le réclamant n'a encore rien envoyé.
  it("refuse une réclamation encore en brouillon", () => {
    expect(acknowledgementBlocker({ ...soumise, status: "draft" })).toBe("not_submitted");
  });

  it("refuse quand aucune adresse n'est enregistrée", () => {
    expect(acknowledgementBlocker({ ...soumise, client_email: null })).toBe("no_email");
    expect(acknowledgementBlocker({ ...soumise, client_email: "   " })).toBe("no_email");
    expect(acknowledgementBlocker({ ...soumise, client_email: undefined })).toBe("no_email");
  });

  // Sans cette garde, un rechargement de la page de confirmation renverrait un
  // second accusé au réclamant.
  it("refuse un second envoi", () => {
    expect(
      acknowledgementBlocker({ ...soumise, acknowledgement_sent_at: "2026-11-05T10:00:00Z" }),
    ).toBe("already_sent");
  });

  it("vérifie le brouillon avant l'adresse manquante", () => {
    expect(
      acknowledgementBlocker({ status: "draft", client_email: null, acknowledgement_sent_at: null }),
    ).toBe("not_submitted");
  });

  it("accepte les statuts de traitement postérieurs à la soumission", () => {
    for (const status of ["open", "in_progress", "closed"]) {
      expect(acknowledgementBlocker({ ...soumise, status })).toBeNull();
    }
  });
});

describe("blockerMessage", () => {
  it("nomme chaque blocage", () => {
    expect(blockerMessage("not_submitted")).toBe("Réclamation encore en brouillon");
    expect(blockerMessage("no_email")).toBe("Aucune adresse de réclamant enregistrée");
    expect(blockerMessage("already_sent")).toBe("Accusé de réception déjà envoyé");
  });

  it("rend une chaîne vide quand rien ne bloque", () => {
    expect(blockerMessage(null)).toBe("");
  });
});
