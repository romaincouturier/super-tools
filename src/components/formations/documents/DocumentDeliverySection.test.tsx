import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DocumentDeliverySection from "./DocumentDeliverySection";

const h = vi.hoisted(() => ({ send: vi.fn(), invoke: vi.fn(), toast: vi.fn(), fetch: vi.fn(), exportPdf: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: h.invoke }, auth: { getSession: async () => ({ data: { session: { access_token: "test", user: { id: "staff", email: "staff@example.com" } } } }) } } }));
vi.mock("@/hooks/useEdgeFunction", () => ({ useEdgeFunction: () => ({ loading: false, invoke: h.send }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemoMode: false }) }));
vi.mock("../attendance/attendancePdfExport", () => ({ exportAttendancePdf: h.exportPdf }));
vi.mock("./SendRecipientDialog", () => ({ default: ({ open, onSend }: { open: boolean; onSend: () => void }) => open ? <button onClick={onSend}>Confirm send</button> : null }));

const props = {
  trainingId: "agirc", trainingName: "Agirc-Arrco", startDate: "2026-10-12", endDate: "2026-10-13", isInterEntreprise: false,
  invoiceFileUrl: "invoice.pdf", attendanceSheetsUrls: ["attendance.pdf"], certificateUrls: [], sponsorEmail: "sponsor@example.com", sponsorName: "Sponsor", sponsorFirstName: null, sponsorFormalAddress: true,
  documentsSentInfo: { invoice: null, sheets: null, thankYou: null }, setDocumentsSentInfo: vi.fn(), signatureCount: 24,
  participants: [{ id: "p1", first_name: "Sarah", last_name: "Chorfi", email: "learner@example.com" }], clientName: "Agirc-Arrco", trainingDuree: "14h",
};

async function confirmAll() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Envoyer les documents" }), { button: 0, ctrlKey: false, pointerType: "mouse" });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Tous les documents" }));
}

describe("complete training document delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", h.fetch);
    h.send.mockResolvedValue({ success: true });
    h.invoke.mockResolvedValue({ data: { success: true, signatures: [{ schedule_date: "2026-10-12", period: "AM" }], trainerSignatures: [{ schedule_date: "2026-10-12", period: "AM", signed_at: "2026-10-29", signature_data: "signature" }] } });
  });
  it("blocks all documents and reminds the trainer when a signature is missing", async () => {
    h.invoke.mockResolvedValue({ data: { success: true, signatures: [{ schedule_date: "2026-10-12", period: "AM" }], trainerSignatures: [] } });
    render(<DocumentDeliverySection {...props} />);
    await confirmAll();
    fireEvent.click(screen.getByRole("button", { name: "Confirm send" }));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining("Signez d'abord") })));
    expect(h.send).not.toHaveBeenCalled();
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it("locks double confirmation before preparation and includes attestations in one email", async () => {
    h.fetch.mockResolvedValue(new Response(JSON.stringify({ type: "complete", data: { successCount: 1, certificateUrls: ["certificate.pdf"] } })));
    render(<DocumentDeliverySection {...props} />);
    await confirmAll();
    const confirm = screen.getByRole("button", { name: "Confirm send" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(h.send).toHaveBeenCalledTimes(1));
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(JSON.parse(h.fetch.mock.calls[0][1].body).generateOnly).toBe(true);
    expect(h.send).toHaveBeenCalledWith(expect.objectContaining({ invoiceUrl: "invoice.pdf", attendanceSheetsUrls: ["attendance.pdf"], certificateUrls: ["certificate.pdf"], requestId: expect.any(String) }));
  });
});