import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { TooltipProvider } from "@/components/ui/tooltip";
import ContentCard from "./ContentCard";
import { maskText } from "@/lib/demoMask";
import type { CalendarCard } from "@/services/socialContents";

const h = vi.hoisted(() => ({ demo: false }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemoMode: h.demo }) }));

const TEXT = "Atelier chez Zqxclient Industries";
const card = {
  group: { id: "g1", format: "post", sync: true, theme_id: null, created_by: null, created_at: "", updated_at: "", posts: [] },
  posts: [{ id: "p1", group_id: "g1", channel_id: "li", text: TEXT, scheduled_at: null, publication_status: "unscheduled", media_id: "m1" }],
  status: "unscheduled",
  scheduledAt: null,
  alerts: [],
} as unknown as CalendarCard;

const renderCard = () => render(
  <DndContext>
    <TooltipProvider>
      <ContentCard card={card} channelsById={new Map()} onOpen={vi.fn()} />
    </TooltipProvider>
  </DndContext>,
);

describe("ContentCard : mode démo", () => {
  beforeEach(() => { h.demo = false; });

  it("affiche le texte du contenu hors démo", () => {
    renderCard();
    expect(screen.getByText(TEXT)).toBeInTheDocument();
  });

  it("masque le texte du contenu en démo", () => {
    h.demo = true;
    const { container } = renderCard();
    expect(container.innerHTML).not.toContain("Zqxclient");
    expect(screen.getByText(maskText(TEXT))).toBeInTheDocument();
  });
});
