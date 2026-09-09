import { describe, it, expect, vi, afterEach } from "vitest";
import { streamFileToGoogleDrive, STREAM_CHUNK_BYTES } from "./drive-resumable-upload.ts";

const SESSION_URL = "https://upload.googleapis.com/session/abc";
const SOURCE_URL = "https://storage.test/signed/file.mov";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyLength: number;
}

/**
 * Simule le storage (réponses Range) et Drive (init, 308, 200) et enregistre
 * chaque appel pour vérifier le découpage.
 */
function mockFetch(options: {
  initStatus?: number;
  initLocation?: string | null;
  /** Dernier octet confirmé par Drive pour chaque PUT (index = n-ième PUT). */
  confirmedEnds?: (number | null)[];
  putStatuses?: number[];
  rangeStatus?: number;
  /** Nombre d'octets réellement renvoyés, quel que soit le Range demandé. */
  rangeBodyLength?: number;
  /** Simule une panne réseau sur l'annulation de session. */
  deleteThrows?: boolean;
}) {
  const calls: Call[] = [];
  let putIndex = 0;

  const impl = vi.fn(async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers || {}) as Record<string, string>;
    const method = init.method || "GET";
    const bodyLength = init.body instanceof Uint8Array ? init.body.length : 0;
    calls.push({ url, method, headers, bodyLength });

    if (url.includes("uploadType=resumable")) {
      const status = options.initStatus ?? 200;
      const location = options.initLocation === undefined ? SESSION_URL : options.initLocation;
      return new Response(status === 200 ? "" : "boom", {
        status,
        headers: location ? { location } : {},
      });
    }

    if (url === SOURCE_URL) {
      const status = options.rangeStatus ?? 206;
      if (status !== 206) return new Response("nope", { status });
      const [start, end] = headers.Range.replace("bytes=", "").split("-").map(Number);
      const length = options.rangeBodyLength ?? end - start + 1;
      return new Response(new Uint8Array(length), { status: 206 });
    }

    // PUT (ou DELETE d'annulation) sur la session
    if (method === "DELETE") {
      if (options.deleteThrows) throw new Error("network down");
      // 204 interdit un corps : `new Response("", ...)` lèverait une TypeError.
      return new Response(null, { status: 204 });
    }

    const status = options.putStatuses?.[putIndex] ?? 308;
    const confirmedEnd = options.confirmedEnds?.[putIndex];
    putIndex++;
    return new Response("", {
      status,
      headers:
        status === 308 && confirmedEnd !== null && confirmedEnd !== undefined
          ? { range: `bytes=0-${confirmedEnd}` }
          : {},
    });
  });

  vi.stubGlobal("fetch", impl);
  return calls;
}

