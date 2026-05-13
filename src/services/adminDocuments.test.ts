import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockFrom, mockSingle, mockInvoke, mockStorageFrom, mockStorageBucket } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockStorageBucket = {
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
    from: ((...args: unknown[]) => (mockFrom as any)(...args)) as any,
    functions: { invoke: mockInvoke },
    storage: { from: mockStorageFrom },
  },
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
  const mockDoc: AdminDocument = {
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ data: { document: mockDoc }, error: null });
  });

  it("invokes the upload-admin-document edge function (not direct storage)", async () => {
    await uploadAdminDocument(file);

    expect(mockInvoke).toHaveBeenCalledWith(
      "upload-admin-document",
      expect.objectContaining({ body: expect.any(FormData) }),
    );
    // Direct storage must NEVER be called — edge function handles it with service role
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("passes the file in the FormData body", async () => {
    await uploadAdminDocument(file);

    const [fnName, options] = mockInvoke.mock.calls[0] as [string, { body: FormData }];
    expect(fnName).toBe("upload-admin-document");
    expect(options.body.get("file")).toBe(file);
  });

  it("returns the document from the edge function response", async () => {
    const result = await uploadAdminDocument(file);

    expect(result).toEqual(mockDoc);
    expect(result.analysis_status).toBe("pending");
    expect(result.id).toBe("doc-1");
  });

  it("throws when the edge function returns an error", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error("new row violates row-level security policy"),
    });

    await expect(uploadAdminDocument(file)).rejects.toThrow("row-level security policy");
  });

  it("throws when the edge function returns no document data", async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });

    await expect(uploadAdminDocument(file)).rejects.toThrow("aucun document retourné");
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
  it("queries the admin_documents table", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
    };
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
