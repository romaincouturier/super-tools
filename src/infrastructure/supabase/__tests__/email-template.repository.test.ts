import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupabaseEmailTemplateRepository } from "../email-template.repository";

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

function chainable(data: unknown = [], error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "insert", "update", "delete", "single", "order"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

describe("SupabaseEmailTemplateRepository", () => {
  let repo: SupabaseEmailTemplateRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new SupabaseEmailTemplateRepository();
  });

  describe("findAll", () => {
    it("returns all email templates", async () => {
      const templates = [
        {
          id: "1",
          template_type: "convention",
          template_name: "Convention",
          subject: "Conv.",
          html_content: "<p>Hi</p>",
          is_default: true,
        },
        {
          id: "2",
          template_type: "thank_you",
          template_name: "Merci",
          subject: "Merci",
          html_content: "<p>Thanks</p>",
          is_default: false,
        },
      ];
      mockFrom.mockReturnValue(chainable(templates));

      const result = await repo.findAll();

      expect(mockFrom).toHaveBeenCalledWith("email_templates");
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no templates", async () => {
      mockFrom.mockReturnValue(chainable(null));
      const result = await repo.findAll();
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chainable(null, { message: "error" }));
      await expect(repo.findAll()).rejects.toEqual({ message: "error" });
    });
  });

  describe("update", () => {
    it("updates subject and html_content", async () => {
      const chain = chainable(null, null);
      mockFrom.mockReturnValue(chain);

      await repo.update("tpl-1", { subject: "New Subject", content: "<p>New</p>" });

      expect(mockFrom).toHaveBeenCalledWith("email_templates");
      expect((chain as Record<string, ReturnType<typeof vi.fn>>).update).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "New Subject",
          html_content: "<p>New</p>",
        }),
      );
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chainable(null, { message: "error" }));
      await expect(repo.update("tpl-1", { subject: "s", content: "c" })).rejects.toEqual({
        message: "error",
      });
    });
  });

  describe("create", () => {
    it("creates a new template with is_default false", async () => {
      const created = {
        id: "new-1",
        template_type: "custom",
        template_name: "Custom",
        subject: "Sub",
        html_content: "<p>Body</p>",
        is_default: false,
      };
      const chain = chainable(created);
      mockFrom.mockReturnValue(chain);

      const result = await repo.create({
        templateType: "custom",
        templateName: "Custom",
        subject: "Sub",
        content: "<p>Body</p>",
      });

      expect(result).toEqual(created);
      expect((chain as Record<string, ReturnType<typeof vi.fn>>).insert).toHaveBeenCalledWith(
        expect.objectContaining({
          template_type: "custom",
          template_name: "Custom",
          subject: "Sub",
          html_content: "<p>Body</p>",
          is_default: false,
        }),
      );
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chainable(null, { message: "duplicate" }));
      await expect(
        repo.create({ templateType: "t", templateName: "n", subject: "s", content: "c" }),
      ).rejects.toEqual({ message: "duplicate" });
    });
  });
});
