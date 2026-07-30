/**
 * Tests de saveMissionDocument — la deuxième (et dernière) écriture du serveur
 * MCP, strictement additive.
 *
 * Invariants vérifiés ici :
 *   1. Allowlist de types : tout ce qui n'est pas PNG/SVG/HTML/Markdown/PDF est refusé.
 *   2. Plafond de taille : refus avec la limite annoncée en clair, avant décodage.
 *   3. Création seule : `upsert: false` et chemin horodaté — jamais d'écrasement.
 *   4. Pas d'orphelin : si l'insertion échoue, le fichier est retiré du bucket.
 *   5. La ligne écrite porte bien file_name / file_url / mime_type / file_size /
 *      is_deliverable / processing_status = 'none'.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubGlobal("Deno", { env: { get: () => undefined } });

vi.mock("./mod.ts", () => ({ getSupabaseClient: () => ({}) }));
vi.mock("./document-extract.ts", () => ({ extractDocument: vi.fn() }));

const { getMissionDossier, saveMissionDocument, DOCUMENT_MAX_BYTES, DOCUMENT_MIME_ALLOWLIST } =
  await import("./mission-tools.ts");

// ── Faux client Supabase ──────────────────────────────────────────────────

const mockUpload = vi.fn();
const mockRemove = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockInsertSingle = vi.fn();
const mockMissionRow = vi.fn();

function makeSupabase() {
  const insert = vi.fn(() => ({ select: () => ({ single: mockInsertSingle }) }));
  const from = vi.fn((table: string) => {
    if (table === "missions") {
      return {
        select: () => ({ eq: () => ({ maybeSingle: mockMissionRow }) }),
      };
    }
    if (table === "mission_documents") return { insert };
    throw new Error(`table inattendue: ${table}`);
  });
  return {
    client: {
      from,
      storage: {
        from: vi.fn(() => ({
          upload: mockUpload,
          remove: mockRemove,
          getPublicUrl: mockGetPublicUrl,
        })),
      },
    },
    insert,
    from,
  };
}

/**
 * Client de lecture pour getMissionDossier : chaque table renvoie son résultat,
 * quel que soit l'enchaînement select/eq/order/limit.
 */
function dossierClient(rows: {
  mission: Record<string, unknown>;
  documents?: Array<Record<string, unknown>>;
}) {
  const results: Record<string, { data: unknown; count?: number }> = {
    missions: { data: [rows.mission] },
    mission_pages: { data: [] },
    mission_activities: { data: [], count: 0 },
    mission_documents: { data: rows.documents ?? [], count: (rows.documents ?? []).length },
    media: { data: [], count: 0 },
  };
  return {
    from: (table: string) => {
      const result = results[table] ?? { data: [], count: 0 };
      const chain: Record<string, unknown> = {
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(ok, ko),
        maybeSingle: async () => ({ data: (result.data as unknown[])[0] ?? null }),
      };
      for (const method of ["select", "eq", "ilike", "order", "limit"]) {
        chain[method] = () => chain;
      }
      return chain;
    },
  };
}

const MISSION_ID = "11111111-2222-3333-4444-555555555555";
const audit = vi.fn(async () => {});

/** PNG 1x1 valide, suffisant pour vérifier le chemin nominal. */
const PNG_1PX_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** base64 d'un contenu de `size` octets. */
function base64OfSize(size: number): string {
  return btoa("A".repeat(size));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMissionRow.mockResolvedValue({ data: { id: MISSION_ID, title: "Atelier Acme" } });
  mockUpload.mockResolvedValue({ error: null });
  mockRemove.mockResolvedValue({ data: null, error: null });
  mockGetPublicUrl.mockReturnValue({
    data: { publicUrl: "https://cdn.example.com/storage/v1/object/public/mission-documents/doc.png" },
  });
  mockInsertSingle.mockResolvedValue({ data: { id: "doc-1" }, error: null });
});

