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
  const existing = await loadBacklog(supabase);
  const seen = new Map<string, string>();
  for (const r of existing) seen.set(`${r.request_type}|${normalizePictoWord(r.word)}`, r.id);

  const toInsert: any[] = [];
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
    const key = `${type}|${normalizePictoWord(word)}`;
    if (seen.has(key)) { results.push({ word, request_type: type, status: "duplicate", existing_id: seen.get(key) }); continue; }
    seen.set(key, "pending");
    toInsert.push({
      word,
      language: "fr",
      source: "mcp",
      request_type: type,
      source_url: it.source_url?.slice(0, 1000) || null,
      error_description: it.comment?.slice(0, 2000) || null,
      received_at: receivedAt,
    });
    results.push({ word, request_type: type, status: "created" });
  }
  if (toInsert.length) {
    const { data, error } = await supabase.from("pictodico_words").insert(toInsert).select("id, word, request_type");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = results.find((x) => x.status === "created" && !x.id && x.word === row.word && x.request_type === row.request_type);
      if (r) r.id = row.id;
    }
  }
  return {
    created: results.filter((r) => r.status === "created").length,
    duplicates: results.filter((r) => r.status === "duplicate").length,
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
