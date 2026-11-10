// Règles pures des attestations de bonne exécution, partagées par les écrans et les fonctions serveur.
export interface AttestationContent {
  status?: string | null;
  expires_at?: string | null;
  provider_name?: string | null;
  provider_siren?: string | null;
  provider_nda?: string | null;
  provider_address?: string | null;
  client_name?: string | null;
  client_address?: string | null;
  signer_name?: string | null;
  signer_function?: string | null;
  is_public_entity?: boolean | null;
  public_entity_name?: string | null;
  public_contract_reference?: string | null;
  subject?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  participants_count?: number | null;
  days_count?: number | null;
  amount_ht?: number | null;
  free_text?: string | null;
  certification_text?: string | null;
}

export const PUBLIC_ENTITY_MENTION = "Intervention auprès d'une collectivité territoriale";

const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

/** Champs manquants avant de générer un lien de signature (mêmes règles que la base). */
export function missingForLink(a: AttestationContent): string[] {
  const missing: string[] = [];
  if (blank(a.subject)) missing.push("Objet de la prestation");
  if (blank(a.client_name)) missing.push("Client");
  if (a.is_public_entity) {
    if (blank(a.public_entity_name)) missing.push("Nom de la collectivité");
    if (blank(a.signer_name)) missing.push("Nom du signataire");
  }
  return missing;
}

export function effectiveStatus(a: Pick<AttestationContent, "status" | "expires_at">, now = new Date()): string {
  if (a.status === "sent" && a.expires_at && new Date(a.expires_at) < now) return "expired";
  return a.status ?? "draft";
}

function frDate(d?: string | null) {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function money(n?: number | null) {
  if (n === null || n === undefined) return "";
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n)).replace(/\u202f|\u00a0/g, " ")} € HT`;
}

export interface AttestationSection { title: string; lines: string[] }

/** Contenu textuel figé de l'attestation : rendu PDF, page publique et empreinte. */
export function attestationSections(a: AttestationContent, signer?: { name?: string | null; fn?: string | null }): AttestationSection[] {
  const signerName = signer?.name ?? a.signer_name;
  const signerFn = signer?.fn ?? a.signer_function;
  const period = a.start_date && a.end_date && a.start_date !== a.end_date
    ? `Du ${frDate(a.start_date)} au ${frDate(a.end_date)}`
    : a.start_date ? `Le ${frDate(a.start_date)}` : "";
  const sections: AttestationSection[] = [
    { title: "Prestataire", lines: [a.provider_name ?? "", a.provider_address ?? "", a.provider_siren ? `SIREN : ${a.provider_siren}` : "", a.provider_nda ? `N° de déclaration d'activité : ${a.provider_nda}` : ""].filter((l) => l.trim()) },
    { title: "Client", lines: [a.client_name ?? "", a.client_address ?? ""].filter((l) => l.trim()) },
  ];
  if (a.is_public_entity) {
    sections.push({ title: PUBLIC_ENTITY_MENTION, lines: [
      `Collectivité : ${a.public_entity_name ?? ""}`,
      `Signataire : ${signerName ?? ""}`,
      `Fonction : ${signerFn ?? ""}`,
      a.public_contract_reference ? `Référence du marché : ${a.public_contract_reference}` : "",
    ].filter(Boolean) });
  }
  sections.push({ title: "Prestation", lines: [
    a.subject ? `Objet : ${a.subject}` : "",
    period ? `Période : ${period}` : "",
    a.location ? `Lieu : ${a.location}` : "",
    a.days_count ? `Nombre de jours : ${String(a.days_count).replace(".", ",")}` : "",
    a.participants_count ? `Nombre de participants : ${a.participants_count}` : "",
    a.amount_ht !== null && a.amount_ht !== undefined ? `Montant : ${money(a.amount_ht)}` : "",
  ].filter(Boolean) });
  if (!blank(a.free_text)) sections.push({ title: "Description", lines: String(a.free_text).split(/\r?\n/) });
  sections.push({ title: "Attestation", lines: [a.certification_text ?? ""] });
  return sections;
}

/** Texte canonique servant à l'empreinte du contenu signé. */
export function canonicalContent(a: AttestationContent, signer: { name: string; fn?: string | null }): string {
  return attestationSections(a, signer).map((s) => `## ${s.title}\n${s.lines.join("\n")}`).join("\n\n");
}
