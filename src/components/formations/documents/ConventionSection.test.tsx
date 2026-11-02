import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ConventionSection from "./ConventionSection";

const h = vi.hoisted(() => ({ invoke: vi.fn(), download: vi.fn(), toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: h.invoke } } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("@/hooks/useEdgeFunction", () => ({ useEdgeFunction: () => ({ loading: false, invoke: h.invoke }) }));
vi.mock("@/lib/file-utils", () => ({ downloadFile: h.download }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemoMode: false }) }));
vi.mock("./SignedConventionFiles", () => ({ default: () => null }));
vi.mock("./ConventionAuditPanel", () => ({ default: () => null }));

describe("convention download scope", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never regenerates an obsolete global convention for an inter session", () => {
    render(<ConventionSection
      trainingId="724bba99-48af-46b5-b359-23db722e12d6"
      isInterEntreprise formatFormation="classe_virtuelle"
      conventionFileUrl="https://example.com/document/old.pdf?X-Amz-Signature=expired"
      setConventionFileUrl={vi.fn()}
      sponsorEmail={null} sponsorName={null} sponsorFirstName={null} sponsorFormalAddress
      conventionSentAt={null} setConventionSentAt={vi.fn()}
      conventionSignatureStatus={null} conventionSignatureUrl={null} setConventionSignatureUrl={vi.fn()}
      signedConventionUrls={[]} setSignedConventionUrls={vi.fn()}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Convention générée" }));
    expect(h.invoke).not.toHaveBeenCalled();
    expect(h.download).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledTimes(1);
  });
});