describe("saveMissionDocument", () => {
  it("téléverse un PNG et crée la ligne mission_documents", async () => {
    const { client, insert } = makeSupabase();
    // ~500 Ko décodés, le format de livrable visé.
    const png = base64OfSize(500 * 1024);

    const out = JSON.parse(
      await saveMissionDocument(
        client as never,
        MISSION_ID,
        "Parcours client.png",
        "image/png",
        png,
        true,
        "Schéma produit pendant l'atelier",
        audit,
      ),
    );

    expect(out.id).toBe("doc-1");
    expect(out.file_size).toBe(500 * 1024);
    expect(out.file_url).toContain("mission-documents");

    // Chemin : {mission_id}/docs/{timestamp}_{slug}, comme l'upload de l'app.
    const [path, body, opts] = mockUpload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${MISSION_ID}/docs/\\d+_parcours_client\\.png$`));
    expect(body).toBeInstanceOf(Uint8Array);
    expect((body as Uint8Array).length).toBe(500 * 1024);
    expect(opts).toEqual({ contentType: "image/png", upsert: false });

    expect(insert).toHaveBeenCalledWith({
      mission_id: MISSION_ID,
      file_name: "Parcours client.png",
      file_url: "https://cdn.example.com/storage/v1/object/public/mission-documents/doc.png",
      mime_type: "image/png",
      file_size: 500 * 1024,
      is_deliverable: true,
      processing_status: "none",
    });

    // La description n'a pas de colonne : elle part dans l'audit.
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][0]).toContain("Schéma produit pendant l'atelier");
    expect(audit.mock.calls[0][0]).toContain("Atelier Acme");
  });

  it("décode un vrai PNG base64 sans l'altérer", async () => {
    const { client } = makeSupabase();
    await saveMissionDocument(
      client as never,
      MISSION_ID,
      "pixel.png",
      "image/png",
      PNG_1PX_BASE64,
      true,
      "",
      audit,
    );
    const bytes = mockUpload.mock.calls[0][1] as Uint8Array;
    // Signature PNG : 89 50 4E 47
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("accepte un SVG et un préfixe data:", async () => {
    const { client, insert } = makeSupabase();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>';

    await saveMissionDocument(
      client as never,
      MISSION_ID,
      "schéma étape 1.svg",
      "image/svg+xml",
      `data:image/svg+xml;base64,${btoa(svg)}`,
      false,
      "",
      audit,
    );

    const [path, body, opts] = mockUpload.mock.calls[0];
    // Accents et espaces normalisés dans le chemin, nom d'origine conservé en base.
    expect(path).toMatch(new RegExp(`^${MISSION_ID}/docs/\\d+_schema_etape_1\\.svg$`));
    expect(new TextDecoder().decode(body as Uint8Array)).toBe(svg);
    expect(opts.contentType).toBe("image/svg+xml");
    expect(insert.mock.calls[0][0]).toMatchObject({
      file_name: "schéma étape 1.svg",
      is_deliverable: false,
    });
  });

  it("accepte tous les types de l'allowlist", async () => {
    for (const mime of DOCUMENT_MIME_ALLOWLIST) {
      const { client } = makeSupabase();
      await expect(
        saveMissionDocument(client as never, MISSION_ID, `f.bin`, mime, btoa("x"), true, "", audit),
      ).resolves.toContain('"saved":true');
    }
  });

  it("refuse un mime hors allowlist sans rien téléverser", async () => {
    const { client } = makeSupabase();
    await expect(
      saveMissionDocument(
        client as never,
        MISSION_ID,
        "archive.zip",
        "application/zip",
        btoa("PK"),
        true,
        "",
        audit,
      ),
    ).rejects.toThrow(/Type de fichier refusé.*application\/zip.*image\/png/s);
    expect(mockUpload).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("refuse un fichier trop gros en annonçant la limite", async () => {
    const { client } = makeSupabase();
    await expect(
      saveMissionDocument(
        client as never,
        MISSION_ID,
        "gros.png",
        "image/png",
        base64OfSize(DOCUMENT_MAX_BYTES + 1024),
        true,
        "",
        audit,
      ),
    ).rejects.toThrow(/trop lourd.*limite 3072 Ko soit 3 Mo/s);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("accepte un fichier juste sous la limite", async () => {
    const { client } = makeSupabase();
    await expect(
      saveMissionDocument(
        client as never,
        MISSION_ID,
        "limite.png",
        "image/png",
        base64OfSize(DOCUMENT_MAX_BYTES),
        true,
        "",
        audit,
      ),
    ).resolves.toContain('"saved":true');
  });

  it("refuse un mission_id qui n'est pas un UUID, ou une mission inexistante", async () => {
    const { client } = makeSupabase();
    await expect(
      saveMissionDocument(client as never, "mission Acme", "a.png", "image/png", btoa("x"), true, "", audit),
    ).rejects.toThrow(/UUID/);

    mockMissionRow.mockResolvedValue({ data: null });
    await expect(
      saveMissionDocument(client as never, MISSION_ID, "a.png", "image/png", btoa("x"), true, "", audit),
    ).rejects.toThrow(/Mission introuvable/);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("refuse un base64 invalide ou vide", async () => {
    const { client } = makeSupabase();
    await expect(
      saveMissionDocument(client as never, MISSION_ID, "a.png", "image/png", "€€€ pas du base64", true, "", audit),
    ).rejects.toThrow(/base64 valide/);
    await expect(
      saveMissionDocument(client as never, MISSION_ID, "a.png", "image/png", "", true, "", audit),
    ).rejects.toThrow(/vide/);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("retire le fichier du bucket quand l'insertion échoue", async () => {
    const { client } = makeSupabase();
    mockInsertSingle.mockResolvedValue({ data: null, error: { message: "violation RLS" } });

    await expect(
      saveMissionDocument(client as never, MISSION_ID, "a.png", "image/png", PNG_1PX_BASE64, true, "", audit),
    ).rejects.toThrow(/violation RLS/);

    const uploadedPath = mockUpload.mock.calls[0][0];
    expect(mockRemove).toHaveBeenCalledWith([uploadedPath]);
  });

  it("n'insère rien quand le storage refuse l'écriture", async () => {
    const { client, insert } = makeSupabase();
    mockUpload.mockResolvedValue({ error: { message: "The resource already exists" } });

    await expect(
      saveMissionDocument(client as never, MISSION_ID, "a.png", "image/png", PNG_1PX_BASE64, true, "", audit),
    ).rejects.toThrow(/Upload impossible.*already exists/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("écrit une ligne que get_mission_dossier sait lister", async () => {
    // Non-régression du chemin de lecture : le document créé par le tool doit
    // ressortir du dossier avec son id (c'est lui qu'on passe à read_document)
    // et son URL publique.
    const { client, insert } = makeSupabase();
    await saveMissionDocument(
      client as never,
      MISSION_ID,
      "livrable.pdf",
      "application/pdf",
      btoa("%PDF-1.4"),
      true,
      "",
      audit,
    );
    const written = insert.mock.calls[0][0] as Record<string, unknown>;

    const dossier = JSON.parse(
      await getMissionDossier(
        dossierClient({
          mission: { id: MISSION_ID, title: "Atelier Acme" },
          documents: [{ id: "doc-1", created_at: "2026-07-30T10:00:00Z", ...written }],
        }) as never,
        MISSION_ID,
        audit,
      ),
    );

    expect(dossier.found).toBe(true);
    expect(dossier.documents_total).toBe(1);
    expect(dossier.documents[0]).toMatchObject({
      id: "doc-1",
      file_name: "livrable.pdf",
      mime_type: "application/pdf",
      file_url: written.file_url,
      is_deliverable: true,
      processing_status: "none",
    });
    expect(dossier.hint).toContain("read_document");
  });

  it("ne peut jamais viser deux fois le même objet de storage", async () => {
    const { client } = makeSupabase();
    for (let i = 0; i < 2; i++) {
      await saveMissionDocument(
        client as never,
        MISSION_ID,
        "meme-nom.png",
        "image/png",
        PNG_1PX_BASE64,
        true,
        "",
        audit,
      );
    }
    // upsert: false sur les deux appels — une collision de chemin échouerait
    // au lieu d'écraser le fichier existant.
    expect(mockUpload.mock.calls.every(([, , opts]) => opts.upsert === false)).toBe(true);
  });
});
