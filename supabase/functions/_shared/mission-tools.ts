import { getSupabaseClient } from "./mod.ts";
import { extractDocument, type ExtractedPart } from "./document-extract.ts";

/**
 * Lecture du contenu réel d'une mission : dossier agrégé, pages, documents,
 * photos, plus le dossier client.
 *
 * Partagé entre le serveur MCP (Claude via connecteur) et l'agent intégré
 * (agent-chat), qui étaient outillés très différemment sur les mêmes données :
 * le connecteur savait lire un .docx de mission, l'agent de l'application non.
 *
 * Les fonctions renvoient soit du JSON en texte, soit des `ExtractedPart`
 * (texte et images), à charge de chaque appelant de les convertir dans son
 * propre format de bloc — MCP et l'API Anthropic ne représentent pas les
 * images de la même façon.
 *
 * Chaque appel est journalisé via le callback `audit` fourni par l'appelant,
 * qui porte l'identité et le canal d'origine.
 */

export type Supabase = ReturnType<typeof getSupabaseClient>;
export type AuditFn = (label: string) => Promise<void>;
export type { ExtractedPart };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Couverture intégrale garantie.
 *
 * Une réponse partielle qui ressemble à une réponse complète est pire qu'une
 * absence de réponse : sur une mission réelle de 929 320 caractères, le dossier
 * en livrait 16 % sans que rien ne le signale, et la synthèse produite semblait
 * fondée sur tout le dossier.
 *
 * Deux invariants tiennent lieu de garantie :
 *   1. Une page est livrée ENTIÈRE ou pas du tout. Jamais de page coupée dans
 *      le dossier, donc jamais de contenu tronqué pris pour du contenu complet.
 *   2. Ce qui n'est pas livré figure dans reading_plan, avec l'appel exact et
 *      le nombre de parties. La couverture 100 % reste toujours atteignable.
 */
const DOSSIER_INLINE_MAX = 250000;
const PAGE_PART_CHARS = 60000;
/** Plafond de lignes par bloc annexe, avec comptage exact pour signaler la coupe. */
const DOSSIER_ROWS_MAX = 100;

export async function resolveMission(
  supabase: Supabase,
  missionQuery: string,
  columns: string,
): Promise<{ mission: Record<string, unknown> } | { problem: string }> {
  let req = supabase.from("missions").select(columns).limit(3);
  req = UUID_RE.test(missionQuery.trim())
    ? req.eq("id", missionQuery.trim())
    : req.ilike("title", `%${missionQuery}%`);

  const { data, error } = await req;
  if (error) throw new Error(error.message);
  if (!data?.length) {
    return {
      problem: JSON.stringify({
        found: false,
        hint: "Aucune mission ne correspond. Essayer query_database sur la table missions.",
      }),
    };
  }
  if (data.length > 1) {
    return {
      problem: JSON.stringify({
        found: false,
        ambiguous: data.map((m: Record<string, unknown>) => ({
          id: m.id,
          title: m.title,
          client_name: m.client_name,
        })),
        hint: "Plusieurs missions correspondent : rappeler avec l'UUID.",
      }),
    };
  }
  return { mission: data[0] as Record<string, unknown> };
}

