// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import RevealBlockViewer, { type RevealItem } from "./RevealBlockViewer";
import type { RevealBlockContent } from "@/types/lms-blocks";

afterEach(cleanup);

const items: RevealItem[] = [
  { id: "a", type: "key_points", element: <p>À retenir</p> },
  { id: "b", type: "exercise", element: <p>Exercice</p> },
  { id: "c", type: "text", element: <p>Bloc générique</p> },
];

const content: RevealBlockContent = { button_label: "Révéler la suite" };

describe("RevealBlockViewer", () => {
  it("hides every child until the button is clicked", () => {
    render(<RevealBlockViewer content={content} items={items} />);
    for (const el of screen.getAllByText(/À retenir|Exercice|Bloc générique/)) {
      expect(el.closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("uses the contextual label of the next block and reveals one at a time", () => {
    render(<RevealBlockViewer content={content} items={items} />);
    const button = () => screen.getByRole("button");

    expect(button()).toHaveTextContent("Voir les points clés");
    fireEvent.click(button());
    expect(screen.getByText("À retenir").closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByText("Exercice").closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true");

    expect(button()).toHaveTextContent("Passer à l'exercice");
    fireEvent.click(button());
    expect(button()).toHaveTextContent("Révéler la suite");
    fireEvent.click(button());

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Bloc générique").closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "false");
  });

  it("keeps a 'Masquer' toggle when collapsible and collapses back", () => {
    const collapsible: RevealBlockContent = { button_label: "Révéler la suite", collapsible: true };
    render(<RevealBlockViewer content={collapsible} items={[items[0]]} />);
    const button = () => screen.getByRole("button");

    fireEvent.click(button());
    expect(button()).toHaveTextContent("Masquer");
    fireEvent.click(button());
    expect(button()).toHaveTextContent("Voir les points clés");
    expect(screen.getByText("À retenir").closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders nothing without children", () => {
    const { container } = render(<RevealBlockViewer content={content} items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
