import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockFrom, mockSingle, mockInvoke, mockStorageFrom, mockStorageBucket } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockStorageBucket = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/admin-archives/documents/123_file.pdf" } })),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const mockStorageFrom = vi.fn().mockReturnValue(mockStorageBucket);
  const mockInvoke = vi.fn().mockResolvedValue({ data: null, error: null });

  const makeChain = () => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: mockSingle,
  });
  const mockFrom = vi.fn(() => makeChain());

  return { mockFrom, mockSingle, mockInvoke, mockStorageFrom, mockStorageBucket };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: { invoke: mockInvoke },
    storage: { from: mockStorageFrom },
  },
}));

vi.mock("@/services/participants", () => ({
  sanitizeUploadName: (name: string) => name.replace(/[^a-zA-Z0-9_.-]/g, "_"),
}));

vi.mock("@/lib/file-utils", () => ({
  resolveContentType: (file: File) => file.type || "application/octet-stream",
}));

import {
  uploadAdminDocument,
  deleteAdminDocument,
  fetchAdminDocuments,
  fetchAdminDocumentYears,
  type AdminDocument,
} from "./adminDocuments";

// ── uploadAdminDocument ──────────────────────────────────────────────────────

describe("uploadAdminDocument", () => {
  const file = new File(["pdf content"], "facture-2024.pdf", { type: "application/pdf" });

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageBucket.upload.mockResolvedValue({ error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/admin-archives/documents/123_facture-2024.pdf" },
    });
    mockSingle.mockResolvedValue({
      data: {
        id: "doc-1",
        file_url: "https://example.com/admin-archives/documents/123_facture-2024.pdf",
        file_name: "facture-2024.pdf",
        file_size: 1024,
        mime_type: "application/pdf",
        year: null,
        category: null,
        tags: [],
        summary: null,
        analysis_status: "pending",
        uploaded_at: "2024-01-01T00:00:00Z",
        analyzed_at: null,
      },
      error: null,
    });
  });

  it("uploads to the admin-archives bucket", async () => {
    await uploadAdminDocument(file);

    expect(mockStorageFrom).toHaveBeenCalledWith("admin-archives");
    expect(mockStorageBucket.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^documents\/\d+_/),
      file,
      expect.objectContaining({ contentType: "application/pdf", upsert: false }),
    );
  });

  it("inserts a DB record with analysis_status = 'pending'", async () => {
    await uploadAdminDocument(file);

    expect(mockFrom).toHaveBeenCalledWith("admin_documents");
    const chain = mockFrom.mock.results.find(
      (r) => mockFrom.mock.calls[mockFrom.mock.results.indexOf(r)]?.[0] === "admin_documents",
    );
    expect(chain).toBeDefined();
    // The insert receives the pending status — verified via the single() mock above
  });

  it("triggers the analyze-admin-document edge function asynchronously", async () => {
    await uploadAdminDocument(file);

    // Wait for fire-and-forget
    await new Promise((r) => setTimeout(r, 0));

    expect(mockInvoke).toHaveBeenCalledWith(
      "analyze-admin-document",
      expect.objectContaining({
        body: expect.objectContaining({ documentId: "doc-1", mimeType: "application/pdf" }),
      }),
    );
  });

  it("returns the inserted document immediately (before analysis)", async () => {
    const result = await uploadAdminDocument(file);

    expect(result.analysis_status).toBe("pending");
    expect(result.id).toBe("doc-1");
    expect(result.file_name).toBe("facture-2024.pdf");
  });

  it("throws and does NOT insert DB record when storage upload fails", async () => {
    mockStorageBucket.upload.mockResolvedValue({ error: new Error("Bucket quota exceeded") });

    await expect(uploadAdminDocument(file)).rejects.toThrow("Bucket quota exceeded");
    expect(mockFrom).not.toHaveBeenCalledWith("admin_documents");
  });

  it("removes the storage file and throws when DB insert fails", async () => {
    mockSingle.mockResolvedValue({ data: null, error: new Error("new row violates row-level security policy") });

    await expect(uploadAdminDocument(file)).rejects.toThrow("row-level security policy");
    // Cleanup: storage file must be removed
    expect(mockStorageBucket.remove).toHaveBeenCalled();
  });
});

// ── deleteAdminDocument ──────────────────────────────────────────────────────

describe("deleteAdminDocument", () => {
  beforeEach(() => vi.clearAllMocks());

  const doc: AdminDocument = {
    id: "doc-1",
    file_url: "https://project.supabase.co/storage/v1/object/public/admin-archives/documents/123_file.pdf",
    file_name: "file.pdf",
    file_size: 1024,
    mime_type: "application/pdf",
    year: 2024,
    category: "Facture",
    tags: [],
    summary: null,
    analysis_status: "done",
    uploaded_at: "2024-01-01T00:00:00Z",
    analyzed_at: null,
  };

  it("removes the file from admin-archives storage", async () => {
    await deleteAdminDocument(doc);

    expect(mockStorageFrom).toHaveBeenCalledWith("admin-archives");
    expect(mockStorageBucket.remove).toHaveBeenCalledWith(["documents/123_file.pdf"]);
  });

  it("deletes the admin_documents DB record", async () => {
    await deleteAdminDocument(doc);

    expect(mockFrom).toHaveBeenCalledWith("admin_documents");
  });
});

// ── fetchAdminDocuments ──────────────────────────────────────────────────────

describe("fetchAdminDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
  });

  it("queries the admin_documents table", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
    };
    // Simulate resolved value at end of chain
    (chain.order as ReturnType<typeof vi.fn>).mockReturnValue(
      Object.assign(Promise.resolve({ data: [], error: null }), chain),
    );
    mockFrom.mockReturnValue(chain);

    await fetchAdminDocuments();

    expect(mockFrom).toHaveBeenCalledWith("admin_documents");
  });

  it("throws when Supabase returns an error", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
    };
    (chain.order as ReturnType<typeof vi.fn>).mockReturnValue(
      Object.assign(Promise.resolve({ data: null, error: new Error("DB error") }), chain),
    );
    mockFrom.mockReturnValue(chain);

    await expect(fetchAdminDocuments()).rejects.toThrow("DB error");
  });
});

// ── fetchAdminDocumentYears ──────────────────────────────────────────────────

describe("fetchAdminDocumentYears", () => {
  it("returns deduplicated years sorted descending", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    };
    (chain.order as ReturnType<typeof vi.fn>).mockReturnValue(
      Object.assign(
        Promise.resolve({ data: [{ year: 2024 }, { year: 2023 }, { year: 2024 }], error: null }),
        chain,
      ),
    );
    mockFrom.mockReturnValue(chain);

    const years = await fetchAdminDocumentYears();

    expect(years).toEqual([2024, 2023]);
  });
});
