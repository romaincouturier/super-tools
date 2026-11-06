/**
 * nocrm-import
 *
 * Import de l'historique noCRM dans crm_cards (admins uniquement).
 * - simulate : rapport complet, aucune écriture CRM.
 * - start (mode test|full) puis step répété : traitement par lots reprenable (cursor dans nocrm_import_runs).
 * - reconcile : rapprochement final, bloquant en cas d'écart.
 * Écrit directement en base (pas d'appel aux hooks UI) : aucun email, Slack, relance ni action quotidienne.
 * Idempotent : source_metadata.nocrm_id (index unique), crm_comments.import_key, journal actor_email='import-nocrm'.
 */
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import { getSenderEmail } from "../_shared/email-settings.ts";
import {
  buildHistory, findMergeTarget, groupComments, hasActivityLabel, leadTags, mapLeadToCard, mapStep, noteContent,
  parisToIso, parseAmount, parseCsv, tagKey, TAGS_TO_CREATE, type NocrmComment, type Row,
} from "../_shared/nocrm-import.ts";

const BUCKET = "nocrm-import";
const BATCH = 25;
const TEST_LIMIT = 50;
const ACTOR = "import-nocrm";
const EXPECTED = { leads: 1955, wonCount: 669, wonValue: 1427556.2, notes: 2932, activities: 12645 };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Db = ReturnType<typeof getSupabaseClient>;

async function loadFiles(db: Db, leadsPath: string, commentsPath: string) {
  const read = async (p: string) => {
    const { data, error } = await db.storage.from(BUCKET).download(p);
    if (error || !data) throw new Error(`Fichier introuvable : ${p}`);
    return await data.text();
  };
  const leads = parseCsv(await read(leadsPath));
  const commentRows = parseCsv(await read(commentsPath));
  return { leads, commentRows, comments: groupComments(commentRows) };
}

