import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  getSupabaseClient,
} from "../_shared/mod.ts";
import { renderPagePdf } from "./renderPagePdf.ts";



interface Deliverable {
  file_name: string;
  file_url: string;
}

interface ZipEntryMeta {
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  modTime: number;
  modDate: number;
}

const encoder = new TextEncoder();

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

const updateCrc32 = (crc: number, chunk: Uint8Array): number => {
  let c = crc ^ -1;
  for (let i = 0; i < chunk.length; i++) c = crcTable[(c ^ chunk[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

const dosDateTime = (date = new Date()) => ({
  time: ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f),
  date: (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f),
});

const writeHeader = (length: number, fill: (view: DataView) => void): Uint8Array => {
  const bytes = new Uint8Array(length);
  fill(new DataView(bytes.buffer));
  return bytes;
};

const localFileHeader = (nameBytes: Uint8Array, modTime: number, modDate: number): Uint8Array => {
  const header = writeHeader(30, (view) => {
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0808, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, modTime, true);
    view.setUint16(12, modDate, true);
    view.setUint32(14, 0, true);
    view.setUint32(18, 0, true);
    view.setUint32(22, 0, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
  });
  const out = new Uint8Array(header.length + nameBytes.length);
  out.set(header);
  out.set(nameBytes, header.length);
  return out;
};

const dataDescriptor = (crc: number, size: number): Uint8Array => writeHeader(16, (view) => {
  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc, true);
  view.setUint32(8, size, true);
  view.setUint32(12, size, true);
});

const centralDirectoryHeader = (entry: ZipEntryMeta): Uint8Array => {
  const header = writeHeader(46, (view) => {
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0808, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, entry.modTime, true);
    view.setUint16(14, entry.modDate, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.size, true);
    view.setUint32(24, entry.size, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);
  });
  const out = new Uint8Array(header.length + entry.nameBytes.length);
  out.set(header);
  out.set(entry.nameBytes, header.length);
  return out;
};

const endOfCentralDirectory = (entryCount: number, centralSize: number, centralOffset: number): Uint8Array =>
  writeHeader(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, entryCount, true);
    view.setUint16(10, entryCount, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
    view.setUint16(20, 0, true);
  });

const enqueue = (controller: ReadableStreamDefaultController<Uint8Array>, bytes: Uint8Array, written: { value: number }) => {
  controller.enqueue(bytes);
  written.value += bytes.length;
};

const archiveName = (title: string | null) => {
  const safeTitle = (title || "mission").replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `livrables_${safeTitle}.zip`;
};

const normalizeEntryName = (name: string) => name.replace(/[\\/]/g, "_") || "fichier";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const mission_id = req.method === "GET"
      ? new URL(req.url).searchParams.get("mission_id")
      : (await req.json()).mission_id;
    if (!mission_id) return createErrorResponse("mission_id is required", 400);

    const supabase = getSupabaseClient();

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id, title")
      .eq("id", mission_id)
      .single();
    if (missionError || !mission) return createErrorResponse("Mission not found", 404);

    const [
      { data: docs, error: docsError },
      { data: media, error: mediaError },
      { data: pages, error: pagesError },
    ] = await Promise.all([
      supabase
        .from("mission_documents")
        .select("file_name, file_url")
        .eq("mission_id", mission_id)
        .eq("is_deliverable", true),
      supabase
        .from("media")
        .select("file_name, file_url")
        .eq("source_type", "mission")
        .eq("source_id", mission_id)
        .eq("is_deliverable", true),
      supabase
        .from("mission_pages")
        .select("id, title, content, created_at")
        .eq("mission_id", mission_id)
        .eq("is_deliverable", true)
        .order("created_at", { ascending: true }),
    ]);

    if (docsError) return createErrorResponse(`Documents query failed: ${docsError.message}`, 500);
    if (mediaError) return createErrorResponse(`Media query failed: ${mediaError.message}`, 500);
    if (pagesError) return createErrorResponse(`Pages query failed: ${pagesError.message}`, 500);

    const deliverables: Deliverable[] = [
      ...((docs ?? []) as Deliverable[]),
      ...((media ?? []) as Deliverable[]),
    ];
    const deliverablePages = (pages ?? []) as Array<{ id: string; title: string; content: string | null }>;

    if (deliverables.length === 0 && deliverablePages.length === 0) {
      return createErrorResponse("No deliverables for this mission", 404);
    }


    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const entries: ZipEntryMeta[] = [];
        const written = { value: 0 };
        const seen = new Map<string, number>();
        const { time: modTime, date: modDate } = dosDateTime();

        try {
          for (const d of deliverables) {
            let name = normalizeEntryName(d.file_name || "fichier");
            if (seen.has(name)) {
              const n = (seen.get(name) ?? 1) + 1;
              seen.set(name, n);
              const dot = name.lastIndexOf(".");
              name = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
            } else {
              seen.set(name, 1);
            }

            const response = await fetch(d.file_url);
            if (!response.ok || !response.body) {
              console.warn(`Skipping ${name}: HTTP ${response.status}`);
              continue;
            }

            const nameBytes = encoder.encode(name);
            const offset = written.value;
            enqueue(controller, localFileHeader(nameBytes, modTime, modDate), written);

            let crc = 0;
            let size = 0;
            const reader = response.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (!value) continue;
              crc = updateCrc32(crc, value);
              size += value.length;
              enqueue(controller, value, written);
            }

            enqueue(controller, dataDescriptor(crc, size), written);
            entries.push({ nameBytes, crc, size, offset, modTime, modDate });
          }

          // Deliverable pages → generated PDFs under pages/
          for (const p of deliverablePages) {
            try {
              const pdfBytes = await renderPagePdf(p.title || "Sans titre", p.content || "");
              const safeTitle = (p.title || "page").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "page";
              let name = `pages/${safeTitle}.pdf`;
              if (seen.has(name)) {
                const n = (seen.get(name) ?? 1) + 1;
                seen.set(name, n);
                name = `pages/${safeTitle} (${n}).pdf`;
              } else {
                seen.set(name, 1);
              }

              const nameBytes = encoder.encode(name);
              const offset = written.value;
              enqueue(controller, localFileHeader(nameBytes, modTime, modDate), written);
              const crc = updateCrc32(0, pdfBytes);
              enqueue(controller, pdfBytes, written);
              enqueue(controller, dataDescriptor(crc, pdfBytes.length), written);
              entries.push({ nameBytes, crc, size: pdfBytes.length, offset, modTime, modDate });
            } catch (err) {
              console.warn(`Skipping page ${p.id} PDF generation:`, err);
            }
          }


          const centralOffset = written.value;
          for (const entry of entries) enqueue(controller, centralDirectoryHeader(entry), written);
          const centralSize = written.value - centralOffset;
          enqueue(controller, endOfCentralDirectory(entries.length, centralSize, centralOffset), written);
          controller.close();
        } catch (error) {
          console.error("ZIP stream error:", error);
          controller.error(error);
        }
      },
    });

    const fileName = archiveName(mission.title);
    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error in zip-mission-deliverables:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500,
    );
  }
});