export async function getMissionDossier(
  supabase: Supabase,
  missionQuery: string,
  audit: AuditFn,
): Promise<string> {
  await audit(`get_mission_dossier: ${missionQuery.slice(0, 200)}`);

  const resolved = await resolveMission(
    supabase,
    missionQuery,
    "id, title, client_name, client_contact, status, initial_amount, consumed_amount, billed_amount, total_amount, created_at",
  );
  if ("problem" in resolved) return resolved.problem;
  const mission = resolved.mission;

  const exact = { count: "exact" as const };
  const [pages, activities, documents, gallery] = await Promise.all([
    // Toutes les pages, sans limite : le dossier doit connaître l'inventaire
    // complet même quand il ne peut pas en livrer le contenu.
    supabase
      .from("mission_pages")
      .select("id, title, icon, content, page_type, parent_page_id, position, is_deliverable, created_at")
      .eq("mission_id", mission.id)
      .order("position", { ascending: true }),
    supabase
      .from("mission_activities")
      .select("activity_date, description, duration, duration_type, is_billed, notes", exact)
      .eq("mission_id", mission.id)
      .order("activity_date", { ascending: true })
      .limit(DOSSIER_ROWS_MAX),
    supabase
      .from("mission_documents")
      // `id` est indispensable : c'est lui qu'on passe à read_document.
      // Son absence rendait les documents de mission illisibles.
      .select(
        "id, file_name, file_url, mime_type, file_size, is_deliverable, processing_status, transcript_page_id, created_at",
        exact,
      )
      .eq("mission_id", mission.id)
      .order("created_at", { ascending: true })
      .limit(DOSSIER_ROWS_MAX),
    supabase
      .from("media")
      .select("id, file_name, mime_type, file_size, position, tags, transcript, is_deliverable, created_at", exact)
      .eq("source_type", "mission")
      .eq("source_id", mission.id)
      .order("position", { ascending: true })
      .limit(DOSSIER_ROWS_MAX),
  ]);

  const pageRows = (pages.data || []) as Array<Record<string, unknown>>;
  const lengthOf = (p: Record<string, unknown>) =>
    typeof p.content === "string" ? (p.content as string).length : 0;
  const totalChars = pageRows.reduce((n, p) => n + lengthOf(p), 0);

  // Invariant 1 : une page passe entière ou pas du tout. On remplit le budget
  // en commençant par les plus courtes, pour qu'une seule page monumentale
  // n'évince pas les dix petites (dont, sur une mission réelle, la page « PRD »).
  const inlineIds = new Set<string>();
  let budget = DOSSIER_INLINE_MAX;
  for (const p of [...pageRows].sort((a, b) => lengthOf(a) - lengthOf(b))) {
    const len = lengthOf(p);
    if (len > budget) break;
    budget -= len;
    inlineIds.add(p.id as string);
  }

  // Invariant 2 : ce qui n'est pas livré devient un plan d'appels explicite.
  const readingPlan: Array<Record<string, unknown>> = [];
  const mappedPages = pageRows.map((p) => {
    const len = lengthOf(p);
    if (inlineIds.has(p.id as string)) {
      return { ...p, content_length: len, content_complete: true };
    }
    const parts = Math.max(1, Math.ceil(len / PAGE_PART_CHARS));
    readingPlan.push({
      page_id: p.id,
      title: p.title,
      content_length: len,
      parts,
      call: `read_mission_page("${p.id}", part)  // part de 1 à ${parts}`,
      // Repli quand read_mission_page n'est pas exposé : sur claude.ai la
      // liste des tools est figée à la création de la conversation, donc un
      // tool ajouté depuis n'y apparaît pas. Sans ce repli écrit noir sur
      // blanc, le modèle cherche l'outil, ne le trouve pas, et improvise.
      call_sql:
        `SELECT substring(content from 1 + (part - 1) * ${PAGE_PART_CHARS} for ${PAGE_PART_CHARS}) ` +
        `FROM mission_pages WHERE id = '${p.id}'  -- remplacer part par 1..${parts}`,
    });
    const { content: _omitted, ...rest } = p;
    return { ...rest, content_length: len, content_complete: false, parts };
  });

  const planCalls = readingPlan.reduce((n, r) => n + (r.parts as number), 0);
  const deliveredChars = totalChars - readingPlan.reduce((n, r) => n + (r.content_length as number), 0);

  const overflow = (label: string, res: { data: unknown[] | null; count: number | null }) =>
    (res.count ?? 0) > (res.data?.length ?? 0)
      ? `${label} : ${res.data?.length ?? 0} lignes sur ${res.count} (interroger le reste avec query_database). `
      : "";

  return JSON.stringify({
    found: true,
    mission,
    pages: mappedPages,
    activities: activities.data || [],
    activities_total: activities.count ?? (activities.data || []).length,
    documents: documents.data || [],
    documents_total: documents.count ?? (documents.data || []).length,
    gallery: gallery.data || [],
    gallery_total: gallery.count ?? (gallery.data || []).length,
    coverage: {
      pages_total: pageRows.length,
      pages_complete: inlineIds.size,
      chars_total: totalChars,
      chars_delivered: deliveredChars,
      remaining_calls: planCalls,
    },
    reading_plan: readingPlan,
    hint:
      (readingPlan.length
        ? `COUVERTURE PARTIELLE : ${inlineIds.size} page(s) sur ${pageRows.length} sont livrées ici, ` +
          `intégralement (aucune page n'est tronquée). Les ${readingPlan.length} autres, soit ` +
          `${totalChars - deliveredChars} caractères, ne sont PAS dans cette réponse. ` +
          `Pour couvrir 100 % du dossier, exécuter les ${planCalls} appels listés dans reading_plan ` +
          `avant de conclure. Si read_mission_page n'est pas exposé dans cette conversation ` +
          `(la liste des tools est figée à sa création), utiliser le champ call_sql de chaque ` +
          `entrée avec query_database : il donne le même découpage. Ne pas produire de synthèse « du dossier » tant que reading_plan ` +
          `n'est pas épuisé : le dire, ou faire les appels. Alternative quand seule une question ` +
          `précise est posée : search_content(query, mission_id) cible sans tout lire. `
        : "Couverture complète : toutes les pages sont livrées intégralement. ") +
      overflow("Activités", activities as never) +
      overflow("Documents", documents as never) +
      overflow("Galerie", gallery as never) +
      "Documents : read_document(document_id), ou read_mission_documents(mission) pour tous. " +
      "Photos : read_media_image(media_id). Ne jamais répondre qu'un contenu de mission est " +
      "inaccessible sans avoir appelé ces tools.",
  });
}

