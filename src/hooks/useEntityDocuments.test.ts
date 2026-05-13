import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockInvoke, mockStorageFrom, mockStorageRemove } = vi.hoisted(() => {
  const mockStorageRemove = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockStorageFrom = vi.fn().mockReturnValue({ remove: mockStorageRemove });
  const mockInvoke = vi.fn();
  return { mockInvoke, mockStorageFrom, mockStorageRemove };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: mockInvoke },
    storage: { from: mockStorageFrom },
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));

import { uploadEntityDocument, deleteEntityDocumentFile } from "./useEntityDocuments";

// ── uploadEntityDocument ─────────────────────────────────────────────────────

describe("uploadEntityDocument — mission", () => {
  const file = new File(["content"], "rapport.pdf", { type: "application/pdf" });

  beforeEach(() => vi.clearAllMocks());

  it("invokes upload-mission-document edge function (not direct storage)", async () => {
    mockInvoke.mockResolvedValue({
      data: { document: { file_url: "https://example.com/mission-doc.pdf" } },
      error: null,
    });

    await uploadEntityDocument(file, "mission", "mission-1");

    expect(mockInvoke).toHaveBeenCalledWith(
      "upload-mission-document",
      expect.objectContaining({ body: expect.any(FormData) }),
    );
    // Direct storage must NEVER be called — it would trigger RLS violation
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("passes missionId and file in the FormData body", async () => {
    mockInvoke.mockResolvedValue({
      data: { document: { file_url: "https://example.com/doc.pdf" } },
      error: null,
    });

    await uploadEntityDocument(file, "mission", "mission-abc");

    const [fnName, options] = mockInvoke.mock.calls[0] as [string, { body: FormData }];
    expect(fnName).toBe("upload-mission-document");
    expect(options.body.get("missionId")).toBe("mission-abc");
    expect(options.body.get("file")).toBe(file);
  });

  it("returns file_url and document from the edge function response", async () => {
    mockInvoke.mockResolvedValue({
      data: { document: { id: "doc-abc", file_url: "https://example.com/mission-doc.pdf", file_name: "doc.pdf" } },
      error: null,
    });

    const result = await uploadEntityDocument(file, "mission", "mission-1");
    expect(result.file_url).toBe("https://example.com/mission-doc.pdf");
    expect(result.document?.id).toBe("doc-abc");
  });

  it("throws when the edge function returns an error", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error("new row violates row-level security policy"),
    });

    await expect(uploadEntityDocument(file, "mission", "mission-1")).rejects.toThrow(
      "row-level security policy",
    );
  });

  it("throws when the response contains no file_url", async () => {
    mockInvoke.mockResolvedValue({ data: { document: {} }, error: null });

    await expect(uploadEntityDocument(file, "mission", "mission-1")).rejects.toThrow();
  });
});

describe("uploadEntityDocument — training", () => {
  const file = new File(["content"], "support.pdf", { type: "application/pdf" });

  beforeEach(() => vi.clearAllMocks());

  it("invokes upload-training-document edge function (not direct storage)", async () => {
    mockInvoke.mockResolvedValue({
      data: { document: { file_url: "https://example.com/training-doc.pdf" } },
      error: null,
    });

    await uploadEntityDocument(file, "training", "training-1");

    expect(mockInvoke).toHaveBeenCalledWith(
      "upload-training-document",
      expect.objectContaining({ body: expect.any(FormData) }),
    );
    // Direct storage must NEVER be called — it would trigger RLS violation
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("passes trainingId (not missionId) in the FormData body", async () => {
    mockInvoke.mockResolvedValue({
      data: { document: { file_url: "https://example.com/doc.pdf" } },
      error: null,
    });

    await uploadEntityDocument(file, "training", "training-xyz");

    const [fnName, options] = mockInvoke.mock.calls[0] as [string, { body: FormData }];
    expect(fnName).toBe("upload-training-document");
    expect(options.body.get("trainingId")).toBe("training-xyz");
    expect(options.body.get("missionId")).toBeNull();
    expect(options.body.get("file")).toBe(file);
  });

  it("throws when the edge function returns an error", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error("new row violates row-level security policy"),
    });

    await expect(uploadEntityDocument(file, "training", "training-1")).rejects.toThrow();
  });
});

describe("uploadEntityDocument — unsupported entity type", () => {
  it("throws for unsupported entity types", async () => {
    const file = new File(["content"], "file.pdf", { type: "application/pdf" });

    await expect(
      // @ts-expect-error intentional invalid type for test
      uploadEntityDocument(file, "unknown", "id-1"),
    ).rejects.toThrow("non supporté");
  });
});

// ── deleteEntityDocumentFile ─────────────────────────────────────────────────

describe("deleteEntityDocumentFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes the file from the mission-documents bucket", async () => {
    const url =
      "https://project.supabase.co/storage/v1/object/public/mission-documents/abc/123_file.pdf";

    await deleteEntityDocumentFile(url, "mission");

    expect(mockStorageFrom).toHaveBeenCalledWith("mission-documents");
    expect(mockStorageRemove).toHaveBeenCalledWith(["abc/123_file.pdf"]);
  });

  it("removes the file from the training-documents bucket", async () => {
    const url =
      "https://project.supabase.co/storage/v1/object/public/training-documents/training-1/doc.pdf";

    await deleteEntityDocumentFile(url, "training");

    expect(mockStorageFrom).toHaveBeenCalledWith("training-documents");
    expect(mockStorageRemove).toHaveBeenCalledWith(["training-1/doc.pdf"]);
  });

  it("does not throw when bucket path is not found in URL (best-effort)", async () => {
    await expect(
      deleteEntityDocumentFile("https://other.cdn.com/some-file.pdf", "mission"),
    ).resolves.toBeUndefined();
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });
});
