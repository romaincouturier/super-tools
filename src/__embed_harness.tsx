import { createElement } from "react";
import { createRoot } from "react-dom/client";
import HtmlEmbedBlockViewer from "@/components/lms/blocks/viewers/HtmlEmbedBlockViewer";
export function mount(el: HTMLElement, html: string) { createRoot(el).render(createElement(HtmlEmbedBlockViewer, { content: { html } as never })); }
