import { jsPDF } from "jspdf";
import { marked, type Token } from "marked";
import logo from "@/assets/supertilt-logo-anthracite.jpg";

type PdfLine = { text: string; size: number; bold: boolean; gap: number; indent: number };

function plainInline(text: string): string {
  return marked.lexer(text).map(token => "text" in token ? String(token.text) : "").join(" ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/<[^>]*>/g, "");
}

export function regulationPdfBlocks(markdown: string): PdfLine[] {
  const lines: PdfLine[] = [];
  const visit = (tokens: Token[], indent = 0) => {
    for (const token of tokens) {
      if (token.type === "heading") lines.push({ text: plainInline(token.text), size: token.depth < 3 ? 13 : 11, bold: true, gap: 5, indent });
      else if (token.type === "list") token.items.forEach((item, i) => {
        lines.push({ text: `${token.ordered ? `${Number(token.start) + i}.` : "•"} ${plainInline(item.text)}`, size: 10, bold: false, gap: 1, indent: indent + 4 });
      });
      else if (token.type === "blockquote") visit(token.tokens, indent + 4);
      else if (token.type === "paragraph" || token.type === "text" || token.type === "code") lines.push({ text: plainInline(token.text), size: 10, bold: false, gap: 3, indent });
      else if (token.type === "table") {
        lines.push({ text: token.header.map(cell => plainInline(cell.text)).join(" | "), size: 10, bold: true, gap: 3, indent });
        token.rows.forEach(row => lines.push({ text: row.map(cell => plainInline(cell.text)).join(" | "), size: 10, bold: false, gap: 3, indent }));
      }
    }
  };
  visit(marked.lexer(markdown));
  return lines;
}

function imageData(): Promise<{ data: string; ratio: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Impossible de préparer le logo")); return; }
      ctx.drawImage(img, 0, 0);
      resolve({ data: canvas.toDataURL("image/jpeg"), ratio: img.naturalHeight / img.naturalWidth });
    };
    img.onerror = () => reject(new Error("Impossible de charger le logo SuperTilt"));
    img.src = logo;
  });
}

function tokenRgb(className: string): [number, number, number] {
  const el = document.createElement("span");
  el.className = className;
  document.body.append(el);
  const color = getComputedStyle(el).color.match(/[\d.]+/g)?.map(Number);
  el.remove();
  if (!color || color.length < 3) throw new Error("Charte du document indisponible");
  return [color[0], color[1], color[2]];
}

export async function generateRegulationPdf(markdown: string, date: string): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const brand = await imageData();
  const accent = tokenRgb("text-primary");
  const ink = tokenRgb("text-foreground");
  const muted = tokenRgb("text-muted-foreground");
  let y = 49;
  const header = () => {
    doc.addImage(brand.data, "JPEG", 18, 10, 35, 35 * brand.ratio);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("Règlement intérieur", 18, 33);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Formations professionnelles", 18, 40);
    doc.setDrawColor(...accent);
    doc.setLineWidth(1);
    doc.line(18, 44, 192, 44);
  };
  header();
  for (const block of regulationPdfBlocks(markdown)) {
    doc.setFont("helvetica", block.bold ? "bold" : "normal");
    doc.setFontSize(block.size);
    const wrapped: string[] = doc.splitTextToSize(block.text, 174 - block.indent);
    const lineHeight = block.size * 0.48;
    if (y + block.gap + lineHeight * Math.min(wrapped.length, block.bold ? 3 : 2) > 274) {
      doc.addPage(); header(); y = 49;
    }
    y += block.gap;
    for (const line of wrapped) {
      if (y + lineHeight > 274) { doc.addPage(); header(); y = 52; }
      doc.setTextColor(...ink);
      doc.setFont("helvetica", block.bold ? "bold" : "normal");
      doc.setFontSize(block.size);
      doc.text(line, 18 + block.indent, y);
      y += lineHeight;
    }
  }
  const pages = doc.getNumberOfPages();
  const parisDate = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long" }).format(new Date(date));
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`SuperTilt · Édition du ${parisDate}`, 18, 285);
    doc.text(`${page} / ${pages}`, 192, 285, { align: "right" });
  }
  doc.setProperties({ title: "Règlement intérieur des formations – SuperTilt", author: "SuperTilt" });
  return doc.output("blob");
}