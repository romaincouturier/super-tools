/**
 * Données « canari » : chaque valeur identifiante porte un marqueur unique.
 * Le mode démo les masque (« Zqxnom » → « Z•••m ») : si un marqueur se lit en
 * entier à l'écran, c'est une fuite.
 *
 * Les tables de l'équipe SuperTilt (profils, formateurs) et le catalogue
 * (prix publics) ne reçoivent pas de canari : ils restent visibles en démo.
 */
import type { Column, Schema } from "./schema";

export const FIXED_ID = "00000000-0000-4000-8000-000000000001";
export const USER_ID = "00000000-0000-4000-8000-0000000000aa";

export type Canary = { token: string; kind: string };

/** Marqueurs recherchés dans le texte rendu. Le montant est cherché sans séparateurs. */
export const CANARIES: Canary[] = [
  { token: "Zqxprenom", kind: "prénom" },
  { token: "Zqxnom", kind: "nom" },
  { token: "zqx.contact@zqx-client.fr", kind: "email" },
  { token: "Zqxsociete", kind: "société" },
  { token: "Zqxadresse", kind: "adresse" },
  { token: "0699887766", kind: "téléphone" },
  { token: "999888777", kind: "SIREN/SIRET" },
  { token: "987654", kind: "montant" },
  { token: "zqxfichier", kind: "nom de fichier" },
  { token: "Zqxtitre", kind: "titre client (mission, opportunité)" },
];

/** SuperTilt, son équipe et ses fournisseurs : visibles en démo (règle 4 de la skill). */
const TEAM_TABLES = new Set([
  "profiles", "trainers", "user_security_metadata", "user_module_access",
  "quote_settings", "supertilt_settings", "crm_settings", "ai_brand_settings", "organizations", "book_profiles",
  "trainer_documents", "trainer_evaluations", "trainer_training_adequacy", "trainer_attendance_signatures", "training_venues",
]);
/** Prix publics : catalogue de formations, jeux, formules d'abonnement. */
const CATALOG_TABLES = new Set(["formation_configs", "formation_formulas", "games", "billing_plans", "subscriptions"]);
/** Colonnes qui désignent l'équipe SuperTilt dans une table client. */
const TEAM_COLUMNS = new Set([
  "trainings.pedagogical_referent_email", "trainings.pedagogical_referent_name", "trainings.trainer_name",
  "support_tickets.submitted_by_email", "support_tickets.assigned_to",
]);
/** Titres qui nomment en pratique un client : masqués en démo (maskText). */
const CLIENT_TITLE_TABLES = new Set(["missions", "crm_cards"]);

function canaryString(table: string, col: string): string | null {
  if (TEAM_TABLES.has(table) || CATALOG_TABLES.has(table) || TEAM_COLUMNS.has(`${table}.${col}`)) return null;
  const c = col.toLowerCase();
  if (/email/.test(c)) return "zqx.contact@zqx-client.fr";
  if (/(^|_)(first_name|prenom)$/.test(c)) return "Zqxprenom";
  if (/(^|_)(last_name|nom)$/.test(c)) return "Zqxnom";
  if (/(full_name|contact_name|customer_name|respondent_name|stakeholder_name|sponsor_name|author_display_name)$/.test(c))
    return "Zqxprenom Zqxnom";
  if (/(company|societe|client_name|client_company|financeur_name|acheteur|partner_name)$/.test(c)) return "Zqxsociete";
  if (/(address|adresse|city|postal_code|zip)$/.test(c)) return "12 rue Zqxadresse";
  if (/(phone|telephone|mobile)/.test(c)) return "0699887766";
  if (/(siren|siret|reg_no|vat_number)$/.test(c)) return "999888777";
  if (/(file_name|original_filename|pdf_name|drive_file_name)$/.test(c)) return "zqxfichier-client.pdf";
  if (CLIENT_TITLE_TABLES.has(table) && c === "title") return "Zqxtitre";
  return null;
}

const AMOUNT_RE = /(amount|montant|price|prix|total_ht|total_ttc|total_vat|sold_price|billable|revenue|estimated_value|daily_rate|budget|cost_price|_ttc$|_ht$)/;
const DATE_RE = /(_at|_date|date_|_on|deadline|_start|_end|_for|_until|_since|expires|expiry)$|^date$|date|scheduled/;
const TIME_RE = /(start_time|end_time|_time)$/;

function uuid(i: number): string {
  return `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
}

export function valueFor(schema: Schema, table: string, col: Column, i: number): unknown {
  const t = col.type.replace(/\s/g, "");
  const nullable = /\|null/.test(t);
  const base = t.replace(/\|null/g, "");
  const name = col.name;

  if (name === "id") return uuid(i);
  if (/_id$/.test(name) && base === "string") return name === "user_id" ? USER_ID : FIXED_ID;

  const enumMatch = base.match(/Enums"\]\["([a-z_]+)"\]/);
  if (enumMatch) return schema.enums[enumMatch[1]]?.[0] ?? null;
  if (/^"[^"]*"(\|"[^"]*")*$/.test(base)) return base.split("|")[0].replace(/"/g, "");

  if (base === "string") {
    if (TIME_RE.test(name)) return "09:30";
    if (DATE_RE.test(name)) return new Date(Date.UTC(2026, 8, 20 + i, 9)).toISOString();
    const canary = canaryString(table, name);
    if (canary) return canary;
    if (/(url|link)$/.test(name)) return "https://example.test/doc";
    if (/(status|state|type|kind|category|mode|role|source|language|format)$/.test(name)) return "draft";
    if (/color$/.test(name)) return "#3b82f6";
    if (/emoji|icon/.test(name)) return "📄";
    if (/(html|content|body|description|notes|summary|text|comment|message)/.test(name)) return "Texte de démonstration";
    return `Démo ${name}`;
  }
  if (base === "number") {
    if (!CATALOG_TABLES.has(table) && !TEAM_TABLES.has(table) && AMOUNT_RE.test(name)) return 987654.32;
    return 3;
  }
  if (base === "boolean") return false;
  if (base.endsWith("[]")) return base.startsWith("string") ? [] : [];
  if (base === "Json") return nullable ? null : {};
  return nullable ? null : "";
}

export function rowsFor(schema: Schema, table: string, count = 3): Record<string, unknown>[] {
  const cols = schema.tables[table];
  if (!cols) return [];
  return Array.from({ length: count }, (_, i) =>
    Object.fromEntries(cols.map((c) => [c.name, valueFor(schema, table, c, i)])),
  );
}
