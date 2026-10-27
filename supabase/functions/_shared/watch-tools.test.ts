/**
 * Tests de saveWatchItem / listWatchItems — l'écriture du serveur MCP dans le
 * module Veille, utilisée par un agent qui publie sa veille tous les jours.
 *
 * Invariants vérifiés ici :
 *   1. Un doublon n'écrit rien : même URL, ou contenu sémantiquement quasi
 *      identique. L'élément existant est rendu à la place.
 *   2. L'URL exacte est testée AVANT l'embedding : un doublon évident ne coûte
 *      pas un appel OpenAI.
 *   3. L'embedding calculé pour la détection est celui qui est stocké — jamais
 *      deux appels facturés pour un seul dépôt.
 *   4. La ligne écrite porte content_type / source_url / tags normalisés /
 *      created_by, et rien d'autre n'est touché.
 *   5. Les plafonds (body, comment) refusent en annonçant la limite.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubGlobal("Deno", { env: { get: () => undefined } });

const { embedTextMock } = vi.hoisted(() => ({ embedTextMock: vi.fn() }));

vi.mock("./mod.ts", () => ({ getSupabaseClient: () => ({}) }));
vi.mock("./embeddings.ts", () => ({ embedText: embedTextMock }));
vi.mock("./app-urls.ts", () => ({
  getAppUrls: async () => ({ app_url: "https://super-tools.test" }),
}));

const {
  saveWatchItem,
  listWatchItems,
  normalizeWatchTags,
  WATCH_BODY_MAX_CHARS,
  WATCH_COMMENT_MAX_CHARS,
} = await import("./watch-tools.ts");

// ── Faux client Supabase ──────────────────────────────────────────────────

const USER_ID = "11111111-2222-3333-4444-555555555555";
const audit = vi.fn(async () => {});

/**
 * Client minimal : une chaîne select/eq/or/overlaps/gte/order/limit
 * « thenable » qui résout le résultat configuré, et un insert qui rend la
 * ligne créée.
 */
function makeSupabase(options: {
  selectRows?: Array<Record<string, unknown>>;
  rpcRows?: Array<Record<string, unknown>>;
  inserted?: Record<string, unknown>;
  insertError?: { message: string };
} = {}) {
  const calls: Record<string, unknown[][]> = { eq: [], or: [], overlaps: [], gte: [], limit: [] };
  const insert = vi.fn(() => ({
    select: () => ({
      single: async () => ({
        data: options.inserted ?? { id: "watch-1" },
        error: options.insertError ?? null,
      }),
    }),
  }));
  const rpc = vi.fn(async () => ({ data: options.rpcRows ?? [] }));

  const chain: Record<string, unknown> = {
    then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve({ data: options.selectRows ?? [], error: null }).then(ok, ko),
  };
  for (const method of ["select", "eq", "or", "overlaps", "gte", "order", "limit"]) {
    chain[method] = (...args: unknown[]) => {
      calls[method]?.push(args);
      return chain;
    };
  }

  return {
    client: { from: vi.fn(() => ({ ...chain, insert })), rpc },
    insert,
    rpc,
    calls,
  };
}

const ARTICLE = {
  title: "Anthropic publie les agent skills",
  source_url: "https://example.com/agent-skills",
  body: "<p>Un format de dossier pour outiller un agent.</p>",
  comment: "À tester sur l'agent de veille.",
  tags: ["IA", "agents"],
};

beforeEach(() => {
  vi.clearAllMocks();
  embedTextMock.mockResolvedValue([0.1, 0.2, 0.3]);
});