/**
 * Une page de mission, en entier, découpée en parties de taille bornée.
 * C'est le tool qui rend la couverture 100 % atteignable sur les pages que le
 * dossier ne peut pas livrer.
 */
export async function readMissionPage(
  supabase: Supabase,
  pageId: string,
  part: number,
  audit: AuditFn,
): Promise<string> {
  if (!UUID_RE.test(pageId.trim())) {
    throw new Error("page_id doit être un UUID (voir reading_plan de get_mission_dossier)");
  }
  await audit(`read_mission_page: ${pageId.slice(0, 60)} part ${part}`);

  const { data: page, error } = await supabase
    .from("mission_pages")
    .select("id, mission_id, title, content, page_type, is_deliverable, created_at")
    .eq("id", pageId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!page) throw new Error("Page introuvable");

  const content = (page.content as string) ?? "";
  const totalParts = Math.max(1, Math.ceil(content.length / PAGE_PART_CHARS));
  const index = Math.min(Math.max(Math.trunc(part) || 1, 1), totalParts);
  const slice = content.slice((index - 1) * PAGE_PART_CHARS, index * PAGE_PART_CHARS);

  return JSON.stringify({
    page_id: page.id,
    mission_id: page.mission_id,
    title: page.title,
    part: index,
    total_parts: totalParts,
    chars_total: content.length,
    content: slice,
    next_part: index < totalParts ? index + 1 : null,
    hint: index < totalParts
      ? `Partie ${index}/${totalParts}. La page n'est PAS entièrement lue : appeler ` +
        `read_mission_page("${page.id}", ${index + 1}) pour la suite.`
      : `Partie ${index}/${totalParts}. Page lue en entier.`,
  });
}

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function readMediaImage(
  supabase: Supabase,
  mediaId: string,
  fullResolution: boolean,
  audit: AuditFn,
): Promise<{ data: string; mimeType: string }> {
  await audit(
    `read_media_image${fullResolution ? " (pleine résolution)" : ""}: ${mediaId.slice(0, 60)}`,
  );

  const { data: row, error } = await supabase
    .from("media")
    .select("file_name, file_url, mime_type")
    .eq("id", mediaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Media introuvable");

  const mime = (row.mime_type as string) || "";
  if (!mime.startsWith("image/")) {
    throw new Error(`Ce media n'est pas une image (${mime || "type inconnu"})`);
  }

  const fileUrl = row.file_url as string;

  // Version réduite via le transformateur d'images du storage quand
  // disponible (les photos d'atelier sortent de téléphone : plusieurs Mo).
  // resize=contain est OBLIGATOIRE : sans lui le transformateur applique son
  // mode par défaut `cover`, qui RECADRE l'image pour remplir le cadre au lieu
  // de l'y faire tenir — les bords (et donc du contenu manuscrit) sont perdus.
  let res: Response | null = null;
  if (!fullResolution && fileUrl.includes("/storage/v1/object/public/")) {
    const renderUrl =
      fileUrl.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") +
      "?width=1600&height=1600&resize=contain&quality=80";
    const r = await fetch(renderUrl);
    if (r.ok && (r.headers.get("content-type") || "").startsWith("image/")) {
      res = r;
    }
  }
  if (!res) {
    const r = await fetch(fileUrl);
    if (!r.ok) throw new Error(`Téléchargement impossible (${r.status})`);
    res = r;
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > IMAGE_MAX_BYTES) {
    throw new Error(
      `Image trop lourde (${Math.round(bytes.length / 1024)} Ko, max ${IMAGE_MAX_BYTES / 1024} Ko)`,
    );
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0] || mime;
  return { data: bytesToBase64(bytes), mimeType };
}

const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

/** Télécharge un fichier du storage, en s'authentifiant sur les buckets privés. */
async function downloadFile(url: string): Promise<Uint8Array> {
  const res = await fetch(url, {
    headers: url.includes("/authenticated/")
      ? { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}` }
      : {},
  });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Fichier trop lourd (${Math.round(bytes.length / 1024 / 1024)} Mo)`);
  }
  return bytes;
}

/** Résout un document dans les 3 tables de pièces jointes et le télécharge. */
async function fetchDocumentBytes(
  supabase: Supabase,
  documentId: string,
): Promise<{ bytes: Uint8Array; fileName: string; mimeType: string; transcriptPageId?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

  const { data: missionDoc } = await supabase
    .from("mission_documents")
    .select("file_name, file_url, mime_type, transcript_page_id")
    .eq("id", documentId)
    .maybeSingle();

  let url: string | null = null;
  let fileName = "";
  let mimeType = "";
  let transcriptPageId: string | undefined;

  if (missionDoc) {
    url = missionDoc.file_url as string;
    fileName = missionDoc.file_name as string;
    mimeType = (missionDoc.mime_type as string) || "";
    transcriptPageId = (missionDoc.transcript_page_id as string) ?? undefined;
  } else {
    for (const [table, bucket] of [
      ["crm_attachments", "crm-attachments"],
      ["support_ticket_attachments", "support-attachments"],
    ] as const) {
      const { data } = await supabase
        .from(table)
        .select("file_name, file_path, mime_type")
        .eq("id", documentId)
        .maybeSingle();
      if (data) {
        url = `${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${data.file_path}`;
        fileName = data.file_name as string;
        mimeType = (data.mime_type as string) || "";
        break;
      }
    }
  }

  if (!url) throw new Error("Document introuvable");

  return { bytes: await downloadFile(url), fileName, mimeType, transcriptPageId };
}

/**
 * Audio/vidéo : le fichier lui-même n'est pas lisible, mais SuperTools en a
 * peut-être déjà produit une transcription sous forme de page de mission.
 */
async function readAvTranscript(
  supabase: Supabase,
  fileName: string,
  mimeType: string,
  transcriptPageId?: string,
): Promise<{ text: string; found: boolean }> {
  if (transcriptPageId) {
    const { data: page } = await supabase
      .from("mission_pages")
      .select("title, content")
      .eq("id", transcriptPageId)
      .maybeSingle();
    if (page) {
      return {
        text: `Transcription de ${fileName} (page « ${page.title} ») :\n\n${page.content ?? ""}`,
        found: true,
      };
    }
  }
  return {
    text: `${fileName} est un fichier ${mimeType} sans transcription disponible dans SuperTools.`,
    found: false,
  };
}

export async function readDocument(
  supabase: Supabase,
  documentId: string,
  audit: AuditFn,
): Promise<ExtractedPart[]> {
  await audit(`read_document: ${documentId.slice(0, 60)}`);
  const { bytes, fileName, mimeType, transcriptPageId } = await fetchDocumentBytes(supabase, documentId);

  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    const av = await readAvTranscript(supabase, fileName, mimeType, transcriptPageId);
    return [{ kind: "text", text: av.text }];
  }

  const { parts, note } = await extractDocument(bytes, mimeType, fileName);
  return [{ kind: "text", text: note }, ...parts];
}