const baseOptions = {
  accessToken: "token",
  fileName: "mission___img.mov",
  mimeType: "video/quicktime",
  folderId: "folder-1",
  sourceUrl: SOURCE_URL,
  deadline: Date.now() + 60_000,
  chunkBytes: 1024,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamFileToGoogleDrive", () => {
  it("découpe le fichier en chunks et ne charge jamais plus d'un chunk", async () => {
    const calls = mockFetch({ putStatuses: [308, 308, 200], confirmedEnds: [1023, 2047] });

    await streamFileToGoogleDrive({ ...baseOptions, totalSize: 2500 });

    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts.map((c) => c.headers["Content-Range"])).toEqual([
      "bytes 0-1023/2500",
      "bytes 1024-2047/2500",
      "bytes 2048-2499/2500",
    ]);
    expect(Math.max(...puts.map((c) => c.bodyLength))).toBe(1024);
  });

  it("annonce la taille totale à Drive à l'ouverture de la session", async () => {
    const calls = mockFetch({ putStatuses: [200] });

    await streamFileToGoogleDrive({ ...baseOptions, totalSize: 500 });

    const init = calls[0];
    expect(init.headers["X-Upload-Content-Length"]).toBe("500");
    expect(init.headers["X-Upload-Content-Type"]).toBe("video/quicktime");
  });

  it("reprend à l'octet réellement confirmé par Drive", async () => {
    // Drive ne confirme que 511 octets sur les 1024 envoyés.
    const calls = mockFetch({ putStatuses: [308, 200], confirmedEnds: [511] });

    await streamFileToGoogleDrive({ ...baseOptions, totalSize: 1500 });

    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts[1].headers["Content-Range"]).toBe("bytes 512-1499/1500");
  });

  it("bat le coeur entre les chunks pour garder le run actif", async () => {
    mockFetch({ putStatuses: [308, 308, 200], confirmedEnds: [1023, 2047] });
    const heartbeat = vi.fn(async () => {});

    await streamFileToGoogleDrive({
      ...baseOptions,
      totalSize: 2500,
      heartbeat,
      heartbeatIntervalMs: 0,
    });

    expect(heartbeat).toHaveBeenCalledTimes(2);
  });

  it("annule la session quand la deadline est dépassée", async () => {
    const calls = mockFetch({ putStatuses: [308], confirmedEnds: [1023] });

    await expect(
      streamFileToGoogleDrive({ ...baseOptions, totalSize: 2500, deadline: Date.now() - 1 }),
    ).rejects.toThrow(/timeout/);

    expect(calls.some((c) => c.method === "DELETE" && c.url === SESSION_URL)).toBe(true);
  });

  it("annule la session quand Drive rejette un chunk", async () => {
    const calls = mockFetch({ putStatuses: [500] });

    await expect(streamFileToGoogleDrive({ ...baseOptions, totalSize: 500 })).rejects.toThrow(
      /Drive chunk upload failed \(500\)/,
    );

    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
  });

  it("échoue si Drive n'a jamais finalisé le fichier malgré tous les octets envoyés", async () => {
    // Dernier chunk acquitté en 308 au lieu de 200 : le fichier n'existe pas.
    const calls = mockFetch({ putStatuses: [308], confirmedEnds: [1023] });

    await expect(streamFileToGoogleDrive({ ...baseOptions, totalSize: 1024 })).rejects.toThrow(
      /incomplete/,
    );

    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
  });

  it("échoue sans session si Drive refuse l'initialisation", async () => {
    const calls = mockFetch({ initStatus: 403 });

    await expect(streamFileToGoogleDrive({ ...baseOptions, totalSize: 500 })).rejects.toThrow(
      /Drive resumable init failed \(403\)/,
    );

    expect(calls).toHaveLength(1);
  });

  it("échoue si Drive accepte la session sans renvoyer son URL", async () => {
    const calls = mockFetch({ initLocation: null });

    await expect(streamFileToGoogleDrive({ ...baseOptions, totalSize: 500 })).rejects.toThrow(
      /session URL missing/,
    );

    expect(calls).toHaveLength(1);
  });

  it("échoue si la lecture Range du storage échoue", async () => {
    mockFetch({ rangeStatus: 404 });

    await expect(streamFileToGoogleDrive({ ...baseOptions, totalSize: 500 })).rejects.toThrow(
      /storage range read failed \(404\)/,
    );
  });

  it("refuse d'envoyer un chunk dont la taille ne correspond pas au Range demandé", async () => {
    // Storage qui ignore l'en-tête Range et renvoie le fichier entier : envoyer
    // ces octets sous le Content-Range annoncé corromprait le fichier Drive.
    const calls = mockFetch({ rangeBodyLength: 3000 });

    await expect(streamFileToGoogleDrive({ ...baseOptions, totalSize: 3000 })).rejects.toThrow(
      /storage range read mismatch/,
    );

    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("reprend au chunk suivant quand Drive ne renvoie pas d'en-tête range", async () => {
    const calls = mockFetch({ putStatuses: [308, 200], confirmedEnds: [null] });

    await streamFileToGoogleDrive({ ...baseOptions, totalSize: 1500 });

    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts[1].headers["Content-Range"]).toBe("bytes 1024-1499/1500");
  });

  it("ignore un octet confirmé en retrait de la position courante", async () => {
    // Drive renvoie un range plus ancien que l'offset : on continue au chunk
    // suivant plutôt que de renvoyer indéfiniment les mêmes octets.
    const calls = mockFetch({ putStatuses: [308, 308, 200], confirmedEnds: [1023, 100] });

    await streamFileToGoogleDrive({ ...baseOptions, totalSize: 2500 });

    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts[2].headers["Content-Range"]).toBe("bytes 2048-2499/2500");
  });

  it("utilise un chunk de 8 Mo par défaut", async () => {
    const calls = mockFetch({ putStatuses: [200] });

    await streamFileToGoogleDrive({
      accessToken: "token",
      fileName: "gros.mov",
      mimeType: "video/quicktime",
      folderId: "folder-1",
      sourceUrl: SOURCE_URL,
      totalSize: 20 * 1024 * 1024,
      deadline: Date.now() + 60_000,
    });

    const firstRead = calls.find((c) => c.url === SOURCE_URL);
    expect(firstRead?.headers.Range).toBe(`bytes=0-${STREAM_CHUNK_BYTES - 1}`);
  });

  it("laisse remonter l'erreur d'origine même si l'annulation de session échoue", async () => {
    mockFetch({ putStatuses: [500], deleteThrows: true });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(streamFileToGoogleDrive({ ...baseOptions, totalSize: 500 })).rejects.toThrow(
      /Drive chunk upload failed \(500\)/,
    );

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
