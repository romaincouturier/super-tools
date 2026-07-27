/**
 * Extraction de contenu lisible depuis un fichier stocké (PDF, Word, Excel,
 * texte, image), pour exposer les documents à un modèle.
 *
 * Stratégie par type :
 *   - texte / CSV        → texte brut
 *   - PDF avec texte     → texte extrait
 *   - PDF scanné         → images JPEG embarquées (lecture par vision)
 *   - Excel (xlsx)       → feuilles converties en CSV
 *   - Word (docx)        → texte des paragraphes
 *   - image              → image telle quelle
 */

export interface ExtractedPart {
  kind: "text" | "image";
  /** kind = "text" */
  text?: string;
  /** kind = "image" : base64 */
  data?: string;
  mimeType?: string;
}

export interface ExtractionResult {
  parts: ExtractedPart[];
  /** Résumé de ce qui a été fait, destiné au modèle. */
  note: string;
}

/** Seuil en deçà duquel un PDF est considéré comme scanné (pas de texte utile). */
const PDF_TEXT_MIN_CHARS = 300;
/** Plafond de pages-images renvoyées pour un PDF scanné. */
const MAX_PDF_IMAGES = 10;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Décode les octets en latin1 pour pouvoir chercher des motifs sans perdre d'octets. */
function toLatin1(bytes: Uint8Array): string {
  let raw = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    raw += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return raw;
}

// ── PDF ──────────────────────────────────────────────────────

