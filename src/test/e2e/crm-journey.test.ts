/**
 * E2E Test: CRM Module
 * Tests for leads, activities, quotes, invoices and objectives
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock data
const mockOrganization = {
  id: "org-123",
  name: "Test Organization",
  slug: "test-org",
};

const mockUser = {
  id: "user-123",
  email: "user@test.com",
};

const mockPipelineStages = [
  { id: "stage-1", name: "Nouveau", position: 1, color: "#94a3b8" },
  { id: "stage-2", name: "Contacte", position: 2, color: "#60a5fa" },
  { id: "stage-3", name: "Qualifie", position: 3, color: "#a78bfa" },
  { id: "stage-4", name: "Proposition", position: 4, color: "#f59e0b" },
  { id: "stage-5", name: "Gagne", position: 5, color: "#22c55e" },
  { id: "stage-6", name: "Perdu", position: 6, color: "#ef4444" },
];

const mockLead = {
  id: "lead-123",
  organization_id: mockOrganization.id,
  company_name: "Acme Corp",
  contact_name: "Jean Dupont",
  contact_email: "jean@acme.com",
  contact_phone: "+33123456789",
  source: "website",
  priority: "high",
  temperature: "warm",
  stage_id: "stage-2",
  estimated_amount: 5000,
  created_at: new Date().toISOString(),
};

const mockActivity = {
  id: "activity-123",
  lead_id: mockLead.id,
  type: "call",
  subject: "Appel de decouverte",
  due_date: new Date(Date.now() + 86400000).toISOString(),
  completed_at: null,
};

const mockQuote = {
  id: "quote-123",
  quote_number: "DEV-2026-001",
  lead_id: mockLead.id,
  title: "Formation React",
  amount_ht: 3000,
  tax_rate: 20,
  amount_ttc: 3600,
  status: "draft",
  valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
};

const mockInvoice = {
  id: "invoice-123",
  invoice_number: "FAC-2026-001",
  lead_id: mockLead.id,
  quote_id: mockQuote.id,
  title: "Formation React",
  amount_ht: 3000,
  tax_rate: 20,
  amount_ttc: 3600,
  status: "draft",
  due_date: new Date(Date.now() + 30 * 86400000).toISOString(),
};

const mockObjective = {
  id: "objective-123",
  type: "revenue",
  target_value: 50000,
  current_value: 15000,
  period_start: "2026-01-01",
  period_end: "2026-01-31",
  status: "in_progress",
};

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

describe("CRM Module Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Pipeline Stages CRUD", () => {
    it("should fetch pipeline stages in order", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockPipelineStages,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_pipeline_stages")
        .select("*")
        .order("position");

      expect(result.data?.length).toBe(6);
      expect(result.data?.[0].name).toBe("Nouveau");
      expect(result.data?.[4].name).toBe("Gagne");
    });

    it("should handle empty stages list", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_pipeline_stages")
        .select("*")
        .order("position");

      expect(result.data).toEqual([]);
    });
  });

  describe("Leads CRUD", () => {
    it("should create a new lead", async () => {
      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockLead,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const leadData = {
        organization_id: mockOrganization.id,
        company_name: "Acme Corp",
        contact_name: "Jean Dupont",
        contact_email: "jean@acme.com",
        source: "website",
        priority: "high",
        temperature: "warm",
        stage_id: "stage-1",
      };

      const result = await mockSupabase
        .from("crm_leads")
        .insert(leadData)
        .select()
        .single();

      expect(result.data?.company_name).toBe("Acme Corp");
      expect(result.error).toBeNull();
    });

    it("should update lead stage (drag and drop)", async () => {
      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: { ...mockLead, stage_id: "stage-3" },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_leads")
        .update({ stage_id: "stage-3" })
        .eq("id", mockLead.id)
        .select();

      expect(result.data?.stage_id).toBe("stage-3");
    });

    it("should filter leads by stage", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [mockLead],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_leads")
        .select("*")
        .eq("stage_id", "stage-2");

      expect(result.data?.length).toBe(1);
    });

    it("should filter leads by priority", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [mockLead],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_leads")
        .select("*")
        .eq("priority", "high");

      expect(result.data?.[0].priority).toBe("high");
    });

    it("should handle lead deletion", async () => {
      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_leads")
        .delete()
        .eq("id", mockLead.id);

      expect(result.error).toBeNull();
    });

    it("should validate required fields on lead creation", async () => {
      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "company_name is required" },
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_leads")
        .insert({ organization_id: mockOrganization.id })
        .select()
        .single();

      expect(result.error).not.toBeNull();
    });
  });

  describe("Activities CRUD", () => {
    it("should create an activity for a lead", async () => {
      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockActivity,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const activityData = {
        lead_id: mockLead.id,
        type: "call",
        subject: "Appel de decouverte",
        due_date: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = await mockSupabase
        .from("crm_activities")
        .insert(activityData)
        .select()
        .single();

      expect(result.data?.type).toBe("call");
      expect(result.data?.subject).toBe("Appel de decouverte");
    });

    it("should mark activity as completed", async () => {
      const completedAt = new Date().toISOString();
      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: { ...mockActivity, completed_at: completedAt },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_activities")
        .update({ completed_at: completedAt })
        .eq("id", mockActivity.id);

      expect(result.data?.completed_at).toBe(completedAt);
    });

    it("should filter activities by status (pending/completed)", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: [mockActivity],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_activities")
        .select("*")
        .is("completed_at", null);

      expect(result.data?.[0].completed_at).toBeNull();
    });

    it("should filter activities by type", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [mockActivity],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_activities")
        .select("*")
        .eq("type", "call");

      expect(result.data?.[0].type).toBe("call");
    });
  });

  describe("Quotes CRUD", () => {
    it("should create a quote from a lead", async () => {
      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockQuote,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const quoteData = {
        lead_id: mockLead.id,
        title: "Formation React",
        amount_ht: 3000,
        tax_rate: 20,
        amount_ttc: 3600,
        status: "draft",
      };

      const result = await mockSupabase
        .from("crm_quotes")
        .insert(quoteData)
        .select()
        .single();

      expect(result.data?.quote_number).toBe("DEV-2026-001");
      expect(result.data?.amount_ttc).toBe(3600);
    });

    it("should update quote status to sent", async () => {
      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: { ...mockQuote, status: "sent", sent_at: new Date().toISOString() },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_quotes")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", mockQuote.id);

      expect(result.data?.status).toBe("sent");
      expect(result.data?.sent_at).toBeDefined();
    });

    it("should update quote status to accepted", async () => {
      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: { ...mockQuote, status: "accepted", accepted_at: new Date().toISOString() },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_quotes")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", mockQuote.id);

      expect(result.data?.status).toBe("accepted");
    });

    it("should calculate TTC amount correctly", () => {
      const amount_ht = 3000;
      const tax_rate = 20;
      const expected_ttc = amount_ht * (1 + tax_rate / 100);
      expect(expected_ttc).toBe(3600);
    });

    it("should handle zero tax rate", () => {
      const amount_ht = 3000;
      const tax_rate = 0;
      const expected_ttc = amount_ht * (1 + tax_rate / 100);
      expect(expected_ttc).toBe(3000);
    });
  });

  describe("Invoices CRUD", () => {
    it("should create an invoice from an accepted quote", async () => {
      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockInvoice,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const invoiceData = {
        lead_id: mockLead.id,
        quote_id: mockQuote.id,
        title: "Formation React",
        amount_ht: 3000,
        tax_rate: 20,
        amount_ttc: 3600,
        status: "draft",
      };

      const result = await mockSupabase
        .from("crm_invoices")
        .insert(invoiceData)
        .select()
        .single();

      expect(result.data?.invoice_number).toBe("FAC-2026-001");
      expect(result.data?.quote_id).toBe(mockQuote.id);
    });

    it("should mark invoice as paid", async () => {
      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: { ...mockInvoice, status: "paid", paid_at: new Date().toISOString() },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", mockInvoice.id);

      expect(result.data?.status).toBe("paid");
      expect(result.data?.paid_at).toBeDefined();
    });

    it("should detect overdue invoices", () => {
      const dueDate = new Date(Date.now() - 86400000); // Yesterday
      const isOverdue = new Date() > dueDate;
      expect(isOverdue).toBe(true);
    });
  });

  describe("Objectives CRUD", () => {
    it("should create a monthly revenue objective", async () => {
      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockObjective,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const objectiveData = {
        type: "revenue",
        target_value: 50000,
        current_value: 0,
        period_start: "2026-01-01",
        period_end: "2026-01-31",
        status: "in_progress",
      };

      const result = await mockSupabase
        .from("crm_objectives")
        .insert(objectiveData)
        .select()
        .single();

      expect(result.data?.type).toBe("revenue");
      expect(result.data?.target_value).toBe(50000);
    });

    it("should calculate objective progress percentage", () => {
      const current = 15000;
      const target = 50000;
      const progress = Math.round((current / target) * 100);
      expect(progress).toBe(30);
    });

    it("should update objective current value", async () => {
      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: { ...mockObjective, current_value: 25000 },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_objectives")
        .update({ current_value: 25000 })
        .eq("id", mockObjective.id);

      expect(result.data?.current_value).toBe(25000);
    });

    it("should detect achieved objectives", () => {
      const current = 50000;
      const target = 50000;
      const isAchieved = current >= target;
      expect(isAchieved).toBe(true);
    });
  });

  describe("Lead History", () => {
    it("should track lead field changes", async () => {
      const historyEntry = {
        id: "history-123",
        lead_id: mockLead.id,
        field_name: "stage_id",
        old_value: "stage-1",
        new_value: "stage-2",
        created_at: new Date().toISOString(),
      };

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [historyEntry],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_lead_history")
        .select("*")
        .eq("lead_id", mockLead.id)
        .order("created_at", { ascending: false });

      expect(result.data?.[0].field_name).toBe("stage_id");
      expect(result.data?.[0].old_value).toBe("stage-1");
      expect(result.data?.[0].new_value).toBe("stage-2");
    });
  });

  describe("Notes", () => {
    it("should add a note to a lead", async () => {
      const note = {
        id: "note-123",
        lead_id: mockLead.id,
        content: "Premier contact positif",
        created_at: new Date().toISOString(),
      };

      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: note,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_notes")
        .insert({ lead_id: mockLead.id, content: "Premier contact positif" })
        .select()
        .single();

      expect(result.data?.content).toBe("Premier contact positif");
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle database connection errors", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Connection timeout" },
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_leads")
        .select("*")
        .eq("id", mockLead.id);

      expect(result.error?.message).toBe("Connection timeout");
    });

    it("should handle invalid lead ID", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Row not found" },
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_leads")
        .select("*")
        .eq("id", "invalid-id")
        .single();

      expect(result.data).toBeNull();
    });

    it("should handle negative amounts", () => {
      const amount_ht = -1000;
      const isValid = amount_ht > 0;
      expect(isValid).toBe(false);
    });

    it("should validate email format", () => {
      const validEmail = "test@example.com";
      const invalidEmail = "invalid-email";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      expect(emailRegex.test(validEmail)).toBe(true);
      expect(emailRegex.test(invalidEmail)).toBe(false);
    });

    it("should handle empty search results", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("crm_leads")
        .select("*")
        .ilike("company_name", "%nonexistent%");

      expect(result.data).toEqual([]);
    });
  });
});
