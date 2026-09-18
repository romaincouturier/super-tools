import { describe, it, expect, vi } from "vitest";

const h = vi.hoisted(() => ({ value: null as unknown }));

vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  useContext: () => h.value,
}));

import { useSession } from "./useSession";

describe("useSession", () => {
  it("rend l'état de session fourni par le provider", () => {
    const state = { user: { id: "u1" }, loading: false };
    h.value = state;

    expect(useSession()).toBe(state);
  });

  it("refuse d'être appelé hors du provider, plutôt que de rendre un état vide", () => {
    h.value = null;

    expect(() => useSession()).toThrow("useSession doit être utilisé dans un SessionProvider");
  });

  it("refuse aussi un contexte indéfini", () => {
    h.value = undefined;

    expect(() => useSession()).toThrow("useSession doit être utilisé dans un SessionProvider");
  });
});
