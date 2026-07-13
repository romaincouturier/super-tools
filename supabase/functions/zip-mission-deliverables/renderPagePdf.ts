// Minimal HTML → PDF renderer for mission pages.
// Uses pdf-lib (no headless browser). Supports headings, paragraphs, lists,
// images (fetched from URL), links (rendered underlined), and basic bold/italic
// hints via strong/em. Layout is intentionally simple: 1 column, A4 portrait.

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from "https://esm.sh/pdf-lib@1.17.1";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const PAGE_WIDTH = 595.28; // A4 pt
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT_RATIO = 1.35;

interface Ctx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN) newPage(ctx);
}

function pickFont(ctx: Ctx, opts: { bold?: boolean; italic?: boolean }): PDFFont {
  if (opts.bold && opts.italic) return ctx.boldItalic;
  if (opts.bold) return ctx.bold;
  if (opts.italic) return ctx.italic;
  return ctx.font;
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, " ").split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? current + " " + w : w;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawText(
  ctx: Ctx,
  text: string,
  opts: { size?: number; bold?: boolean; italic?: boolean; color?: [number, number, number]; indent?: number } = {},
) {
  const size = opts.size ?? 11;
  const font = pickFont(ctx, opts);
  const color = opts.color ?? [0.1, 0.1, 0.15];
  const indent = opts.indent ?? 0;
  const lineHeight = size * LINE_HEIGHT_RATIO;
  const lines = wrapLines(text, font, size, CONTENT_WIDTH - indent);
  for (const line of lines) {
    ensureSpace(ctx, lineHeight);
    ctx.y -= lineHeight;
    ctx.page.drawText(line, {
      x: MARGIN + indent,
      y: ctx.y,
      size,
      font,
      color: rgb(color[0], color[1], color[2]),
    });
  }
}

function spacer(ctx: Ctx, amount = 6) {
  ctx.y -= amount;
}

async function drawImage(ctx: Ctx, src: string) {
  try {
    if (src.startsWith("data:")) return; // skip inline base64 to avoid huge PDFs
    const res = await fetch(src);
    if (!res.ok) return;
    const contentType = res.headers.get("content-type") || "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    let img;
    if (contentType.includes("png") || /\.png(\?|$)/i.test(src)) {
      img = await ctx.pdf.embedPng(bytes);
    } else if (contentType.includes("jpeg") || contentType.includes("jpg") || /\.(jpe?g)(\?|$)/i.test(src)) {
      img = await ctx.pdf.embedJpg(bytes);
    } else {
      return; // unsupported (svg, webp) — skip
    }
    const maxW = CONTENT_WIDTH;
    const maxH = PAGE_HEIGHT - MARGIN * 2;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    ensureSpace(ctx, h + 6);
    ctx.y -= h;
    ctx.page.drawImage(img, { x: MARGIN, y: ctx.y, width: w, height: h });
    spacer(ctx, 6);
  } catch (err) {
    console.warn("Image embed failed:", src, err);
  }
}

// Convert an inline element subtree to a flat plain-text string (styles ignored).
function inlineText(el: any): string {
  if (!el) return "";
  if (el.nodeType === 3) return el.textContent || "";
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "br") return "\n";
  let out = "";
  for (const c of el.childNodes) out += inlineText(c);
  return out;
}

async function walk(ctx: Ctx, el: any, listMarker?: string): Promise<void> {
  if (!el) return;
  if (el.nodeType === 3) {
    const text = (el.textContent || "").trim();
    if (text) drawText(ctx, text);
    return;
  }
  if (el.nodeType !== 1) return;
  const tag = (el.tagName || "").toLowerCase();

  switch (tag) {
    case "h1":
      spacer(ctx, 8);
      drawText(ctx, inlineText(el), { size: 20, bold: true });
      spacer(ctx, 4);
      return;
    case "h2":
      spacer(ctx, 6);
      drawText(ctx, inlineText(el), { size: 16, bold: true });
      spacer(ctx, 3);
      return;
    case "h3":
      spacer(ctx, 5);
      drawText(ctx, inlineText(el), { size: 13, bold: true });
      spacer(ctx, 2);
      return;
    case "h4":
    case "h5":
    case "h6":
      spacer(ctx, 4);
      drawText(ctx, inlineText(el), { size: 12, bold: true });
      spacer(ctx, 2);
      return;
    case "p":
    case "div":
    case "summary":
    case "blockquote": {
      const text = inlineText(el).trim();
      if (text) {
        if (tag === "blockquote") {
          drawText(ctx, text, { italic: true, indent: 12, color: [0.35, 0.35, 0.4] });
        } else {
          drawText(ctx, text);
        }
        spacer(ctx, 4);
      }
      // Still walk children for nested images
      for (const c of el.childNodes) {
        if (c.nodeType === 1 && (c.tagName || "").toLowerCase() === "img") {
          await drawImage(ctx, c.getAttribute("src") || "");
        }
      }
      return;
    }
    case "ul":
    case "ol": {
      let i = 1;
      for (const c of el.childNodes) {
        if (c.nodeType === 1 && (c.tagName || "").toLowerCase() === "li") {
          const marker = tag === "ol" ? `${i}. ` : "• ";
          const text = inlineText(c).trim();
          if (text) drawText(ctx, marker + text, { indent: 12 });
          i++;
        }
      }
      spacer(ctx, 4);
      return;
    }
    case "img":
      await drawImage(ctx, el.getAttribute("src") || "");
      return;
    case "hr":
      ensureSpace(ctx, 12);
      ctx.y -= 6;
      ctx.page.drawLine({
        start: { x: MARGIN, y: ctx.y },
        end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.75),
      });
      ctx.y -= 6;
      return;
    case "table": {
      // Very basic table: render each row as a line
      for (const row of el.querySelectorAll("tr")) {
        const cells = Array.from(row.querySelectorAll("th,td")).map((c: any) => inlineText(c).trim());
        drawText(ctx, cells.join(" | "));
      }
      spacer(ctx, 4);
      return;
    }
    case "figure":
    case "details":
    case "section":
    case "article":
      for (const c of el.childNodes) await walk(ctx, c);
      return;
    default:
      // Fallback: recurse into children
      for (const c of el.childNodes) await walk(ctx, c);
  }
}

export async function renderPagePdf(title: string, html: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const boldItalic = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);

  const ctx: Ctx = {
    pdf,
    page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
    font,
    bold,
    italic,
    boldItalic,
  };

  // Title
  drawText(ctx, title || "Sans titre", { size: 22, bold: true });
  spacer(ctx, 10);

  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<!doctype html><html><body><div id="root">${html || ""}</div></body></html>`,
    "text/html",
  );
  const root = doc?.getElementById("root");
  if (root) {
    for (const child of root.childNodes) await walk(ctx, child);
  }


  return await pdf.save();
}
