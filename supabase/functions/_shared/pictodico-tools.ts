// deno-lint-ignore-file no-explicit-any
type Supabase = any;

export const PICTO_REQUEST_TYPES = ["demande_ajout", "erreur_signalee"] as const;
type RequestType = (typeof PICTO_REQUEST_TYPES)[number];

export function normalizePictoWord(raw: string): string {
  let w = (raw || "").replace(/\+/g, " ");
  try {
    if (/%[0-9a-fA-F]{2}/.test(w)) w = decodeURIComponent(w);
  } catch { /* garde la valeur brute */ }
  return w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export interface PictoRequestInput {
  word: string;
  requested_at?: string;
  request_type?: string;
  comment?: string;
  source_url?: string;
}

async function loadBacklog(supabase: Supabase) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("pictodico_words")
      .select("id, word, request_type, received_at")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export async function addPictoRequests(supabase: Supabase, items: PictoRequestInput[]) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("requests doit contenir au moins un mot");
  if (items.length > 200) throw new Error("200 mots maximum par appel");
  const results: any[] = [];
  for (const it of items) {
    const word = (it?.word ?? "").trim().slice(0, 200);
    const type = (it?.request_type ?? "demande_ajout") as RequestType;
    if (!word) { results.push({ word: it?.word ?? "", status: "rejected", reason: "mot vide" }); continue; }
    if (!PICTO_REQUEST_TYPES.includes(type)) {
      results.push({ word, status: "rejected", reason: `request_type invalide (${PICTO_REQUEST_TYPES.join(", ")})` });
      continue;
    }
    let receivedAt = new Date().toISOString();
    if (it.requested_at) {
      const d = new Date(it.requested_at);
      if (isNaN(d.getTime())) { results.push({ word, status: "rejected", reason: "requested_at invalide" }); continue; }
      receivedAt = d.toISOString();
    }
    const { data, error } = await supabase.rpc("pictodico_register_request", {
      p_word: word,
      p_request_type: type,
      p_source: "mcp",
      p_source_url: it.source_url ?? null,
      p_error_description: it.comment ?? null,
      p_received_at: receivedAt,
    });
    if (error) { results.push({ word, status: "rejected", reason: error.message }); continue; }
    const row = Array.isArray(data) ? data[0] : data;
    results.push({
      word: row.word,
      request_type: row.request_type,
      status: row.created ? "created" : "incremented",
      id: row.id,
      request_count: row.request_count,
    });
  }
  return {
    created: results.filter((r) => r.status === "created").length,
    incremented: results.filter((r) => r.status === "incremented").length,
    rejected: results.filter((r) => r.status === "rejected").length,
    results,
  };
}

export async function checkPictoEntries(supabase: Supabase, words: string[]) {
  if (!Array.isArray(words) || words.length === 0) throw new Error("words doit contenir au moins un mot");
  if (words.length > 200) throw new Error("200 mots maximum par appel");
  const existing = await loadBacklog(supabase);
  const byWord = new Map<string, any[]>();
  for (const r of existing) {
    const key = normalizePictoWord(r.word);
    if (!byWord.has(key)) byWord.set(key, []);
    byWord.get(key)!.push(r);
  }
  const results = words.map((raw) => {
    const word = (raw ?? "").trim().slice(0, 200);
    const matches = (byWord.get(normalizePictoWord(word)) ?? []).map((r) => ({
      id: r.id,
      word: r.word,
      request_type: r.request_type,
      received_at: r.received_at,
    }));
    return { word, exists: matches.length > 0, matches };
  });
  return {
    checked: results.length,
    found: results.filter((r) => r.exists).length,
    missing: results.filter((r) => !r.exists).map((r) => r.word),
    results,
  };
}
