import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
  conventionSignatureMachine,
  evaluationMachine,
  questionnaireMachine,
  type ConventionSignatureStatus,
  type EvaluationStatus,
  type QuestionnaireStatus,
} from "./stateMachine";

// ---------------------------------------------------------------------------
// Generic engine
// ---------------------------------------------------------------------------

describe("canTransition", () => {
  it("returns true for a valid transition", () => {
    expect(canTransition(conventionSignatureMachine, "pending", "signed")).toBe(true);
  });

  it("returns false for an invalid transition", () => {
    expect(canTransition(conventionSignatureMachine, "signed", "pending")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("does not throw for a valid transition", () => {
    expect(() => assertTransition(conventionSignatureMachine, "pending", "signed")).not.toThrow();
  });

  it("throws with a descriptive message for an invalid transition", () => {
    expect(() => assertTransition(conventionSignatureMachine, "cancelled", "signed")).toThrow(
      /Transition invalide.*cancelled.*signed/,
    );
  });
});

// ---------------------------------------------------------------------------
// Convention Signatures
// ---------------------------------------------------------------------------

describe("conventionSignatureMachine", () => {
  const allowed: [ConventionSignatureStatus, ConventionSignatureStatus][] = [
    ["pending", "signed"],
    ["pending", "expired"],
    ["pending", "cancelled"],
    ["signed", "expired"],
  ];

  const forbidden: [ConventionSignatureStatus, ConventionSignatureStatus][] = [
    ["signed", "pending"],
    ["signed", "cancelled"],
    ["expired", "pending"],
    ["expired", "signed"],
    ["cancelled", "pending"],
    ["cancelled", "signed"],
  ];

  it.each(allowed)("allows %s → %s", (from, to) => {
    expect(canTransition(conventionSignatureMachine, from, to)).toBe(true);
  });

  it.each(forbidden)("forbids %s → %s", (from, to) => {
    expect(canTransition(conventionSignatureMachine, from, to)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

describe("evaluationMachine", () => {
  it("allows envoye → soumis", () => {
    expect(canTransition(evaluationMachine, "envoye", "soumis")).toBe(true);
  });

  it("forbids soumis → envoye", () => {
    expect(canTransition(evaluationMachine, "soumis", "envoye")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Questionnaire Besoins
// ---------------------------------------------------------------------------

describe("questionnaireMachine", () => {
  const validPaths: [QuestionnaireStatus, QuestionnaireStatus][] = [
    ["non_envoye", "envoye"],
    ["non_envoye", "expire"],
    ["envoye", "accueil_envoye"],
    ["envoye", "complete"],
    ["envoye", "expire"],
    ["accueil_envoye", "en_cours"],
    ["accueil_envoye", "complete"],
    ["accueil_envoye", "expire"],
    ["en_cours", "complete"],
    ["en_cours", "expire"],
    ["complete", "valide_formateur"],
  ];

  const invalidPaths: [QuestionnaireStatus, QuestionnaireStatus][] = [
    ["complete", "en_cours"],
    ["valide_formateur", "complete"],
    ["expire", "envoye"],
    ["non_envoye", "complete"],
    ["non_envoye", "valide_formateur"],
  ];

  it.each(validPaths)("allows %s → %s", (from, to) => {
    expect(canTransition(questionnaireMachine, from, to)).toBe(true);
  });

  it.each(invalidPaths)("forbids %s → %s", (from, to) => {
    expect(canTransition(questionnaireMachine, from, to)).toBe(false);
  });
});