describe("saveWatchItem — validation", () => {
  it("refuse un dépôt sans titre", async () => {
    const { client, insert } = makeSupabase();
    await expect(saveWatchItem(client as never, { body: "texte" }, USER_ID, audit))
      .rejects.toThrow("title est obligatoire");
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuse un dépôt sans source_url ni body", async () => {
    const { client, insert } = makeSupabase();
    await expect(saveWatchItem(client as never, { title: "Sans contenu" }, USER_ID, audit))
      .rejects.toThrow(/source_url.*body/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuse une source_url qui n'est pas une URL http(s)", async () => {
    const { client } = makeSupabase();
    for (const url of ["exemple.com/article", "ftp://exemple.com/a.txt", "javascript:alert(1)"]) {
      await expect(saveWatchItem(client as never, { title: "T", source_url: url }, USER_ID, audit))
        .rejects.toThrow("source_url doit être une URL absolue");
    }
  });

  it("annonce la limite quand le contenu la dépasse", async () => {
    const { client, insert } = makeSupabase();
    await expect(
      saveWatchItem(
        client as never,
        { title: "T", body: "a".repeat(WATCH_BODY_MAX_CHARS + 1) },
        USER_ID,
        audit,
      ),
    ).rejects.toThrow(new RegExp(String(WATCH_BODY_MAX_CHARS)));

    await expect(
      saveWatchItem(
        client as never,
        { title: "T", body: "ok", comment: "c".repeat(WATCH_COMMENT_MAX_CHARS + 1) },
        USER_ID,
        audit,
      ),
    ).rejects.toThrow(new RegExp(String(WATCH_COMMENT_MAX_CHARS)));

    expect(insert).not.toHaveBeenCalled();
  });
});

describe("saveWatchItem — dépôt", () => {
  it("écrit la ligne de veille et rend le lien de la fiche", async () => {
    const { client, insert, calls } = makeSupabase({
      inserted: { id: "watch-1", title: ARTICLE.title, tags: ["ia", "agents"] },
    });

    const out = JSON.parse(await saveWatchItem(client as never, ARTICLE, USER_ID, audit));

    expect(out.saved).toBe(true);
    expect(out.url).toBe("https://super-tools.test/veille?item=watch-1");

    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      title: ARTICLE.title,
      body: ARTICLE.body,
      comment: ARTICLE.comment,
      content_type: "url",
      source_url: ARTICLE.source_url,
      tags: ["ia", "agents"],
      is_shared: false,
      created_by: USER_ID,
    });
    // L'embedding calculé pour la déduplication est celui qui est stocké.
    expect(embedTextMock).toHaveBeenCalledTimes(1);
    expect(row.embedding).toBe(JSON.stringify([0.1, 0.2, 0.3]));

    // L'URL exacte est cherchée avant tout appel payant.
    expect(calls.eq[0]).toEqual(["source_url", ARTICLE.source_url]);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][0]).toContain(ARTICLE.title);
  });

  it("dépose un contenu sans lien en content_type text", async () => {
    const { client, insert } = makeSupabase();
    await saveWatchItem(
      client as never,
      { title: "Note de conférence", body: "Trois idées retenues.", is_shared: true },
      USER_ID,
      audit,
    );
    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.content_type).toBe("text");
    expect(row.source_url).toBeNull();
    expect(row.is_shared).toBe(true);
  });

  it("stocke la ligne même quand l'embedding n'est pas disponible", async () => {
    embedTextMock.mockResolvedValue(null);
    const { client, insert, rpc } = makeSupabase();

    const out = JSON.parse(await saveWatchItem(client as never, ARTICLE, USER_ID, audit));

    expect(out.saved).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
    expect(insert.mock.calls[0][0]).not.toHaveProperty("embedding");
  });
});

