import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DragWordsBlockViewer from "./DragWordsBlockViewer";
import TimelineBlockViewer from "./TimelineBlockViewer";
import FlipCardsBlockViewer from "./FlipCardsBlockViewer";
import HtmlEmbedBlockViewer from "./HtmlEmbedBlockViewer";

afterEach(cleanup);
describe("interactive LMS viewers", () => {
  it("opens first timeline detail and switches on the whole step button", () => {
    render(<TimelineBlockViewer content={{ steps: [
      { id: "a", title: "Début", panel_title: "Premier panneau", description: "Description initiale" },
      { id: "b", title: "Suite", panel_title: "Second panneau", description: "Description suivante" },
    ] }} />);
    expect(screen.getByText("Description initiale")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Suite/ }));
    expect(screen.getByText("Second panneau")).toBeVisible();
    expect(screen.getByText("Description suivante")).toBeVisible();
    expect(screen.queryByText("Description initiale")).not.toBeInTheDocument();
  });
  it("keeps configured card height and large text when flipped", () => {
    render(<FlipCardsBlockViewer content={{ card_height_px: 400, cards: [{ id: "a", front_text: "Question", back_text: "Réponse", front_image_url: "/image.png" }] }} />);
    const button = screen.getByRole("button", { name: "Retourner (verso)" });
    expect(button).toHaveStyle({ height: "400px" });
    expect(screen.getByText("Question")).toHaveClass("text-xl");
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Retourner (recto)" })).toHaveAttribute("aria-pressed", "true");
  });
  it("handles duplicate words independently, removal, verification and reset", () => {
    render(<DragWordsBlockViewer content={{ text: "Le *chat* aime le *chat*." }} />);
    expect(screen.getByText("Glissez chaque mot dans la bonne case")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Choisir chat" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Case 1" }));
    expect(screen.getAllByRole("button", { name: "Choisir chat" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Retirer chat de la case" }));
    expect(screen.getAllByRole("button", { name: "Choisir chat" })).toHaveLength(2);
    for (let idx = 1; idx <= 2; idx++) {
      fireEvent.click(screen.getAllByRole("button", { name: "Choisir chat" })[0]);
      fireEvent.click(screen.getByRole("button", { name: `Case ${idx}` }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Vérifier" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 / 2 corrects");
    expect(screen.getAllByLabelText("Correct")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Retirer chat de la case" })[0]);
    expect(screen.queryByText("2 / 2 corrects")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recommencer" }));
    expect(screen.getAllByRole("button", { name: "Choisir chat" })).toHaveLength(2);
  });
  it("renders preview HTML with no allow-scripts", () => {
    render(<HtmlEmbedBlockViewer previewMode content={{ html: '<style>p{color:red}</style><p>OK</p><script>bad()</script>' }} />);
    const frame = screen.getByTitle("Contenu intégré");
    expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
    expect(frame.getAttribute("srcdoc")).toContain("<style>p{color:red}</style>");
    expect(frame.getAttribute("srcdoc")).not.toContain("bad()");
  });
});
