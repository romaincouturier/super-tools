import { describe, expect, it } from "vitest";
import { missingTrainerSlots, readCertificateGeneration } from "./trainingDocumentDelivery";

describe("training document preparation", () => {
  const slots = ["AM", "PM"].map(period => ({ schedule_date: "2026-10-12", period }));
  it("requires a trainer signature for every attendance slot", () => {
    expect(missingTrainerSlots(slots, [{ ...slots[0], signed_at: "2026-10-29", signature_data: "signature" }])).toEqual(["2026-10-12-PM"]);
  });
  it("accepts all signed slots", () => {
    expect(missingTrainerSlots(slots, slots.map(s => ({ ...s, signed_at: "2026-10-29", signature_data: "signature" })))).toEqual([]);
  });
  it("rejects incomplete attestations even with HTTP 200", async () => {
    await expect(readCertificateGeneration(new Response('{"type":"complete","data":{"successCount":0}}\n'), 6)).rejects.toThrow("pas toutes disponibles");
  });
  it("returns the generated attachments for all six participants", async () => {
    const urls = Array.from({ length: 6 }, (_, i) => `certificate-${i}.pdf`);
    expect(await readCertificateGeneration(new Response(JSON.stringify({ type: "complete", data: { successCount: 6, certificateUrls: urls } })), 6)).toEqual(urls);
  });
  it("does not report an email failure as a success", async () => {
    await expect(readCertificateGeneration(new Response('{"type":"step","data":{"step":"email","status":"error","message":"Envoi refusé"}}\n{"type":"complete","data":{"successCount":6}}'), 6)).rejects.toThrow("Envoi refusé");
  });
});