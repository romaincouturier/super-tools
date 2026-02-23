import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupabaseSettingsRepository } from "../settings.repository";

const mockFrom = vi.fn();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
      }),
    },
  },
}));

function chainable(data: unknown = [], error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "in", "insert", "update", "upsert", "delete", "single", "order"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

describe("SupabaseSettingsRepository", () => {
  let repo: SupabaseSettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new SupabaseSettingsRepository();
  });

  describe("fetchAll", () => {
    it("returns a settings map from database rows", async () => {
      const rows = [
        { setting_key: "company_name", setting_value: "Acme Corp" },
        { setting_key: "company_email", setting_value: "info@acme.com" },
      ];
      mockFrom.mockReturnValue(chainable(rows));

      const result = await repo.fetchAll();

      expect(mockFrom).toHaveBeenCalledWith("app_settings");
      expect(result).toEqual({
        company_name: "Acme Corp",
        company_email: "info@acme.com",
      });
    });

    it("returns empty map when no settings exist", async () => {
      mockFrom.mockReturnValue(chainable(null));
      const result = await repo.fetchAll();
      expect(result).toEqual({});
    });

    it("defaults null setting_value to empty string", async () => {
      const rows = [{ setting_key: "company_name", setting_value: null }];
      mockFrom.mockReturnValue(chainable(rows));

      const result = await repo.fetchAll();
      expect(result).toEqual({ company_name: "" });
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chainable(null, { message: "error" }));
      await expect(repo.fetchAll()).rejects.toEqual({ message: "error" });
    });
  });

  describe("save", () => {
    it("upserts settings with onConflict setting_key", async () => {
      const chain = chainable(null, null);
      mockFrom.mockReturnValue(chain);

      const settings = [{ setting_key: "company_name", setting_value: "NewCo" }];
      await repo.save(settings);

      expect(mockFrom).toHaveBeenCalledWith("app_settings");
      expect((chain as Record<string, ReturnType<typeof vi.fn>>).upsert).toHaveBeenCalledWith(
        settings,
        { onConflict: "setting_key" },
      );
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chainable(null, { message: "error" }));
      await expect(repo.save([])).rejects.toEqual({ message: "error" });
    });
  });

  describe("uploadReglementInterieur", () => {
    it("uploads file and returns public URL", async () => {
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: "https://example.com/reglement.pdf" },
      });

      const file = new File(["content"], "reglement.pdf", { type: "application/pdf" });
      const result = await repo.uploadReglementInterieur(file);

      expect(mockUpload).toHaveBeenCalled();
      expect(result).toBe("https://example.com/reglement.pdf");
    });

    it("throws on upload error", async () => {
      mockUpload.mockResolvedValue({ error: { message: "too large" } });

      const file = new File(["content"], "big.pdf", { type: "application/pdf" });
      await expect(repo.uploadReglementInterieur(file)).rejects.toEqual({ message: "too large" });
    });
  });
});
