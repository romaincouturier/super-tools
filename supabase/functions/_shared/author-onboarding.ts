/**
 * Onboarding auteur dropshipping : règles pures partagées par la fonction
 * `author-onboarding`, les relances et leurs tests. Aucun import réseau.
 */

export const INVITATION_DAYS = 30;
export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MIN_INTERVAL_MS = 60_000;
export const OTP_MAX_SENDS = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 20;
export const MAX_PDFS = 3;
export const FILE_MIME: Record<string, string[]> = {
  logo: ["image/png", "image/jpeg", "image/webp"],
  photo: ["image/png", "image/jpeg", "image/webp"],
  pdf: ["application/pdf"],
};

export const AUTHOR_STATUSES = ["invited", "form_in_progress", "form_submitted", "contract_sent", "signed", "online"] as const;
export type AuthorStatus = typeof AUTHOR_STATUSES[number];
export const AUTHOR_STATUS_LABELS: Record<AuthorStatus, string> = {
  invited: "Invité",
  form_in_progress: "Formulaire en cours",
  form_submitted: "Formulaire soumis",
  contract_sent: "Contrat envoyé",
  signed: "Contrat signé",
  online: "Fiche en ligne",
};

type FieldType = "text" | "longtext" | "email" | "url" | "number" | "int" | "bool";
export const FORM_FIELDS: Record<string, { type: FieldType; max?: number }> = {
  legal_name: { type: "text", max: 200 },
  postal_address: { type: "longtext", max: 500 },
  legal_rep_first_name: { type: "text", max: 100 },
  legal_rep_last_name: { type: "text", max: 100 },
  siren: { type: "text", max: 20 },
  phone: { type: "text", max: 30 },
  game_name: { type: "text", max: 150 },
  author_email: { type: "email", max: 254 },
  pitch: { type: "longtext", max: 1000 },
  price_ht: { type: "number" },
  game_page_url: { type: "url", max: 500 },
  video_url: { type: "url", max: 500 },
  long_description: { type: "longtext", max: 10000 },
  credits: { type: "longtext", max: 2000 },
  weight_g: { type: "int" },
  package_dimensions: { type: "text", max: 100 },
  shipping_fee: { type: "number" },
  shipping_delay: { type: "text", max: 100 },
  location_enabled: { type: "bool" },
  location_duration_days: { type: "int" },
  location_price_ht: { type: "number" },
  location_late_fee_month: { type: "number" },
  location_replacement_price: { type: "number" },
  testimonials: { type: "longtext", max: 5000 },
  other_info: { type: "longtext", max: 5000 },
};

export type FormData = Record<string, string | number | boolean | null>;

