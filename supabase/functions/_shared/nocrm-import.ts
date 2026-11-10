/**
 * Règles pures de l'import de l'historique noCRM (CSV -> crm_cards).
 * Partagées par la fonction nocrm-import et testées sans réseau.
 */

export type Row = Record<string, string>;

/** Parseur CSV RFC 4180 (guillemets, virgules et sauts de ligne dans les champs). */
export function parseCsv(text: string): Row[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let field = "";
  let rec: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { rec.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      rec.push(field); field = "";
      records.push(rec); rec = [];
    } else field += c;
  }
  if (field !== "" || rec.length) { rec.push(field); records.push(rec); }
  const nonEmpty = records.filter((r) => r.some((v) => v.trim() !== ""));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

export const splitMulti = (v: string | undefined): string[] =>
  (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const parisDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Paris", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

function parisOffsetMinutes(utcMs: number): number {
  const parts = parisDateFormatter.formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUtc - utcMs) / 60000);
}

/** « 2020-01-21 10:34 » (heure de Paris) -> ISO UTC. null si vide ou invalide. */
export function parisToIso(v: string | undefined): string | null {
  const m = (v ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  if (isNaN(naive)) return null;
  let utc = naive - parisOffsetMinutes(naive) * 60000;
  utc = naive - parisOffsetMinutes(utc) * 60000;
  return new Date(utc).toISOString();
}

export const datePart = (v: string | undefined): string | null => {
  const m = (v ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

export function parseAmount(v: string | undefined): number {
  let s = (v ?? "").replace(/[\s\u00a0€]/g, "");
  if (!s) return 0;
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

export function textToHtml(text: string | undefined): string | null {
  const t = (text ?? "").replace(/\r\n?/g, "\n").trim();
  if (!t) return null;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return t.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

export type SalesStatus = "OPEN" | "WON" | "LOST" | "CANCELED";
export function mapStatus(v: string | undefined): SalesStatus | null {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "won") return "WON";
  if (s === "lost") return "LOST";
  if (s === "cancelled" || s === "canceled") return "CANCELED";
  if (s === "todo" || s === "standby") return "OPEN";
  return null;
}

export type StepName = "Entrant" | "Contacté" | "Devis envoyé";
export function mapStep(v: string | undefined): StepName | null {
  const s = (v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.startsWith("entrant")) return "Entrant";
  if (s.startsWith("contact")) return "Contacté";
  if (s.startsWith("devis")) return "Devis envoyé";
  return null;
}

const ORIGIN_TO_SOURCE: Record<string, string> = {
  "Site": "site_web", "Nouvelle mission": "nouvelle_mission", "Réseau": "reseau", "LinkedIn": "linkedin", "Téléphone": "appel_entrant",
};
export const mapAcquisitionSource = (origines: string[]): string | null =>
  origines.length ? ORIGIN_TO_SOURCE[origines[0]] ?? "autre" : null;

export function mapServiceType(types: string[]): "formation" | "mission" | null {
  if (types.includes("Formation")) return "formation";
  if (types.includes("Prestation")) return "mission";
  return null;
}

const LOSS_MAP: Array<[RegExp, string]> = [
  [/fausse|spam|erreur/i, "fausse_demande"],
  [/prix|cher|tarif/i, "prix"],
  [/budget/i, "pas_de_budget"],
  [/concurren/i, "concurrent"],
  [/r[ée]pon|silence|injoignable/i, "pas_de_reponse"],
  [/timing|calendrier|report|d[ée]lai/i, "timing"],
  [/dispo/i, "indisponible"],
  [/cpf|financement|opco/i, "financement_cpf"],
  [/qualifi|besoin/i, "besoin_non_qualifie"],
  [/no.?go/i, "no_go"],
  [/avis|abandon/i, "changement_avis"],
];
/** Première valeur -> code SuperTools (autre si inconnue) ; détail = toutes les valeurs. */
export function mapLossReason(values: string[]): { reason: string | null; detail: string | null } {
  if (!values.length) return { reason: null, detail: null };
  const hit = LOSS_MAP.find(([re]) => re.test(values[0]));
  return { reason: hit ? hit[1] : "autre", detail: values.join(", ") };
}

/** [catégorie crm_tags, nom du tag] par colonne noCRM ; null = pas de tag ; undefined = valeur inconnue. */
type TagRule = Record<string, [string, string] | null>;
export const TAG_RULES: Record<string, TagRule> = {
  "Univers": {
    "Facilitation graphique": ["Univers", "Facilitation graphique"],
    "Intelligence Collective": ["Univers", "Intelligence collective"],
    "Intelligence collective": ["Univers", "Intelligence collective"],
    "Intelligence artificielle": ["Univers", "Intelligence artificielle"],
    "Agilité": ["Univers", "Transformation"],
    "Organisation du travail": ["Univers", "Organisation du travail"],
    "Misc": null, "E-learning": null, "Wordpress": null, "Boutique": null,
  },
  "Type": {
    "Formation": ["Type", "Formation"], "Prestation": ["Type", "Conseil"], "Jeu": ["Type", "Jeu"],
    "Conférence": ["Type", "Conférence"], "Interne": null,
  },
  "Cible": {
    "Coach/Formateur/Consultant": ["Cible", "Consultant/formateur"],
    "Service RH": ["Cible", "RH"],
    "ESN / Cabinet de conseils": ["Cible", "ESN"],
    "Agence de communication / Evènementiel": ["Cible", "Agence comm'/ Evènementiel"],
    "Chômeur/En reconversion": ["Cible", "Chômeur/Reconversion"],
    "DSI/R&D/Change": ["Cible", "DSI/R&D/Change"], "Association": ["Cible", "Association"], "Autre": ["Cible", "Autre"],
    "Editeur logiciel": ["Cible", "Editeur logiciel"], "Ecole/Université": ["Cible", "Ecole/Université"], "Cluster": ["Cible", "Cluster"],
    "Public": ["Taille", "Public"], "Particulier": ["Taille", "Particulier"],
  },
  "Origine": {
    "Site": ["Origine", "Site"], "Nouvelle mission": ["Origine", "Nouvelle mission"], "Réseau": ["Origine", "Réseau"],
    "LinkedIn": ["Origine", "LinkedIn"], "Téléphone": ["Origine", "Téléphone"], "Newsletter": ["Origine", "Newsletter"],
    "Picto Challenge": ["Origine", "Picto Challenge"], "Conférence/Evènement": ["Origine", "Evènement"],
  },
  "Déplacement induit": {
    "Aucun": ["Déplacement induit", "Aucun"], "Train": ["Déplacement induit", "Train"],
    "Voiture": ["Déplacement induit", "Voiture"], "Avion": ["Déplacement induit", "Avion"],
  },
  "Qualiopi déterminant ?": {
    "Pas utile": ["Qualiopi déterminant ?", "Pas utile"], "Déterminant": ["Qualiopi déterminant ?", "Déterminant"],
    "Ne sait pas": ["Qualiopi déterminant ?", "Inconnu"],
  },
  "Catalogue de formation à envoyer ?": {
    "Oui": ["Catalogue de formation à envoyer", "Oui"], "Non": ["Catalogue de formation à envoyer", "Non"],
  },
  "Achat en ligne": {
    "Sur devis": ["Achat", "Sur devis"], "En ligne": ["Achat", "En ligne"],
  },
};
/** Tags à créer s'ils n'existent pas (seules créations autorisées par la spec). */
export const TAGS_TO_CREATE: Array<[string, string]> = [["Univers", "Organisation du travail"], ["Type", "Conférence"]];

export const tagKey = (category: string, name: string) => `${category.toLowerCase()}|${name.toLowerCase()}`;

export function leadTags(lead: Row): { tags: Array<[string, string]>; unknown: Array<{ column: string; value: string }> } {
  const tags: Array<[string, string]> = [];
  const unknown: Array<{ column: string; value: string }> = [];
  for (const [column, rule] of Object.entries(TAG_RULES)) {
    for (const value of splitMulti(lead[column])) {
      if (!(value in rule)) { unknown.push({ column, value }); continue; }
      const t = rule[value];
      if (t && !tags.some(([c, n]) => c === t[0] && n === t[1])) tags.push(t);
    }
  }
  return { tags, unknown };
}

export interface NocrmComment {
  nocrmId: string;
  at: string | null;
  activityType: string;
  content: string;
  isNote: boolean;
  ordinal: number; // rang dans le fichier pour cette fiche (clé d'idempotence)
}

export function groupComments(rows: Row[]): Map<string, NocrmComment[]> {
  const map = new Map<string, NocrmComment[]>();
  for (const r of rows) {
    const id = (r.nocrm_id ?? "").trim();
    if (!id) continue;
    const list = map.get(id) ?? [];
    list.push({
      nocrmId: id,
      at: parisToIso(r.commented_at),
      activityType: (r.activity_type ?? "").trim(),
      content: r.content ?? "",
      isNote: (r.is_note ?? "").trim().toLowerCase() === "true",
      ordinal: list.length,
    });
    map.set(id, list);
  }
  return map;
}

export const hasActivityLabel = (t: string) => !!t && t !== "Pas dispo ou vide";
export const noteContent = (c: NocrmComment) => (hasActivityLabel(c.activityType) ? `[${c.activityType}] ${c.content.trim()}` : c.content.trim());

/** Texte complet d'une activité noCRM pour l'historique : type et contenu. */
export const activityContent = (c: NocrmComment) => noteContent(c) || c.activityType.trim() || null;

const clamp = (iso: string, min: string, max: string | null) => {
  if (iso < min) return min;
  if (max && iso > max) return max;
  return iso;
};

export interface HistoryEvent {
  action_type: "card_created" | "card_moved" | "sales_status_changed";
  at: string;
  old_value: string | null;
  new_value: string | null;
  estimated: boolean;
}

/**
 * Historique reconstitué : création (Entrant), Contacté et Devis envoyé estimés, clôture.
 * Toujours chronologique, borné entre création et clôture.
 */
export function buildHistory(input: {
  title: string;
  createdAt: string;
  firstActivity: string | null;
  closedAt: string | null;
  step: StepName | null;
  status: SalesStatus;
  comments: NocrmComment[];
  columnIds: Record<"Entrant" | "Contacté" | "Devis envoyé" | "Gagné" | "Perdu", string>;
}): HistoryEvent[] {
  const { createdAt, step, status, columnIds } = input;
  const closed = status !== "OPEN" ? (input.closedAt && input.closedAt >= createdAt ? input.closedAt : createdAt) : null;
  const events: HistoryEvent[] = [{ action_type: "card_created", at: createdAt, old_value: null, new_value: input.title, estimated: false }];
  let current = columnIds["Entrant"];
  let last = createdAt;
  const fa = input.firstActivity ?? createdAt;
  if (step === "Contacté" || step === "Devis envoyé") {
    const at = clamp(fa, last, closed);
    events.push({ action_type: "card_moved", at, old_value: current, new_value: columnIds["Contacté"], estimated: true });
    current = columnIds["Contacté"]; last = at;
  }
  if (step === "Devis envoyé") {
    const kw = /proposition-commerciale\.fr|devis|proposition/i;
    const hit = input.comments.filter((c) => c.at && kw.test(c.content)).map((c) => c.at!).sort()[0];
    const at = clamp(hit ?? fa, last, closed);
    events.push({ action_type: "card_moved", at, old_value: current, new_value: columnIds["Devis envoyé"], estimated: true });
    current = columnIds["Devis envoyé"]; last = at;
  }
  if (closed) {
    const at = clamp(closed, last, null);
    events.push({ action_type: "sales_status_changed", at, old_value: "OPEN", new_value: status, estimated: false });
    events.push({ action_type: "card_moved", at, old_value: current, new_value: status === "WON" ? columnIds["Gagné"] : columnIds["Perdu"], estimated: false });
  }
  return events;
}

/** Fiche SuperTools fusionnable : même email (casse ignorée), création à moins de 30 jours. */
export function findMergeTarget<T extends { id: string; email: string | null; created_at: string }>(
  email: string, createdAt: string, candidates: T[], taken: Set<string>,
): T | null {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const ms = new Date(createdAt).getTime();
  const DAY = 86_400_000;
  return candidates
    .filter((c) => !taken.has(c.id) && (c.email ?? "").trim().toLowerCase() === e && Math.abs(new Date(c.created_at).getTime() - ms) < 30 * DAY)
    .sort((a, b) => Math.abs(new Date(a.created_at).getTime() - ms) - Math.abs(new Date(b.created_at).getTime() - ms))[0] ?? null;
}

/** Champs crm_cards d'une fiche importée (hors column_id, résolu par l'appelant). */
export function mapLeadToCard(lead: Row) {
  const status = mapStatus(lead.Status) ?? "OPEN";
  const createdAt = parisToIso(lead.Created_at);
  const closedAt = parisToIso(lead.Closed_at);
  const loss = status === "LOST" || status === "CANCELED" ? mapLossReason(splitMulti(lead["Raison de la perte de l_affaire"])) : { reason: null, detail: null };
  const origines = splitMulti(lead.Origine);
  const open = status === "OPEN";
  const remind = open ? datePart(lead.Remind_date) : null;
  const remindText = open ? (lead.Reminder_note ?? "").trim() || null : null;
  return {
    status,
    createdAt,
    closedAt,
    card: {
      title: (lead.Lead ?? "").trim() || `Fiche noCRM ${lead.ID}`,
      first_name: (lead["Prénom"] ?? "").trim() || null,
      last_name: (lead.Nom ?? "").trim() || null,
      phone: (lead["Téléphone"] ?? "").trim() || null,
      email: (lead["E-mail"] ?? "").trim() || null,
      description_html: textToHtml(lead.Description),
      raw_input: lead.Description ?? null,
      sales_status: status,
      estimated_value: parseAmount(lead.Amount),
      won_at: status === "WON" ? closedAt : null,
      lost_at: status === "LOST" || status === "CANCELED" ? closedAt : null,
      expected_close_date: datePart(lead.Estimated_closing_date),
      loss_reason: loss.reason,
      loss_reason_detail: loss.detail,
      acquisition_source: mapAcquisitionSource(origines),
      service_type: mapServiceType(splitMulti(lead.Type)),
      waiting_next_action_date: remind,
      waiting_next_action_text: remindText,
      status_operational: remind ? "WAITING" : "TODAY",
    },
  };
}
