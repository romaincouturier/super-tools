/**
 * Tests for handleFileUpload — the generic edge-function upload handler.
 *
 * Security guarantees verified here:
 *   1. Returns 401 when Authorization header is missing or invalid.
 *   2. Returns 400 when validateParams() throws (bad params / missing UUID).
 *   3. Returns 200 and calls persist() with correct args when all is well.
 *   4. Rolls back the storage upload when persist() throws (no orphaned files).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Deno global (not available in Node/Vitest) ────────────────────────
const mockEnvGet = vi.fn((key: string) => {
  if (key === "SUPABASE_URL") return "https://test.supabase.co";
  if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service-key";
  if (key === "SUPABASE_ANON_KEY") return "anon-key";
  return undefined;
});
vi.stubGlobal("Deno", { env: { get: mockEnvGet } });

// ── Mock external Supabase client ─────────────────────────────────────────
const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
const mockGetPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://cdn.example.com/file.pdf" } }));
const mockStorageUpload = vi.fn().mockResolvedValue({ error: null });
// list() is called after upload to verify the object was written.
// Return a one-item array whose `name` matches the last path segment.
const mockList = vi.fn().mockImplementation((_dir: string, opts?: { search?: string }) => ({
  data: [{ name: opts?.search ?? "file" }],
  error: null,
}));
const mockStorageBucket = {
  upload: mockStorageUpload,
  getPublicUrl: mockGetPublicUrl,
  remove: mockRemove,
  list: mockList,
};
const mockStorageFrom = vi.fn(() => mockStorageBucket);
const mockCreateClient = vi.fn(() => ({
  storage: { from: mockStorageFrom },
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

// ── Mock shared helpers ────────────────────────────────────────────────────
const mockVerifyAuth = vi.fn();

vi.mock("./supabase-client.ts", () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

vi.mock("./cors.ts", () => ({
  corsHeaders: { "Access-Control-Allow-Origin": "*" },
  handleCorsPreflightIfNeeded: (req: Request) =>
    req.method === "OPTIONS" ? new Response(null, { status: 204 }) : null,
  createErrorResponse: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  createJsonResponse: (data: unknown) =>
    new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } }),
}));

vi.mock("./file-utils.ts", () => ({
  sanitizeFileName: (n: string) => n.toLowerCase().replace(/[^a-z0-9._-]/g, "_"),
  resolveContentType: () => "application/octet-stream",
}));

// sentry.ts importe "npm:@sentry/deno" (spécifieur Deno) — irrésoluble par Vite.
vi.mock("./sentry.ts", () => ({
  reportEdgeError: vi.fn(),
}));

import { handleFileUpload, type UploadConfig } from "./upload-handler.ts";

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a mock Request that bypasses FormData serialization/deserialization.
 * Using `new Request({ body: formData })` in jsdom causes File instances to
 * lose their class identity through the multipart round-trip (cross-realm
 * instanceof). This mock returns the FormData directly from formData() so
 * that `form.get("file") instanceof File` works correctly in tests.
 */
function makeRequest(fields: Record<string, string | File>, authHeader?: string): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return {
    method: "POST",
    headers: { get: (h: string) => (h.toLowerCase() === "authorization" ? (authHeader ?? null) : null) },
    formData: () => Promise.resolve(fd),
  } as unknown as Request;
}

const testFile = new File(["hello"], "test.pdf", { type: "application/pdf" });
const validUuid = "123e4567-e89b-12d3-a456-426614174000";

const baseConfig: UploadConfig<{ resourceId: string }> = {
  name: "test-upload",
  bucket: "test-bucket",
  validateParams: (form) => {
    const resourceId = String(form.get("resourceId") || "");
    if (!resourceId || !/^[0-9a-f-]{36}$/i.test(resourceId)) {
      throw new Error("resourceId invalide");
    }
    return { resourceId };
  },
  buildPath: ({ resourceId }, file) => `${resourceId}/${file.name}`,
  persist: vi.fn().mockResolvedValue({ fileUrl: "https://cdn.example.com/file.pdf" }),
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("handleFileUpload — authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageUpload.mockResolvedValue({ error: null });
    (baseConfig.persist as ReturnType<typeof vi.fn>).mockResolvedValue({ fileUrl: "https://cdn.example.com/file.pdf" });
  });

  it("returns 401 when Authorization header is absent", async () => {
    mockVerifyAuth.mockResolvedValue(null);
    const req = makeRequest({ resourceId: validUuid, file: testFile });
    const res = await handleFileUpload(req, baseConfig);
    expect(res.status).toBe(401);
  });

  it("returns 401 when verifyAuth returns null (invalid token)", async () => {
    mockVerifyAuth.mockResolvedValue(null);
    const req = makeRequest({ resourceId: validUuid, file: testFile }, "Bearer invalid-token");
    const res = await handleFileUpload(req, baseConfig);
    expect(res.status).toBe(401);
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("returns 405 for non-POST requests", async () => {
    const req = { method: "GET", headers: { get: () => null }, formData: vi.fn() } as unknown as Request;
    const res = await handleFileUpload(req, baseConfig);
    expect(res.status).toBe(405);
  });

  it("returns 204 for OPTIONS preflight without calling auth", async () => {
    const req = { method: "OPTIONS" } as unknown as Request;
    const res = await handleFileUpload(req, baseConfig);
    expect(res.status).toBe(204);
    expect(mockVerifyAuth).not.toHaveBeenCalled();
  });
});

