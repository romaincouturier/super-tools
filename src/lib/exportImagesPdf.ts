import { jsPDF } from "jspdf";

type ImageEntry = { url: string; name: string };

async function loadImage(url: string): Promise<{ data: string; w: number; h: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  const max = 2000;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { data: canvas.toDataURL("image/jpeg", 0.85), w: canvas.width, h: canvas.height };
}

export async function exportImagesToPdf(images: ImageEntry[], fileName: string): Promise<number> {
  let doc: jsPDF | null = null;
  let count = 0;
  for (const img of images) {
    let loaded;
    try {
      loaded = await loadImage(img.url);
    } catch (err) {
      console.error(`PDF export: image load failed ${img.name}`, err);
      continue;
    }
    const orientation = loaded.w > loaded.h ? "landscape" : "portrait";
    if (!doc) doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
    else doc.addPage("a4", orientation);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 10;
    const caption = 8;
    const maxW = pw - margin * 2;
    const maxH = ph - margin * 2 - caption;
    const ratio = Math.min(maxW / loaded.w, maxH / loaded.h);
    const w = loaded.w * ratio;
    const h = loaded.h * ratio;
    doc.addImage(loaded.data, "JPEG", (pw - w) / 2, margin + (maxH - h) / 2, w, h);
    doc.setFontSize(9);
    doc.text(img.name, pw / 2, ph - margin, { align: "center", maxWidth: maxW });
    count++;
  }
  if (doc) doc.save(fileName);
  return count;
}
