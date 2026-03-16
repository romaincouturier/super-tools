import { describe, it, expect } from "vitest";
import { getErrorMessage } from "./error-utils";

describe("getErrorMessage", () => {
  it("extracts message from an Error instance", () => {
    expect(getErrorMessage(new Error("something broke"))).toBe("something broke");
  });

  it("returns the string directly when given a string", () => {
    expect(getErrorMessage("raw error text")).toBe("raw error text");
  });

  it("returns default message for null", () => {
    expect(getErrorMessage(null)).toBe("Erreur inconnue");
  });

  it("returns default message for undefined", () => {
    expect(getErrorMessage(undefined)).toBe("Erreur inconnue");
  });

  it("returns default message for a number", () => {
    expect(getErrorMessage(42)).toBe("Erreur inconnue");
  });

  it("returns default message for an object without message property", () => {
    expect(getErrorMessage({ code: 500 })).toBe("Erreur inconnue");
  });

  it("returns default message for a boolean", () => {
    expect(getErrorMessage(false)).toBe("Erreur inconnue");
  });
});