// ── Lecture en masse des documents d'une mission ─────────────
//
// Plafonds : une réponse MCP passe par le contexte du modèle, donc on borne
// explicitement. Rien n'est coupé en silence — tout ce qui n'est pas lu est
// listé avec son id pour être rappelé document par document.
const BULK_MAX_DOCUMENTS = 20;
export const BULK_DEFAULT_DOCUMENTS = 10;
const BULK_MAX_IMAGES = 20;
const BULK_MAX_TEXT_CHARS = 400_000;

interface BulkDocStatus {
  id: string;
  file_name: string;
  mime_type: string;
  status: string;
  detail?: string;
}

export async function readMissionDocuments(
  supabase: Supabase,
  missionQuery: string,
  onlyDeliverables: boolean,
  maxDocuments: number,
  includeImages: boolean,
  audit: AuditFn,
): Promise<ExtractedPart[]> {
  await audit(`read_mission_documents: ${missionQuery.slice(0, 200)}`);

  const resolved = await resolveMission(supabase, missionQuery, "id, title, client_name");
  if ("problem" in resolved) return [{ kind: "text", text: resolved.problem }];
  const mission = resolved.mission;

  let docReq = supabase
    .from("mission_documents")
    .select("id, file_name, file_url, mime_type, file_size, is_deliverable, transcript_page_id, created_at")
    .eq("mission_id", mission.id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (onlyDeliverables) docReq = docReq.eq("is_deliverable", true);

  const { data: allDocs, error } = await docReq;
  if (error) throw new Error(error.message);
  if (!allDocs?.length) {
    return [{
      kind: "text",
      text: JSON.stringify({
        mission: { id: mission.id, title: mission.title },
        documents_read: 0,
        hint: onlyDeliverables
          ? "Aucun document marqué livrable sur cette mission. Rappeler avec only_deliverables=false."
          : "Cette mission n'a aucun document attaché. Les pages et la galerie restent accessibles via get_mission_dossier.",
      }),
    }];
  }

  const limit = Math.min(Math.max(maxDocuments, 1), BULK_MAX_DOCUMENTS);
  const toRead = allDocs.slice(0, limit) as Array<Record<string, unknown>>;
  const skipped = allDocs.slice(limit) as Array<Record<string, unknown>>;

  const content: ExtractedPart[] = [];
  const statuses: BulkDocStatus[] = [];
  let imageBudget = includeImages ? BULK_MAX_IMAGES : 0;
  let textBudget = BULK_MAX_TEXT_CHARS;

  for (const [idx, doc] of toRead.entries()) {
    const fileName = (doc.file_name as string) || "(sans nom)";
    const mime = ((doc.mime_type as string) || "").toLowerCase();
    const header = `=== Document ${idx + 1}/${toRead.length} — ${fileName} (${mime || "type inconnu"}, id ${doc.id}) ===`;

    try {
      if (mime.startsWith("audio/") || mime.startsWith("video/")) {
        const av = await readAvTranscript(
          supabase,
          fileName,
          mime,
          (doc.transcript_page_id as string) ?? undefined,
        );
        const room = Math.max(textBudget, 0);
        const cut = av.text.length > room;
        const text = cut
          ? av.text.slice(0, room) +
            `… [tronqué : plafond de la réponse atteint — relire avec read_document("${doc.id}")]`
          : av.text;
        textBudget -= Math.min(av.text.length, room);
        content.push({ kind: "text", text: `${header}\n${text}` });
        statuses.push({
          id: doc.id as string,
          file_name: fileName,
          mime_type: mime,
          status: av.found ? (cut ? "transcription_tronquée" : "transcription") : "sans_transcription",
        });
        continue;
      }

      const bytes = await downloadFile(doc.file_url as string);
      const { parts, note } = await extractDocument(bytes, mime, fileName);

      const blocks: ExtractedPart[] = [];
      let textChars = 0;
      let imagesUsed = 0;
      let imagesDropped = 0;
      let textTruncated = false;

      for (const part of parts) {
        if (part.kind === "text" && part.text) {
          const fits = part.text.length <= textBudget;
          if (!fits) textTruncated = true;
          // Budget texte épuisé : on continue quand même la boucle, les parts
          // image restantes peuvent encore tenir dans leur propre plafond.
          if (textBudget <= 0) continue;
          const text = fits
            ? part.text
            : part.text.slice(0, textBudget) + "… [tronqué : plafond de la réponse atteint]";
          textBudget -= Math.min(part.text.length, textBudget);
          textChars += text.length;
          blocks.push({ kind: "text", text });
        } else if (part.kind === "image" && part.data) {
          if (imageBudget <= 0) {
            imagesDropped++;
            continue;
          }
          imageBudget--;
          imagesUsed++;
          blocks.push({ kind: "image", data: part.data, mimeType: part.mimeType });
        }
      }

      const warnings: string[] = [];
      if (imagesDropped) {
        warnings.push(
          `${imagesDropped} page(s) image non renvoyée(s) ` +
            `(${includeImages ? "plafond d'images atteint" : "include_images=false"}) — ` +
            `relire ce document seul avec read_document("${doc.id}").`,
        );
      }
      if (textTruncated) {
        warnings.push(`Texte tronqué — relire ce document seul avec read_document("${doc.id}").`);
      }

      content.push({
        kind: "text",
        text: `${header}\n${note}${warnings.length ? "\n" + warnings.join("\n") : ""}`,
      });
      content.push(...blocks);

      statuses.push({
        id: doc.id as string,
        file_name: fileName,
        mime_type: mime,
        status: blocks.length ? "lu" : "illisible",
        detail: blocks.length
          ? `${textChars} caractères, ${imagesUsed} image(s)${warnings.length ? " — " + warnings.join(" ") : ""}`
          : note,
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : "échec";
      content.push({ kind: "text", text: `${header}\nLecture impossible : ${detail}` });
      statuses.push({
        id: doc.id as string,
        file_name: fileName,
        mime_type: mime,
        status: "erreur",
        detail,
      });
    }
  }

  content.unshift({
    kind: "text",
    text: JSON.stringify({
      mission: { id: mission.id, title: mission.title, client_name: mission.client_name },
      total_documents: allDocs.length,
      documents_read: toRead.length,
      documents: statuses,
      not_read: skipped.map((d) => ({ id: d.id, file_name: d.file_name, mime_type: d.mime_type })),
      hint: skipped.length
        ? `${skipped.length} document(s) non lu(s) dans cet appel : rappeler read_mission_documents avec max_documents plus élevé (max ${BULK_MAX_DOCUMENTS}) ou read_document sur les id listés dans not_read.`
        : "Tous les documents de la mission ont été lus. Les pages et la galerie s'obtiennent avec get_mission_dossier, les photos avec read_media_image.",
    }),
  });

  return content;
}

const NOTE_PREFIX = "Note agent — ";
export const NOTE_MAX_CHARS = 200_000;

/**
 * Unique écriture du serveur : crée ou met à jour UNE page de mission.
 * Aucune suppression, aucune autre table. Titre préfixé pour que la page soit
 * identifiable comme produite par l'agent.
 */
export async function saveMissionNote(
  supabase: Supabase,
  missionId: string,
  title: string,
  content: string,
  mode: string,
  audit: AuditFn,
): Promise<string> {
  if (!UUID_RE.test(missionId.trim())) {
    throw new Error("mission_id doit être un UUID (utiliser get_mission_dossier pour le trouver)");
  }
  if (content.length > NOTE_MAX_CHARS) {
    throw new Error(`Contenu trop long (${content.length} caractères, max ${NOTE_MAX_CHARS})`);
  }

  const { data: mission } = await supabase
    .from("missions")
    .select("id, title")
    .eq("id", missionId)
    .maybeSingle();
  if (!mission) throw new Error("Mission introuvable");

  const fullTitle = title.startsWith(NOTE_PREFIX) ? title : `${NOTE_PREFIX}${title}`;
  await audit(
    `save_mission_note (${mode}) sur ${mission.title}: ${fullTitle.slice(0, 120)}`,
  );

  const { data: existing } = await supabase
    .from("mission_pages")
    .select("id, content")
    .eq("mission_id", missionId)
    .eq("title", fullTitle)
    .maybeSingle();

  if (existing) {
    const next =
      mode === "append" ? `${(existing.content as string) ?? ""}\n${content}` : content;
    if (next.length > NOTE_MAX_CHARS) {
      throw new Error(`Note trop longue après ajout (${next.length} caractères)`);
    }
    const { error } = await supabase
      .from("mission_pages")
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return JSON.stringify({
      saved: true,
      page_id: existing.id,
      title: fullTitle,
      mode,
      total_chars: next.length,
    });
  }

  const { data: last } = await supabase
    .from("mission_pages")
    .select("position")
    .eq("mission_id", missionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("mission_pages")
    .insert({
      mission_id: missionId,
      title: fullTitle,
      content,
      icon: "🤖",
      position: ((last?.position as number) ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return JSON.stringify({
    saved: true,
    page_id: created.id,
    title: fullTitle,
    mode: "create",
    total_chars: content.length,
  });
}

// ── Écriture de documents de mission (additive) ──────────────

const DOCUMENT_BUCKET = "mission-documents";

/**
 * Formats acceptés : ce qu'un agent sait produire comme livrable (schéma
 * vectoriel, capture, page exportée, rapport). Tout le reste est refusé — ce
 * tool n'est pas un dépôt de fichiers générique.
 */
export const DOCUMENT_MIME_ALLOWLIST = [
  "image/png",
  "image/svg+xml",
  "text/html",
  "text/markdown",
  "application/pdf",
];

/**
 * Plafond du fichier DÉCODÉ. Le base64 pèse un tiers de plus et voyage dans le
 * corps JSON d'un unique appel MCP (client -> worker Cloudflare -> edge
 * function) : 3 Mo décodés font une requête d'environ 4 Mo. Au-delà, c'est le
 * transport qui lâche, avec une erreur illisible côté client — donc on refuse
 * ici, en annonçant la limite.
 */
export const DOCUMENT_MAX_BYTES = 3 * 1024 * 1024;

/** Longueur base64 correspondante : 4 caractères pour 3 octets. */
const DOCUMENT_MAX_BASE64_CHARS = Math.ceil(DOCUMENT_MAX_BYTES / 3) * 4;

function tooLarge(bytes: number): Error {
  return new Error(
    `Fichier trop lourd (${Math.round(bytes / 1024)} Ko décodés, limite ${
      Math.round(DOCUMENT_MAX_BYTES / 1024)
    } Ko soit ${DOCUMENT_MAX_BYTES / (1024 * 1024)} Mo). ` +
      "Réduire le fichier (compresser un PNG, préférer un SVG à une image matricielle, " +
      "découper un PDF) puis rappeler le tool.",
  );
}

/** Même règle que l'application (`src/lib/file-utils.ts`). */
function sanitizeDocumentFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase();
}

function decodeBase64(input: string): Uint8Array {
  // Tolère un préfixe data: et les retours à la ligne du base64 MIME.
  const cleaned = input.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (!cleaned) throw new Error("content_base64 est vide");

  let binary: string;
  try {
    binary = atob(cleaned);
  } catch {
    throw new Error("content_base64 n'est pas du base64 valide (encodage standard attendu)");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Deuxième écriture du serveur, et strictement additive : elle CRÉE un
 * document de mission, jamais elle n'en remplace ni n'en supprime un.
 *
 * Garde-fous, dans le même esprit que saveMissionNote :
 *   - allowlist de types (DOCUMENT_MIME_ALLOWLIST), pas de fichier arbitraire ;
 *   - plafond de taille calé sur le transport, refusé avec la limite en clair ;
 *   - chemin horodaté + `upsert: false` : deux appels ne peuvent pas viser le
 *     même objet de storage, donc aucun écrasement possible ;
 *   - si l'insertion en base échoue, le fichier est retiré du bucket : pas de
 *     ligne sans fichier, pas de fichier sans ligne.
 *
 * `description` n'a pas de colonne dédiée dans `mission_documents` : elle est
 * journalisée dans l'audit, avec le nom du fichier et la mission.
 */
export async function saveMissionDocument(
  supabase: Supabase,
  missionId: string,
  fileName: string,
  mimeType: string,
  contentBase64: string,
  isDeliverable: boolean,
  description: string,
  audit: AuditFn,
): Promise<string> {
  if (!UUID_RE.test(missionId.trim())) {
    throw new Error("mission_id doit être un UUID (utiliser get_mission_dossier pour le trouver)");
  }
  const name = fileName.trim();
  if (!name) throw new Error("file_name est requis");

  const mime = (mimeType || "").trim().toLowerCase().split(";")[0];
  if (!DOCUMENT_MIME_ALLOWLIST.includes(mime)) {
    throw new Error(
      `Type de fichier refusé (${mimeType || "vide"}). Types acceptés : ${DOCUMENT_MIME_ALLOWLIST.join(", ")}.`,
    );
  }

  // Refus avant décodage : inutile de matérialiser 10 Mo pour les jeter.
  if (contentBase64.length > DOCUMENT_MAX_BASE64_CHARS) {
    throw tooLarge(Math.floor((contentBase64.length * 3) / 4));
  }
  const bytes = decodeBase64(contentBase64);
  if (bytes.length > DOCUMENT_MAX_BYTES) throw tooLarge(bytes.length);
  if (!bytes.length) throw new Error("content_base64 est vide");

  const { data: mission } = await supabase
    .from("missions")
    .select("id, title")
    .eq("id", missionId)
    .maybeSingle();
  if (!mission) throw new Error("Mission introuvable");

  await audit(
    `save_mission_document sur ${mission.title}: ${name.slice(0, 120)} ` +
      `(${mime}, ${bytes.length} octets, livrable=${isDeliverable})` +
      (description ? ` — ${description.slice(0, 300)}` : ""),
  );

  // Même convention de chemin que l'upload de l'application
  // (upload-mission-document) : l'horodatage rend chaque objet unique, donc
  // `upsert: false` ne peut jamais entrer en collision avec un fichier existant.
  const path = `${missionId}/docs/${Date.now()}_${sanitizeDocumentFileName(name)}`;

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (uploadError) throw new Error(`Upload impossible : ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(path);
  const fileUrl = urlData.publicUrl;

  const { data: created, error } = await supabase
    .from("mission_documents")
    .insert({
      mission_id: missionId,
      file_name: name,
      file_url: fileUrl,
      mime_type: mime,
      file_size: bytes.length,
      is_deliverable: isDeliverable,
      processing_status: "none",
    })
    .select("id")
    .single();

  if (error) {
    // Pas de ligne, pas de fichier : on ne laisse pas d'orphelin dans le bucket.
    await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
    throw new Error(error.message);
  }

  return JSON.stringify({
    saved: true,
    id: created.id,
    file_url: fileUrl,
    file_size: bytes.length,
    file_name: name,
    mime_type: mime,
    is_deliverable: isDeliverable,
    mission: { id: mission.id, title: mission.title },
    hint:
      "Document créé et visible dans les documents de la mission " +
      "(get_mission_dossier le liste, read_document le relit). " +
      "Rien n'a été remplacé : un nouvel appel avec le même nom crée un second document.",
  });
}

export async function getClientDossier(
  supabase: Supabase,
  client: string,
  audit: AuditFn,
): Promise<string> {
  await audit(`get_client_dossier: ${client.slice(0, 200)}`);
  const pattern = `%${client}%`;

  const [missions, trainings, quotes, cards, transcripts] = await Promise.all([
    supabase
      .from("missions")
      .select("id, title, client_name, client_contact, status, initial_amount, consumed_amount, created_at")
      .ilike("client_name", pattern)
      .limit(20),
    supabase
      .from("trainings")
      .select("id, training_name, client_name, start_date, end_date, location, is_cancelled")
      .ilike("client_name", pattern)
      .order("start_date", { ascending: false })
      .limit(20),
    supabase
      .from("quotes")
      .select("id, quote_number, client_company, client_email, status, total_ht, issue_date, crm_card_id")
      .ilike("client_company", pattern)
      .order("issue_date", { ascending: false })
      .limit(20),
    supabase
      .from("crm_cards")
      .select("id, title, sales_status, estimated_value, email, waiting_next_action_text, created_at")
      .ilike("title", pattern)
      .limit(20),
    supabase
      .from("transcripts")
      .select("id, title, summary, source, created_at")
      .eq("status", "ready")
      .ilike("title", pattern)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const cardIds = (cards.data || []).map((c: Record<string, unknown>) => c.id);
  const comments = cardIds.length
    ? await supabase
        .from("crm_comments")
        .select("card_id, content, author_email, created_at")
        .in("card_id", cardIds)
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] };

  return JSON.stringify({
    client_query: client,
    missions: missions.data || [],
    trainings: trainings.data || [],
    quotes: quotes.data || [],
    crm_cards: cards.data || [],
    crm_comments: comments.data || [],
    transcripts: transcripts.data || [],
    hint: "Pour le contenu détaillé d'une mission, utiliser get_mission_dossier. Pour chercher dans le texte des transcripts et notes, utiliser search_content.",
  });
}
