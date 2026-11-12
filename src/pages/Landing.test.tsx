import { act, render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import Landing from "./Landing";

const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
vi.mock("@/hooks/useAcademyCatalog", () => ({
  useAcademyCatalog: () => ({ data: { courses: [] }, isLoading: false, isError: false }),
}));
vi.mock("@/hooks/useContactEmail", () => ({ useContactEmail: () => "contact@example.com" }));

afterEach(cleanup);

describe("accès public à l’accueil Academy", () => {
  it.each([null, { user: { id: "staff" } }, { user: { id: "learner" } }])(
    "reste sur / quelle que soit la session existante (%j)",
    async (session) => {
      auth.getSession.mockResolvedValue({ data: { session } });
      let pathname = "";
      function LocationProbe() {
        pathname = useLocation().pathname;
        return null;
      }
      render(<MemoryRouter initialEntries={["/"]}><Landing /><LocationProbe /></MemoryRouter>);
      await act(async () => { await Promise.resolve(); });
      expect(pathname).toBe("/");
    },
  );
});