// deno-lint-ignore no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Garde uniquement les champs connus, bornés et typés. Valeurs invalides → null. */
export function sanitizeForm(input: unknown): FormData {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: FormData = {};
  for (const [key, def] of Object.entries(FORM_FIELDS)) {
    const raw = src[key];
    if (raw === undefined || raw === null || raw === "") { out[key] = def.type === "bool" ? false : null; continue; }
    if (def.type === "bool") { out[key] = raw === true || raw === "true"; continue; }
    if (def.type === "number" || def.type === "int") {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", ".").replace(/\s/g, ""));
      out[key] = Number.isFinite(n) && n >= 0 && n < 1e7 ? (def.type === "int" ? Math.round(n) : Math.round(n * 100) / 100) : null;
      continue;
    }
    let s = String(raw).replace(CONTROL, "").trim().slice(0, def.max ?? 500);
    if (def.type !== "longtext") s = s.replace(/[\r\n]+/g, " ");
    if (def.type === "url" && !/^https?:\/\/[^\s<>"]+$/i.test(s)) { out[key] = null; continue; }
    if (def.type === "email" && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s)) { out[key] = null; continue; }
    out[key] = s || null;
  }
  return out;
}

const REQUIRED: [string, string][] = [
  ["legal_name", "Raison sociale"],
  ["postal_address", "Adresse postale"],
  ["legal_rep_first_name", "Prénom du représentant légal"],
  ["legal_rep_last_name", "Nom du représentant légal"],
  ["phone", "Téléphone"],
  ["game_name", "Nom du jeu"],
  ["author_email", "Email de l'auteur"],
  ["pitch", "Pitch"],
  ["price_ht", "Prix de vente HT"],
  ["long_description", "Description longue"],
  ["credits", "Mentions des auteurs et crédits"],
  ["weight_g", "Poids"],
  ["package_dimensions", "Dimensions du colis"],
  ["shipping_fee", "Frais de port"],
  ["shipping_delay", "Délai d'expédition"],
];
const REQUIRED_LOCATION: [string, string][] = [
  ["location_duration_days", "Durée de location"],
  ["location_price_ht", "Tarif de location HT"],
  ["location_late_fee_month", "Pénalité de retard par mois"],
  ["location_replacement_price", "Prix de remplacement"],
];

/** Liste des libellés manquants pour la soumission (vide = soumissible). */
export function missingForSubmit(form: FormData, files: { kind: string }[]): string[] {
  const missing = REQUIRED.filter(([k]) => form[k] === null || form[k] === undefined).map(([, l]) => l);
  if (form.location_enabled) {
    missing.push(...REQUIRED_LOCATION.filter(([k]) => form[k] === null || form[k] === undefined).map(([, l]) => l));
  }
  if (!files.some((f) => f.kind === "logo")) missing.push("Logo");
  if (!files.some((f) => f.kind === "photo")) missing.push("Au moins une photo");
  if (!form.game_page_url && !files.some((f) => f.kind === "pdf")) missing.push("URL de la page du jeu ou PDF");
  return missing;
}

export function fileKindAllowed(kind: string, mime: string, size: number, existing: { kind: string }[]): string | null {
  const allowed = FILE_MIME[kind];
  if (!allowed) return "Type de fichier inconnu";
  if (!allowed.includes(mime)) return kind === "pdf" ? "Seuls les PDF sont acceptés" : "Formats acceptés : PNG, JPG, WebP";
  if (size <= 0 || size > MAX_FILE_BYTES) return "Fichier trop volumineux (10 Mo maximum)";
  const n = existing.filter((f) => f.kind === kind).length;
  if (kind === "photo" && n >= MAX_PHOTOS) return `${MAX_PHOTOS} photos maximum`;
  if (kind === "pdf" && n >= MAX_PDFS) return `${MAX_PDFS} PDF maximum`;
  return null;
}

export function formatCommission(rate: number): string {
  const pct = Math.round(rate * 10000) / 100;
  return `${String(pct).replace(".", ",")} %`;
}

const eur = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function frDateParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** Variables Liquid du modèle PDFMonkey du contrat de distribution. */
export function buildContractPayload(opts: {
  reference: string;
  form: FormData;
  commissionRate: number;
  date: Date;
  distributorSignature: string;
  supplierSignature?: string;
  supplierSignedAt?: Date;
}) {
  const f = opts.form;
  const loc = !!f.location_enabled;
  return {
    CONTRAT_REFERENCE: opts.reference,
    SOCIETE: f.legal_name ?? "",
    SIREN: f.siren ?? "",
    ADRESSE: f.postal_address ?? "",
    NOM_REPRESENTANT: [f.legal_rep_first_name, f.legal_rep_last_name].filter(Boolean).join(" "),
    NOM_JEU: f.game_name ?? "",
    COMMISSION: formatCommission(opts.commissionRate),
    LOCATION_ACTIVE: loc,
    LOCATION_DUREE: loc && f.location_duration_days ? `${f.location_duration_days} jours` : "",
    LOCATION_TARIF_HT: loc ? eur(f.location_price_ht as number) : "",
    LOCATION_TARIF_RETARD: loc ? eur(f.location_late_fee_month as number) : "",
    LOCATION_PRIX_REMPLACEMENT: loc ? eur(f.location_replacement_price as number) : "",
    DATE: frDateParis(opts.date),
    SIGNATURE_FOURNISSEUR: opts.supplierSignature ?? "",
    DATE_SIGNATURE_FOURNISSEUR: opts.supplierSignedAt ? frDateParis(opts.supplierSignedAt) : "",
    SIGNATURE_DISTRIBUTEUR: opts.distributorSignature,
  };
}

/** Code OTP : délai minimal entre deux envois et plafond par contrat. */
export function otpSendRefusal(sentCount: number, lastSentAt: string | null, now: number): string | null {
  if (sentCount >= OTP_MAX_SENDS) return "Nombre maximal de codes atteint. Contactez SuperTilt.";
  if (lastSentAt && now - new Date(lastSentAt).getTime() < OTP_MIN_INTERVAL_MS) return "Patientez une minute avant de demander un nouveau code.";
  return null;
}

export function otpCheckRefusal(rec: { otp_hash: string | null; otp_expires_at: string | null; otp_attempts: number }, now: number): string | null {
  if (!rec.otp_hash || !rec.otp_expires_at) return "Demandez d'abord un code de vérification.";
  if (rec.otp_attempts >= OTP_MAX_ATTEMPTS) return "Trop d'essais. Demandez un nouveau code.";
  if (new Date(rec.otp_expires_at).getTime() < now) return "Code expiré. Demandez un nouveau code.";
  return null;
}

/** Relances J+3 puis J+7 après l'envoi du contrat. */
export const REMINDER_STEPS = [3, 7];
export function reminderDue(reminderCount: number, emailSentAt: string | null, now: number): boolean {
  const step = REMINDER_STEPS[reminderCount];
  if (step === undefined || !emailSentAt) return false;
  return now - new Date(emailSentAt).getTime() >= step * 86_400_000;
}