/** Texte des blocs BT..ET (ne fonctionne que sur les flux non compressés). */
function extractPdfText(raw: string): string {
  const out: string[] = [];
  const btEt = /BT\s([\s\S]*?)ET/g;
  let block: RegExpExecArray | null;
  while ((block = btEt.exec(raw)) !== null) {
    const strings = /\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|TJ|')/g;
    let s: RegExpExecArray | null;
    while ((s = strings.exec(block[1])) !== null) {
      const decoded = s[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (decoded.trim()) out.push(decoded.trim());
    }
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Images JPEG embarquées d'un PDF scanné. Les scanners encodent les pages en
 * DCTDecode (JPEG) : on récupère les octets entre les marqueurs SOI et EOI qui
 * suivent chaque déclaration, sans dépendre d'un parseur PDF complet.
 */
function extractPdfJpegs(bytes: Uint8Array, raw: string): Uint8Array[] {
  const images: Uint8Array[] = [];
  let searchFrom = 0;
  while (images.length < MAX_PDF_IMAGES) {
    const marker = raw.indexOf("/DCTDecode", searchFrom);
    if (marker === -1) break;
    const streamAt = raw.indexOf("stream", marker);
    if (streamAt === -1) break;
    // SOI JPEG (FFD8FF) après le mot-clé stream
    let start = -1;
    for (let i = streamAt; i < Math.min(streamAt + 64, bytes.length - 2); i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
        start = i;
        break;
      }
    }
    if (start === -1) {
      searchFrom = streamAt + 6;
      continue;
    }
    // EOI JPEG (FFD9)
    let end = -1;
    for (let i = start + 2; i < bytes.length - 1; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
        end = i + 2;
        break;
      }
    }
    if (end === -1) break;
    const slice = bytes.subarray(start, end);
    if (slice.length > 1024 && slice.length <= MAX_IMAGE_BYTES) {
      images.push(slice);
    }
    searchFrom = end;
  }
  return images;
}

// ── Office ───────────────────────────────────────────────────

async function unzipEntry(bytes: Uint8Array, nameMatch: RegExp): Promise<Map<string, string>> {
  const { unzipSync, strFromU8 } = await import("https://esm.sh/fflate@0.8.2");
  const files = unzipSync(bytes);
  const out = new Map<string, string>();
  for (const [name, content] of Object.entries(files)) {
    if (nameMatch.test(name)) out.set(name, strFromU8(content as Uint8Array));
  }
  return out;
}

function xmlText(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Texte des paragraphes d'un .docx. */
async function extractDocx(bytes: Uint8Array): Promise<string> {
  const entries = await unzipEntry(bytes, /^word\/document\.xml$/);
  const xml = entries.get("word/document.xml");
  if (!xml) return "";
  const paragraphs = xmlText(xml, "w:p").map((p) =>
    xmlText(p, "w:t").map(decodeXmlEntities).join("").trim()
  );
  return paragraphs.filter(Boolean).join("\n").trim();
}

/** Feuilles d'un .xlsx converties en CSV (une section par feuille). */
async function extractXlsx(bytes: Uint8Array): Promise<string> {
  const entries = await unzipEntry(bytes, /^xl\/(worksheets\/sheet\d+\.xml|sharedStrings\.xml|workbook\.xml)$/);

  const shared: string[] = [];
  const sharedXml = entries.get("xl/sharedStrings.xml");
  if (sharedXml) {
    for (const si of xmlText(sharedXml, "si")) {
      shared.push(decodeXmlEntities(xmlText(si, "t").join("")).trim());
    }
  }

  const sheetNames: string[] = [];
  const workbookXml = entries.get("xl/workbook.xml");
  if (workbookXml) {
    const re = /<sheet[^>]*name="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(workbookXml)) !== null) sheetNames.push(decodeXmlEntities(m[1]));
  }

  const sections: string[] = [];
  const sheetKeys = [...entries.keys()]
    .filter((k) => k.startsWith("xl/worksheets/"))
    .sort();

  sheetKeys.forEach((key, idx) => {
    const xml = entries.get(key)!;
    const lines: string[] = [];
    for (const row of xmlText(xml, "row")) {
      const cells: string[] = [];
      const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
      let c: RegExpExecArray | null;
      while ((c = cellRe.exec(row)) !== null) {
        const attrs = c[1] ?? c[3] ?? "";
        const body = c[2] ?? "";
        const type = /t="([^"]*)"/.exec(attrs)?.[1];
        let value = "";
        if (type === "s") {
          const i = Number.parseInt(xmlText(body, "v").join("") || "-1", 10);
          value = shared[i] ?? "";
        } else if (type === "inlineStr") {
          value = decodeXmlEntities(xmlText(body, "t").join(""));
        } else {
          value = decodeXmlEntities(xmlText(body, "v").join(""));
        }
        cells.push(value.replace(/"/g, '""'));
      }
      if (cells.some((v) => v !== "")) {
        lines.push(cells.map((v) => (v.includes(",") || v.includes("\n") ? `"${v}"` : v)).join(","));
      }
    }
    if (lines.length) {
      sections.push(`--- Feuille : ${sheetNames[idx] ?? key} ---\n${lines.join("\n")}`);
    }
  });

  return sections.join("\n\n").trim();
}

// ── Point d'entrée ───────────────────────────────────────────

export async function extractDocument(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string,
): Promise<ExtractionResult> {
  const mime = (mimeType || "").toLowerCase();

  if (mime.startsWith("image/")) {
    if (bytes.length > MAX_IMAGE_BYTES) {
      return { parts: [], note: `Image trop lourde (${Math.round(bytes.length / 1024)} Ko).` };
    }
    return {
      parts: [{ kind: "image", data: bytesToBase64(bytes), mimeType: mime }],
      note: `Image ${fileName}.`,
    };
  }

  if (mime === "text/plain" || mime === "text/csv" || mime === "application/json") {
    return {
      parts: [{ kind: "text", text: new TextDecoder().decode(bytes) }],
      note: `Contenu texte de ${fileName}.`,
    };
  }

  if (mime === "application/pdf") {
    const raw = toLatin1(bytes);
    const text = extractPdfText(raw);
    if (text.length >= PDF_TEXT_MIN_CHARS) {
      return { parts: [{ kind: "text", text }], note: `Texte extrait de ${fileName}.` };
    }
    const images = extractPdfJpegs(bytes, raw);
    if (images.length) {
      return {
        parts: images.map((img) => ({
          kind: "image" as const,
          data: bytesToBase64(img),
          mimeType: "image/jpeg",
        })),
        note:
          `${fileName} est un PDF sans texte extractible (scan) : ${images.length} page(s) ` +
          `renvoyée(s) en image, à lire visuellement.`,
      };
    }
    return {
      parts: text ? [{ kind: "text", text }] : [],
      note:
        `${fileName} : PDF dont le texte n'est pas extractible et dont les pages n'ont pas pu ` +
        `être récupérées en image. Fournir le fichier manuellement si son contenu est nécessaire.`,
    };
  }

  if (mime.includes("spreadsheetml") || fileName.toLowerCase().endsWith(".xlsx")) {
    const csv = await extractXlsx(bytes);
    return {
      parts: csv ? [{ kind: "text", text: csv }] : [],
      note: csv ? `Feuilles de ${fileName} converties en CSV.` : `${fileName} : aucune donnée lisible.`,
    };
  }

  if (mime.includes("wordprocessingml") || fileName.toLowerCase().endsWith(".docx")) {
    const text = await extractDocx(bytes);
    return {
      parts: text ? [{ kind: "text", text }] : [],
      note: text ? `Texte de ${fileName}.` : `${fileName} : aucun texte lisible.`,
    };
  }

  return {
    parts: [],
    note: `Type non pris en charge pour la lecture : ${mime || "inconnu"} (${fileName}).`,
  };
}