async function loadContext(db: Db) {
  const [{ data: cols }, { data: tags }] = await Promise.all([
    db.from("crm_columns").select("id, name").eq("is_archived", false),
    db.from("crm_tags").select("id, name, category"),
  ]);
  const byName = (n: string) => (cols ?? []).find((c: any) => c.name.trim().toLowerCase() === n.toLowerCase())?.id as string | undefined;
  const columnIds = { "Entrant": byName("Entrant"), "Contacté": byName("Contacté"), "Devis envoyé": byName("Devis envoyé"), "Gagné": byName("Gagné"), "Perdu": byName("Perdu") };
  const missing = Object.entries(columnIds).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Colonnes CRM manquantes : ${missing.join(", ")}`);
  const tagIds = new Map<string, string>((tags ?? []).map((t: any) => [tagKey(t.category ?? "", t.name), t.id]));
  return { columnIds: columnIds as Record<keyof typeof columnIds, string>, tagIds };
}

async function loadExistingCards(db: Db) {
  const out: Array<{ id: string; email: string | null; created_at: string; title: string; nocrm_id: string | null }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("crm_cards").select("id, email, created_at, title, nocrm_id:source_metadata->>nocrm_id, import_source:source_metadata->>import_source").range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as any[]).filter((c) => c.import_source !== "nocrm"));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Plan de fusion déterministe sur tout le fichier (même résultat en simulation et à chaque lot). */
function planMerges(leads: Row[], existing: Awaited<ReturnType<typeof loadExistingCards>>) {
  const taken = new Set<string>(existing.filter((c) => c.nocrm_id).map((c) => c.id));
  const plan = new Map<string, { cardId: string; title: string; email: string | null; created_at: string }>();
  for (const c of existing) if (c.nocrm_id) plan.set(c.nocrm_id, { cardId: c.id, title: c.title, email: c.email, created_at: c.created_at });
  for (const lead of leads) {
    const id = lead.ID?.trim();
    if (!id || plan.has(id)) continue;
    const createdAt = parisToIso(lead.Created_at);
    if (!createdAt || !lead["E-mail"]) continue;
    const t = findMergeTarget(lead["E-mail"], createdAt, existing, taken);
    if (t) { taken.add(t.id); plan.set(id, { cardId: t.id, title: t.title, email: t.email, created_at: t.created_at }); }
  }
  return plan;
}

function expectedFromFile(leads: Row[], comments: Map<string, NocrmComment[]>) {
  const won = leads.filter((l) => (l.Status ?? "").trim().toLowerCase() === "won");
  const all = [...comments.values()].flat();
  return {
    leads: leads.length,
    wonCount: won.length,
    wonValue: +won.reduce((s, l) => s + parseAmount(l.Amount), 0).toFixed(2),
    notes: all.filter((c) => c.isNote).length,
    activities: all.filter((c) => !c.isNote).length,
  };
}

async function simulate(db: Db, leadsPath: string, commentsPath: string) {
  const { leads, commentRows, comments } = await loadFiles(db, leadsPath, commentsPath);
  const ctx = await loadContext(db);
  const existing = await loadExistingCards(db);
  const merges = planMerges(leads, existing);
  const alreadyImported = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("crm_cards").select("nocrm_id:source_metadata->>nocrm_id").eq("source_metadata->>import_source", "nocrm").range(from, from + 999);
    for (const r of (data ?? []) as any[]) alreadyImported.add(r.nocrm_id);
    if (!data || data.length < 1000) break;
  }

  const anomalies: Array<{ nocrm_id: string; issue: string }> = [];
  const unknownValues = new Map<string, number>();
  const ids = new Set<string>();
  let toCreate = 0, toUpdate = 0;
  const tagsToCreate = TAGS_TO_CREATE.filter(([c, n]) => !ctx.tagIds.has(tagKey(c, n))).map(([c, n]) => `${c} : ${n}`);

  for (const lead of leads) {
    const id = lead.ID?.trim();
    if (!id) { anomalies.push({ nocrm_id: "?", issue: `Ligne sans ID (${lead.Lead ?? ""})` }); continue; }
    if (ids.has(id)) anomalies.push({ nocrm_id: id, issue: "ID en double dans le fichier" });
    ids.add(id);
    const m = mapLeadToCard(lead);
    if (!m.createdAt) anomalies.push({ nocrm_id: id, issue: `Created_at illisible : « ${lead.Created_at} »` });
    if (!(lead.Status ?? "").trim() || !["won", "lost", "cancelled", "canceled", "todo", "standby"].includes(lead.Status.trim().toLowerCase())) anomalies.push({ nocrm_id: id, issue: `Status inconnu : « ${lead.Status} »` });
    if (m.status === "OPEN" && !mapStep(lead.Step)) anomalies.push({ nocrm_id: id, issue: `Étape inconnue pour une fiche ouverte : « ${lead.Step} »` });
    if (m.status !== "OPEN" && !m.closedAt) anomalies.push({ nocrm_id: id, issue: "Fiche close sans Closed_at (date de création utilisée)" });
    if (m.createdAt && m.closedAt && m.closedAt < m.createdAt) anomalies.push({ nocrm_id: id, issue: "Closed_at antérieure à Created_at (ramenée à la création)" });
    for (const u of leadTags(lead).unknown) unknownValues.set(`${u.column} : ${u.value}`, (unknownValues.get(`${u.column} : ${u.value}`) ?? 0) + 1);
    if (!merges.has(id)) { if (alreadyImported.has(id)) toUpdate++; else toCreate++; }
  }
  const orphanIds = [...comments.keys()].filter((k) => !ids.has(k));
  const orphanComments = orphanIds.reduce((s, k) => s + (comments.get(k)?.length ?? 0), 0);
  if (orphanIds.length) anomalies.push({ nocrm_id: orphanIds.slice(0, 20).join(", "), issue: `${orphanComments} commentaire(s) rattaché(s) à ${orphanIds.length} fiche(s) absente(s) du fichier des fiches` });
  const badDates = commentRows.filter((r) => !parisToIso(r.commented_at)).length;
  if (badDates) anomalies.push({ nocrm_id: "-", issue: `${badDates} commentaire(s) sans date lisible (date de création de la fiche utilisée)` });

  const expected = expectedFromFile(leads, comments);
  const mergeList = [...merges.entries()]
    .filter(([id]) => ids.has(id))
    .map(([id, t]) => {
      const lead = leads.find((l) => l.ID?.trim() === id)!;
      return { nocrm_id: id, nocrm_title: lead.Lead, nocrm_created_at: parisToIso(lead.Created_at), email: lead["E-mail"], card_id: t.cardId, card_title: t.title, card_created_at: t.created_at };
    });
  return {
    leads: leads.length,
    to_create: toCreate,
    to_update: toUpdate,
    to_merge: mergeList.length,
    merges: mergeList,
    tags_to_create: tagsToCreate,
    unknown_values: [...unknownValues.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    notes: expected.notes,
    activities: expected.activities,
    expected_from_file: expected,
    expected_from_spec: EXPECTED,
    anomalies,
  };
}

async function ensureTags(db: Db, tagIds: Map<string, string>) {
  for (const [category, name] of TAGS_TO_CREATE) {
    if (tagIds.has(tagKey(category, name))) continue;
    const { data, error } = await db.from("crm_tags").insert({ name, category }).select("id").single();
    if (error) throw new Error(`Création du tag ${name} : ${error.message}`);
    tagIds.set(tagKey(category, name), data.id);
  }
}

async function processLead(db: Db, lead: Row, ctx: Awaited<ReturnType<typeof loadContext>>, comments: NocrmComment[], mergeTarget: string | null, existingImportedId: string | null, noteAuthor: string) {
  const id = lead.ID.trim();
  const m = mapLeadToCard(lead);
  if (!m.createdAt) throw new Error(`Created_at illisible : « ${lead.Created_at} »`);
  const nocrmMeta = { nocrm_id: id, nocrm: lead };
  let cardId: string;
  let kind: "created" | "updated" | "merged";

  if (mergeTarget) {
    const { data: cur, error } = await db.from("crm_cards").select("source_metadata").eq("id", mergeTarget).single();
    if (error) throw new Error(error.message);
    const meta = { ...(cur.source_metadata ?? {}), ...nocrmMeta, nocrm_merged: true };
    const { error: upErr } = await db.from("crm_cards").update({ source_metadata: meta }).eq("id", mergeTarget);
    if (upErr) throw new Error(upErr.message);
    cardId = mergeTarget; kind = "merged";
  } else {
    const step = mapStep(lead.Step);
    const columnId = m.status === "WON" ? ctx.columnIds["Gagné"]
      : m.status === "OPEN" ? ctx.columnIds[step ?? "Entrant"] : ctx.columnIds["Perdu"];
    const payload = {
      ...m.card,
      column_id: columnId,
      created_at: m.createdAt,
      source_metadata: { ...nocrmMeta, import_source: "nocrm", imported_at: new Date().toISOString() },
    };
    if (existingImportedId) {
      const { error } = await db.from("crm_cards").update(payload).eq("id", existingImportedId);
      if (error) throw new Error(error.message);
      cardId = existingImportedId; kind = "updated";
    } else {
      const lastUpdate = parisToIso(lead.Last_update);
      const { data, error } = await db.from("crm_cards").insert({ ...payload, position: 0, updated_at: lastUpdate ?? m.createdAt }).select("id").single();
      if (error) throw new Error(error.message);
      cardId = data.id; kind = "created";
    }
    // Tags : remplacement direct dans crm_card_tags, sans entrée tag_added dans le journal.
    const tagIds = leadTags(lead).tags.map(([c, n]) => ctx.tagIds.get(tagKey(c, n))).filter(Boolean) as string[];
    await db.from("crm_card_tags").delete().eq("card_id", cardId);
    if (tagIds.length) {
      const { error } = await db.from("crm_card_tags").insert(tagIds.map((tag_id) => ({ card_id: cardId, tag_id, created_at: m.createdAt })));
      if (error) throw new Error(`Tags : ${error.message}`);
    }
  }

  // Notes (aucune perte tolérée) : upsert par clé stable nocrm_id:rang.
  const fallbackAt = m.createdAt;
  const notes = comments.filter((c) => c.isNote).map((c) => ({
    card_id: cardId,
    content: noteContent(c),
    author_email: noteAuthor,
    created_at: c.at ?? fallbackAt,
    import_key: `nocrm:${id}:${c.ordinal}`,
  }));
  if (notes.length) {
    const { error } = await db.from("crm_comments").upsert(notes, { onConflict: "import_key" });
    if (error) throw new Error(`Notes : ${error.message}`);
  }

  // Journal : on remplace toutes les entrées import-nocrm de la fiche (idempotent).
  await db.from("crm_activity_log").delete().eq("card_id", cardId).eq("actor_email", ACTOR);
  const logRows: Array<Record<string, unknown>> = comments.filter((c) => !c.isNote).map((c) => ({
    card_id: cardId,
    action_type: "nocrm_activity",
    new_value: hasActivityLabel(c.activityType) ? c.activityType : null,
    actor_email: ACTOR,
    created_at: c.at ?? fallbackAt,
    metadata: { source: "nocrm", nocrm_id: id, activity_type: c.activityType || null, ordinal: c.ordinal },
  }));
  if (kind !== "merged") {
    const history = buildHistory({
      title: m.card.title, createdAt: m.createdAt, firstActivity: parisToIso(lead.First_activity), closedAt: m.closedAt,
      step: mapStep(lead.Step), status: m.status, comments, columnIds: ctx.columnIds,
    });
    for (const e of history) {
      logRows.push({
        card_id: cardId, action_type: e.action_type, old_value: e.old_value, new_value: e.new_value, actor_email: ACTOR, created_at: e.at,
        metadata: { source: "nocrm", nocrm_id: id, reconstructed: true, ...(e.estimated ? { estimated: true } : {}) },
      });
    }
  }
  for (let i = 0; i < logRows.length; i += 500) {
    const { error } = await db.from("crm_activity_log").insert(logRows.slice(i, i + 500));
    if (error) throw new Error(`Journal : ${error.message}`);
  }
  return { kind, notes: notes.length, activities: comments.filter((c) => !c.isNote).length };
}

async function reconcile(db: Db, expected: ReturnType<typeof expectedFromFile>) {
  const ids = new Set<string>();
  let wonCount = 0, wonValue = 0, wonValueCsv = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("crm_cards")
      .select("id, sales_status, estimated_value, nocrm_id:source_metadata->>nocrm_id, nocrm_status:source_metadata->nocrm->>Status, nocrm_amount:source_metadata->nocrm->>Amount")
      .not("source_metadata->>nocrm_id", "is", null).range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as any[]) {
      ids.add(r.nocrm_id);
      if ((r.nocrm_status ?? "").toLowerCase() === "won") { wonCount++; wonValueCsv += parseAmount(r.nocrm_amount); wonValue += Number(r.estimated_value ?? 0); }
    }
    if (!data || data.length < 1000) break;
  }
  const { count: notes } = await db.from("crm_comments").select("id", { count: "exact", head: true }).like("import_key", "nocrm:%");
  const { count: activities } = await db.from("crm_activity_log").select("id", { count: "exact", head: true }).eq("actor_email", ACTOR).eq("action_type", "nocrm_activity");
  const actual = { leads: ids.size, wonCount, wonValue: +wonValueCsv.toFixed(2), notes: notes ?? 0, activities: activities ?? 0 };
  const checks = (Object.keys(EXPECTED) as Array<keyof typeof EXPECTED>).map((k) => ({
    key: k, expected_spec: EXPECTED[k], expected_file: expected[k], actual: actual[k],
    ok: Math.abs(actual[k] - expected[k]) < 0.01 && Math.abs(actual[k] - EXPECTED[k]) < 0.01,
  }));
  return { ok: checks.every((c) => c.ok), checks, won_value_in_crm: +wonValue.toFixed(2) };
}

async function step(db: Db, run: any) {
  if (run.status !== "running") return run;
  const { leads, comments } = await loadFiles(db, run.leads_path, run.comments_path);
  const ctx = await loadContext(db);
  await ensureTags(db, ctx.tagIds);
  const existing = await loadExistingCards(db);
  const merges = planMerges(leads, existing);
  const limit = Math.min(run.lead_limit ?? leads.length, leads.length);
  const slice = leads.slice(run.cursor, Math.min(run.cursor + BATCH, limit));

  const sliceIds = slice.map((l) => l.ID?.trim()).filter(Boolean);
  const { data: imported } = await db.from("crm_cards").select("id, nocrm_id:source_metadata->>nocrm_id")
    .eq("source_metadata->>import_source", "nocrm").in("source_metadata->>nocrm_id", sliceIds);
  const importedById = new Map(((imported ?? []) as any[]).map((r) => [r.nocrm_id, r.id]));

  // Auteur des notes : l'adresse d'expédition des paramètres (romain@supertilt.fr aujourd'hui).
  const noteAuthor = await getSenderEmail();
  const counts = { created: 0, updated: 0, merged: 0, skipped: 0, notes: 0, activities: 0 };
  const errors: Array<{ nocrm_id: string; error: string }> = [];
  for (const lead of slice) {
    const id = lead.ID?.trim();
    if (!id) { counts.skipped++; errors.push({ nocrm_id: "?", error: "Ligne sans ID" }); continue; }
    try {
      const mergeTarget = importedById.has(id) ? null : merges.get(id)?.cardId ?? null;
      const r = await processLead(db, lead, ctx, comments.get(id) ?? [], mergeTarget, importedById.get(id) ?? null);
      counts[r.kind]++; counts.notes += r.notes; counts.activities += r.activities;
    } catch (e) {
      counts.skipped++;
      errors.push({ nocrm_id: id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const cursor = run.cursor + slice.length;
  const finished = cursor >= limit;
  const patch: Record<string, unknown> = {
    cursor, total_leads: limit, batches_done: run.batches_done + 1,
    created_count: run.created_count + counts.created, updated_count: run.updated_count + counts.updated,
    merged_count: run.merged_count + counts.merged, skipped_count: run.skipped_count + counts.skipped,
    notes_count: run.notes_count + counts.notes, activities_count: run.activities_count + counts.activities,
    errors: [...(run.errors ?? []), ...errors].slice(-500), updated_at: new Date().toISOString(),
  };
  if (finished) {
    patch.finished_at = new Date().toISOString();
    if (run.mode === "full") {
      const rec = await reconcile(db, expectedFromFile(leads, comments));
      patch.reconciliation = rec;
      patch.status = rec.ok ? "done" : "reconciliation_failed";
    } else patch.status = "done";
  }
  const { data, error } = await db.from("nocrm_import_runs").update(patch).eq("id", run.id).eq("cursor", run.cursor).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? run;
}

const PATH_RE = /^[a-zA-Z0-9/_.-]{1,200}\.csv$/;

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;
  try {
    const user = await verifyAuth(req.headers.get("Authorization"));
    if (!user) return json({ error: "Non autorisé" }, 401);
    const db = getSupabaseClient();
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: user.id });
    if (isAdmin !== true) return json({ error: "Réservé aux administrateurs" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "upload") {
      const { leadsCsv, commentsCsv } = body;
      if (typeof leadsCsv !== "string" || typeof commentsCsv !== "string" || !leadsCsv || !commentsCsv) return json({ error: "Deux fichiers CSV requis" }, 400);
      if (leadsCsv.length + commentsCsv.length > 40_000_000) return json({ error: "Fichiers trop volumineux" }, 413);
      const folder = new Date().toISOString().replace(/[:.]/g, "-");
      const leadsPath = `${folder}/nocrm_leads.csv`;
      const commentsPath = `${folder}/nocrm_comments.csv`;
      for (const [path, text] of [[leadsPath, leadsCsv], [commentsPath, commentsCsv]]) {
        const { error } = await db.storage.from(BUCKET).upload(path, new Blob([text], { type: "text/csv" }), { contentType: "text/csv; charset=utf-8", upsert: false });
        if (error) throw new Error(`Enregistrement de ${path} : ${error.message}`);
      }
      return json({ leadsPath, commentsPath });
    }

    if (action === "simulate" || action === "start") {
      const { leadsPath, commentsPath } = body;
      if (!PATH_RE.test(leadsPath ?? "") || !PATH_RE.test(commentsPath ?? "")) return json({ error: "Chemins de fichiers invalides" }, 400);
      const mode = action === "simulate" ? "simulation" : body.mode === "full" ? "full" : body.mode === "test" ? "test" : null;
      if (!mode) return json({ error: "mode doit être test ou full" }, 400);
      const { data: running } = await db.from("nocrm_import_runs").select("id").eq("status", "running").neq("mode", "simulation").limit(1);
      if (mode !== "simulation" && running?.length) return json({ error: "Un import est déjà en cours : reprenez-le" }, 409);
      const { data: run, error } = await db.from("nocrm_import_runs").insert({
        mode, created_by: user.id, leads_path: leadsPath, comments_path: commentsPath, lead_limit: mode === "test" ? TEST_LIMIT : null,
      }).select("*").single();
      if (error) throw new Error(error.message);
      if (mode === "simulation") {
        try {
          const report = await simulate(db, leadsPath, commentsPath);
          const { data: done } = await db.from("nocrm_import_runs").update({ status: "done", report, total_leads: report.leads, finished_at: new Date().toISOString() }).eq("id", run.id).select("*").single();
          return json({ run: done });
        } catch (e) {
          await db.from("nocrm_import_runs").update({ status: "error", errors: [{ error: e instanceof Error ? e.message : String(e) }], finished_at: new Date().toISOString() }).eq("id", run.id);
          throw e;
        }
      }
      return json({ run });
    }

    if (action === "step" || action === "reconcile") {
      const { data: run } = await db.from("nocrm_import_runs").select("*").eq("id", body.runId ?? "").maybeSingle();
      if (!run) return json({ error: "Import introuvable" }, 404);
      if (action === "step") return json({ run: await step(db, run) });
      const { leads, comments } = await loadFiles(db, run.leads_path, run.comments_path);
      const rec = await reconcile(db, expectedFromFile(leads, comments));
      const { data } = await db.from("nocrm_import_runs").update({ reconciliation: rec, status: run.status === "running" ? "running" : rec.ok ? "done" : "reconciliation_failed" }).eq("id", run.id).select("*").single();
      return json({ run: data });
    }
    return json({ error: "Action inconnue" }, 400);
  } catch (err) {
    console.error("nocrm-import error:", err);
    await reportEdgeError(err, { fn: "nocrm-import" });
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
