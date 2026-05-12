import { describe, it, expect } from "vitest";
import { sanitizeFileName, resolveContentType } from "./file-utils.ts";

describe("sanitizeFileName", () => {
  it("lowercases the name", () => {
    expect(sanitizeFileName("MyFile.PDF")).toBe("myfile.pdf");
  });

  it("removes French accents", () => {
    expect(sanitizeFileName("résumé.pdf")).toBe("resume.pdf");
  });

  it("replaces spaces and special chars with underscores", () => {
    expect(sanitizeFileName("mon fichier (2).pdf")).toBe("mon_fichier__2_.pdf");
  });

  it("preserves dots, dashes, and digits", () => {
    expect(sanitizeFileName("file-2024_v1.2.docx")).toBe("file-2024_v1.2.docx");
  });

  it("handles an empty string", () => {
    expect(sanitizeFileName("")).toBe("");
  });
});

describe("resolveContentType", () => {
  const makeFile = (name: string, type = "") =>
    new File([""], name, { type });

  it("returns file.type when present", () => {
    expect(resolveContentType(makeFile("doc.pdf", "application/pdf"))).toBe("application/pdf");
  });

  it("strips charset from file.type", () => {
    expect(resolveContentType(makeFile("text.txt", "text/plain; charset=utf-8"))).toBe("text/plain");
  });

  it("resolves pdf from extension when file.type is empty", () => {
    expect(resolveContentType(makeFile("report.pdf"))).toBe("application/pdf");
  });

  it("resolves jpg and jpeg to image/jpeg", () => {
    expect(resolveContentType(makeFile("photo.jpg"))).toBe("image/jpeg");
    expect(resolveContentType(makeFile("photo.jpeg"))).toBe("image/jpeg");
  });

  it("resolves png to image/png", () => {
    expect(resolveContentType(makeFile("logo.png"))).toBe("image/png");
  });

  it("resolves docx to Word MIME type", () => {
    expect(resolveContentType(makeFile("contract.docx"))).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("resolves xlsx to Excel MIME type", () => {
    expect(resolveContentType(makeFile("data.xlsx"))).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("falls back to application/octet-stream for unknown extensions", () => {
    expect(resolveContentType(makeFile("archive.xyz"))).toBe("application/octet-stream");
  });

  it("accepts a custom fallback", () => {
    expect(resolveContentType(makeFile("photo.unknown"), "image/png")).toBe("image/png");
  });

  it("is case-insensitive for extensions", () => {
    expect(resolveContentType(makeFile("PHOTO.PNG"))).toBe("image/png");
  });
});