describe("saveWatchItem — doublons", () => {
  it("n'écrit rien quand l'URL est déjà dans la veille, sans payer d'embedding", async () => {
    const { client, insert } = makeSupabase({
      selectRows: [{ id: "watch-0", title: "Déjà publié" }],
    });

    const out = JSON.parse(await saveWatchItem(client as never, ARTICLE, USER_ID, audit));

    expect(out.saved).toBe(false);
    expect(out.reason).toBe("duplicate");
    expect(out.existing).toMatchObject({ id: "watch-0", reason: "source_url" });
    expect(out.existing_url).toBe("https://super-tools.test/veille?item=watch-0");
    expect(insert).not.toHaveBeenCalled();
    expect(embedTextMock).not.toHaveBeenCalled();
  });

  it("n'écrit rien quand un contenu très proche existe déjà", async () => {
    const { client, insert, rpc } = makeSupabase({
      rpcRows: [{ id: "watch-9", title: "Le même sujet ailleurs", similarity: 0.9612 }],
    });

    const out = JSON.parse(
      await saveWatchItem(client as never, { ...ARTICLE, source_url: undefined }, USER_ID, audit),
    );

    expect(out.saved).toBe(false);
    expect(out.existing).toMatchObject({ id: "watch-9", reason: "similarity", similarity: 0.961 });
    expect(insert).not.toHaveBeenCalled();
    expect(rpc.mock.calls[0][0]).toBe("match_watch_items");
  });

  it("force=true écrit malgré un contenu proche, mais garde l'embedding", async () => {
    const { client, insert, rpc } = makeSupabase({
      rpcRows: [{ id: "watch-9", title: "Le même sujet ailleurs", similarity: 0.99 }],
    });

    const out = JSON.parse(
      await saveWatchItem(client as never, { ...ARTICLE, force: true }, USER_ID, audit),
    );

    expect(out.saved).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
    expect(insert.mock.calls[0][0]).toHaveProperty("embedding");
  });

  it("force=true ne passe pas outre une URL déjà publiée", async () => {
    const { client, insert } = makeSupabase({
      selectRows: [{ id: "watch-0", title: "Déjà publié" }],
    });

    const out = JSON.parse(
      await saveWatchItem(client as never, { ...ARTICLE, force: true }, USER_ID, audit),
    );

    expect(out.saved).toBe(false);
    expect(out.existing.reason).toBe("source_url");
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("normalizeWatchTags", () => {
  it("met en minuscules, déduplique et plafonne", () => {
    expect(normalizeWatchTags(["IA", "ia", " Agents ", ""])).toEqual(["ia", "agents"]);
    expect(normalizeWatchTags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(8);
    expect(normalizeWatchTags(undefined)).toEqual([]);
  });
});

describe("listWatchItems", () => {
  it("rend un extrait en texte brut et signale une liste tronquée", async () => {
    const { client, calls } = makeSupabase({
      selectRows: [
        { id: "watch-1", title: "A", body: "<p>Contenu <strong>riche</strong></p>", tags: ["ia"] },
      ],
    });

    const out = JSON.parse(await listWatchItems(client as never, { limit: 1, days: 7 }, audit));

    expect(out.count).toBe(1);
    expect(out.items[0].body).toBe("Contenu riche");
    expect(out.hint).toContain("tronquée");
    expect(calls.limit[0]).toEqual([1]);
    expect(calls.gte[0][0]).toBe("created_at");
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it("plafonne la taille demandée et filtre sur les tags normalisés", async () => {
    const { client, calls } = makeSupabase({ selectRows: [] });

    await listWatchItems(client as never, { limit: 500, tags: ["IA"], shared_only: true }, audit);

    expect(calls.limit[0]).toEqual([100]);
    expect(calls.overlaps[0]).toEqual(["tags", ["ia"]]);
    expect(calls.eq[0]).toEqual(["is_shared", true]);
  });
});

// ── Registre des sources (list/propose/update) ──────────────────────────

const {
  listWatchSources,
  proposeWatchSource,
  updateWatchSource,
} = await import("./watch-tools.ts");

/**
 * Faux client pour watch_sources : chaîne select/eq/in/or/order/limit, rpc
 * qui canonise l'URL (minuscules, sans slash final), insert et update.
 */
function makeSourcesSupabase(options: {
  selectRows?: Array<Record<string, unknown>>;
  inserted?: Record<string, unknown>;
  updated?: Array<Record<string, unknown>>;
} = {}) {
  const calls: Record<string, unknown[][]> = { eq: [], in: [], or: [], limit: [], update: [] };
  const chain: Record<string, unknown> = {
    then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve({ data: options.selectRows ?? [], error: null }).then(ok, ko),
  };
  for (const method of ["select", "eq", "in", "or", "order", "limit"]) {
    chain[method] = (...args: unknown[]) => {
      calls[method]?.push(args);
      return chain;
    };
  }
  const insert = vi.fn(() => ({
    select: () => ({
      single: async () => ({ data: options.inserted ?? { id: "src-1" }, error: null }),
    }),
  }));
  const update = vi.fn((patch: Record<string, unknown>) => {
    calls.update.push([patch]);
    return {
      eq: () => ({
        select: async () => ({ data: options.updated ?? [], error: null }),
      }),
    };
  });
  const rpc = vi.fn(async (_fn: string, { value }: { value: string }) => ({
    data: value.trim().toLowerCase().replace(/\/+$/, ""),
    error: null,
  }));
  return { client: { from: vi.fn(() => ({ ...chain, insert, update })), rpc }, insert, update, rpc, calls };
}

const SOURCE = {
  expert: "ia-supertools",
  name: "Newsletter Lenny",
  type: "newsletter",
  language: "en",
  url: "https://Lenny.example.com/",
  why: "Produit et growth.",
};

describe("proposeWatchSource", () => {
  it("refuse un doublon d'URL canonisée et ne crée rien", async () => {
    const existing = { id: "src-9", url: "https://lenny.example.com", name: "Lenny" };
    const { client, insert, rpc } = makeSourcesSupabase({ selectRows: [existing] });

    const out = JSON.parse(await proposeWatchSource(client as never, SOURCE, audit));

    expect(rpc).toHaveBeenCalledWith("normalize_watch_source_url", { value: SOURCE.url });
    expect(out.saved).toBe(false);
    expect(out.reason).toBe("duplicate");
    expect(out.existing).toEqual(existing);
    expect(insert).not.toHaveBeenCalled();
  });

  it("crée la source en statut proposed avec l'URL canonisée", async () => {
    const { client, insert } = makeSourcesSupabase({ selectRows: [], inserted: { id: "src-1", status: "proposed" } });

    const out = JSON.parse(await proposeWatchSource(client as never, SOURCE, audit));

    expect(out.saved).toBe(true);
    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.status).toBe("proposed");
    expect(row.url).toBe("https://lenny.example.com");
    expect(row.expert).toBe("ia-supertools");
  });

  it("refuse un expert ou un type hors liste", async () => {
    const { client, insert } = makeSourcesSupabase();
    await expect(proposeWatchSource(client as never, { ...SOURCE, expert: "inconnu" }, audit))
      .rejects.toThrow(/expert invalide/);
    await expect(proposeWatchSource(client as never, { ...SOURCE, type: "rss" }, audit))
      .rejects.toThrow(/type invalide/);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("updateWatchSource", () => {
  it("exige id ou url et au moins un champ à modifier", async () => {
    const { client } = makeSourcesSupabase();
    await expect(updateWatchSource(client as never, { status: "followed" }, audit))
      .rejects.toThrow(/id ou url/);
    await expect(updateWatchSource(client as never, { id: "src-1" }, audit))
      .rejects.toThrow(/Aucun champ/);
  });

  it("valide status et usefulness", async () => {
    const { client, update } = makeSourcesSupabase();
    await expect(updateWatchSource(client as never, { id: "s", status: "archive" }, audit))
      .rejects.toThrow(/status invalide/);
    await expect(updateWatchSource(client as never, { id: "s", usefulness: 7 }, audit))
      .rejects.toThrow(/usefulness/);
    expect(update).not.toHaveBeenCalled();
  });

  it("repère par url canonisée et n'envoie que les champs fournis", async () => {
    const { client, calls, rpc } = makeSourcesSupabase({ updated: [{ id: "src-1", status: "followed" }] });

    const out = JSON.parse(
      await updateWatchSource(client as never, { url: "HTTPS://Lenny.example.com/", status: "followed", usefulness: 4 }, audit),
    );

    expect(rpc).toHaveBeenCalledWith("normalize_watch_source_url", { value: "HTTPS://Lenny.example.com/" });
    expect(calls.update[0][0]).toEqual({ status: "followed", usefulness: 4 });
    expect(out.saved).toBe(true);
  });

  it("signale une source introuvable", async () => {
    const { client } = makeSourcesSupabase({ updated: [] });
    await expect(updateWatchSource(client as never, { id: "absent", status: "dropped" }, audit))
      .rejects.toThrow(/Aucune source/);
  });
});

describe("listWatchSources", () => {
  it("filtre sur plusieurs statuts et plafonne la limite", async () => {
    const { client, calls } = makeSourcesSupabase({ selectRows: [] });

    await listWatchSources(client as never, { status: ["followed", "to_subscribe"], limit: 9999 }, audit);

    expect(calls.in[0]).toEqual(["status", ["followed", "to_subscribe"]]);
    expect(calls.limit[0]).toEqual([500]);
  });

  it("refuse un statut hors liste", async () => {
    const { client } = makeSourcesSupabase();
    await expect(listWatchSources(client as never, { status: "archive" }, audit))
      .rejects.toThrow(/status invalide/);
  });
});
