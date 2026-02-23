import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  analyzeExchanges,
  generateQuoteDescription,
  suggestNextAction,
  improveEmailSubject,
  improveEmailBody,
} from "../crm-ai";

const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

const fakeCardContext = {
  title: "Formation React",
  description: "Description test",
  company: "Acme Corp",
  first_name: "Jean",
  last_name: "Dupont",
  service_type: "formation" as const,
  estimated_value: 5000,
  comments: [{ content: "Premier contact OK" }],
  brief_questions: [{ id: "q1", question: "Budget?", answered: true }],
};

describe("crm-ai service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeExchanges", () => {
    it("calls crm-ai-assist with analyze_exchanges action", async () => {
      mockInvoke.mockResolvedValue({ data: { result: "Analyse: bon contact" }, error: null });

      const result = await analyzeExchanges(fakeCardContext);

      expect(mockInvoke).toHaveBeenCalledWith("crm-ai-assist", {
        body: { action: "analyze_exchanges", card_data: fakeCardContext },
      });
      expect(result).toBe("Analyse: bon contact");
    });

    it("throws on error", async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: "AI error" } });
      await expect(analyzeExchanges(fakeCardContext)).rejects.toEqual({ message: "AI error" });
    });
  });

  describe("generateQuoteDescription", () => {
    it("calls crm-ai-assist with generate_quote_description action", async () => {
      mockInvoke.mockResolvedValue({ data: { result: "Devis: formation React 3j" }, error: null });

      const result = await generateQuoteDescription(fakeCardContext);

      expect(mockInvoke).toHaveBeenCalledWith("crm-ai-assist", {
        body: { action: "generate_quote_description", card_data: fakeCardContext },
      });
      expect(result).toBe("Devis: formation React 3j");
    });
  });

  describe("suggestNextAction", () => {
    it("calls crm-ai-assist with suggest_next_action action", async () => {
      mockInvoke.mockResolvedValue({ data: { result: "Relancer par email" }, error: null });

      const extendedContext = {
        ...fakeCardContext,
        confidence_score: 0.8,
        current_next_action: "Envoyer devis",
        days_in_pipeline: 14,
        activities: [],
      };
      const result = await suggestNextAction(extendedContext);

      expect(mockInvoke).toHaveBeenCalledWith("crm-ai-assist", {
        body: { action: "suggest_next_action", card_data: extendedContext },
      });
      expect(result).toBe("Relancer par email");
    });
  });

  describe("improveEmailSubject", () => {
    it("calls crm-ai-assist with improve_email_subject action", async () => {
      mockInvoke.mockResolvedValue({ data: { result: "Objet amélioré" }, error: null });

      const params = {
        subject: "Devis formation",
        company: "Acme",
        first_name: "Jean",
        context: "Relance",
      };
      const result = await improveEmailSubject(params);

      expect(mockInvoke).toHaveBeenCalledWith("crm-ai-assist", {
        body: { action: "improve_email_subject", card_data: params },
      });
      expect(result).toBe("Objet amélioré");
    });

    it("throws on error", async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: "timeout" } });
      await expect(
        improveEmailSubject({ subject: "s", company: "c", first_name: "f", context: "x" }),
      ).rejects.toEqual({ message: "timeout" });
    });
  });

  describe("improveEmailBody", () => {
    it("calls crm-ai-assist with improve_email_body action", async () => {
      mockInvoke.mockResolvedValue({ data: { result: "<p>Corps amélioré</p>" }, error: null });

      const params = {
        body: "<p>Bonjour</p>",
        subject: "Devis",
        company: "Acme",
        first_name: "Jean",
        context: "Envoi initial",
      };
      const result = await improveEmailBody(params);

      expect(mockInvoke).toHaveBeenCalledWith("crm-ai-assist", {
        body: { action: "improve_email_body", card_data: params },
      });
      expect(result).toBe("<p>Corps amélioré</p>");
    });
  });
});