describe("handleFileUpload — param validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ id: "user-abc" });
    mockStorageUpload.mockResolvedValue({ error: null });
    (baseConfig.persist as ReturnType<typeof vi.fn>).mockResolvedValue({ fileUrl: "https://cdn.example.com/file.pdf" });
  });

  it("returns 400 when validateParams throws (missing resourceId)", async () => {
    const req = makeRequest({ file: testFile }, "Bearer valid-token");
    const res = await handleFileUpload(req, baseConfig);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("resourceId");
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("returns 400 when validateParams throws (invalid UUID format)", async () => {
    const req = makeRequest({ resourceId: "not-a-uuid", file: testFile }, "Bearer valid-token");
    const res = await handleFileUpload(req, baseConfig);
    expect(res.status).toBe(400);
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("returns 400 when file is missing from FormData", async () => {
    const req = makeRequest({ resourceId: validUuid }, "Bearer valid-token");
    const res = await handleFileUpload(req, baseConfig);
    expect(res.status).toBe(400);
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });
});

describe("handleFileUpload — success path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ id: "user-abc" });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn.example.com/file.pdf" } });
    mockStorageFrom.mockReturnValue(mockStorageBucket);
    mockCreateClient.mockReturnValue({ storage: { from: mockStorageFrom } });
    (baseConfig.persist as ReturnType<typeof vi.fn>).mockResolvedValue({ fileUrl: "https://cdn.example.com/file.pdf" });
  });

  it("returns 200 and calls persist with correct args", async () => {
    const req = makeRequest({ resourceId: validUuid, file: testFile }, "Bearer valid-token");
    const res = await handleFileUpload(req, baseConfig);
    expect(res.status).toBe(200);
    expect(mockStorageUpload).toHaveBeenCalledWith(
      `${validUuid}/test.pdf`,
      testFile,
      expect.objectContaining({ upsert: false }),
    );
    expect(baseConfig.persist).toHaveBeenCalledWith(
      expect.anything(),
      { resourceId: validUuid },
      "https://cdn.example.com/file.pdf",
      `${validUuid}/test.pdf`,
      testFile,
      "user-abc",
    );
  });

  it("returns the data from persist in the response body", async () => {
    (baseConfig.persist as ReturnType<typeof vi.fn>).mockResolvedValue({ fileUrl: "https://cdn.example.com/file.pdf", extra: 42 });
    const req = makeRequest({ resourceId: validUuid, file: testFile }, "Bearer valid-token");
    const res = await handleFileUpload(req, baseConfig);
    const body = await res.json();
    expect(body).toEqual({ fileUrl: "https://cdn.example.com/file.pdf", extra: 42 });
  });

  it("creates the admin client with service role key (never anon key)", async () => {
    const req = makeRequest({ resourceId: validUuid, file: testFile }, "Bearer valid-token");
    await handleFileUpload(req, baseConfig);
    expect(mockCreateClient).toHaveBeenCalledWith("https://test.supabase.co", "service-key");
    expect(mockCreateClient).not.toHaveBeenCalledWith(expect.anything(), "anon-key");
  });
});

describe("handleFileUpload — rollback on persist failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ id: "user-abc" });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn.example.com/file.pdf" } });
    mockStorageFrom.mockReturnValue(mockStorageBucket);
    mockCreateClient.mockReturnValue({ storage: { from: mockStorageFrom } });
  });

  it("removes the uploaded file from storage when persist throws", async () => {
    (baseConfig.persist as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB constraint violation"));
    const req = makeRequest({ resourceId: validUuid, file: testFile }, "Bearer valid-token");
    const res = await handleFileUpload(req, baseConfig);
    expect(res.status).toBe(500);
    expect(mockRemove).toHaveBeenCalledWith([`${validUuid}/test.pdf`]);
  });

  it("returns 500 with the persist error message", async () => {
    (baseConfig.persist as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Erreur d'enregistrement"));
    const req = makeRequest({ resourceId: validUuid, file: testFile }, "Bearer valid-token");
    const res = await handleFileUpload(req, baseConfig);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("Erreur d'enregistrement");
  });

  it("does not call persist when storage upload fails", async () => {
    mockStorageUpload.mockResolvedValue({ error: { message: "bucket quota exceeded" } });
    const req = makeRequest({ resourceId: validUuid, file: testFile }, "Bearer valid-token");
    const res = await handleFileUpload(req, baseConfig);
    expect(res.status).toBe(500);
    expect(baseConfig.persist).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });
});

describe("handleFileUpload — optional authorize hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ id: "user-abc" });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn.example.com/file.pdf" } });
    mockStorageFrom.mockReturnValue(mockStorageBucket);
    mockCreateClient.mockReturnValue({ storage: { from: mockStorageFrom } });
    (baseConfig.persist as ReturnType<typeof vi.fn>).mockResolvedValue({ fileUrl: "https://cdn.example.com/file.pdf" });
  });

  it("returns 403 when authorize returns false", async () => {
    const configWithAuth: UploadConfig<{ resourceId: string }> = {
      ...baseConfig,
      authorize: vi.fn().mockResolvedValue(false),
    };
    const req = makeRequest({ resourceId: validUuid, file: testFile }, "Bearer valid-token");
    const res = await handleFileUpload(req, configWithAuth);
    expect(res.status).toBe(403);
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("proceeds normally when authorize returns true", async () => {
    const configWithAuth: UploadConfig<{ resourceId: string }> = {
      ...baseConfig,
      authorize: vi.fn().mockResolvedValue(true),
    };
    const req = makeRequest({ resourceId: validUuid, file: testFile }, "Bearer valid-token");
    const res = await handleFileUpload(req, configWithAuth);
    expect(res.status).toBe(200);
  });
});
