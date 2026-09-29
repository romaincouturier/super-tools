/**
 * Outil MCP add_training_participant : ajout d'un participant avec les mêmes
 * champs, contrôles et effets que le dialogue « Ajouter un participant ».
 * Le contexte (dates, format, inter/intra, gratuité, formule) est lu en base,
 * jamais fourni par l'appelant, puis l'ajout passe par l'edge function
 * add-training-participant (source de vérité : convocation, recueil des
 * besoins, convention, accès e-learning, rattrapage d'émargement, log).
 * Sans confirm=true, l'outil renvoie seulement l'aperçu, sans rien écrire.
 */

// deno-lint-ignore no-explicit-any
type Db = any;
type Log = (message: string) => Promise<void>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const TYPE_STAGIAIRE_BPF = ["salarie_prive", "apprenti", "demandeur_emploi", "particulier", "autre"] as const;
export const SOURCE_FINANCEMENT_BPF = [
  "entreprise", "opco_plan_competences", "opco_cpf", "opco_apprentissage", "opco_professionnalisation",
  "opco_alternance", "opco_transition_pro", "opco_demandeur_emploi", "opco_tns", "pouvoirs_publics_agents",
  "etat", "conseils_regionaux", "france_travail", "autres_publics", "particulier", "sous_traitance", "autre",
] as const;

export interface AddParticipantInput {
  training_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  company_address?: string;
  company_zip?: string;
  company_city?: string;
  formula_id?: string;
  formula_name?: string;
  payment_mode?: "online" | "invoice";
  sold_price_ht?: number;
  type_stagiaire_bpf?: string;
  source_financement_bpf?: string;
  sponsor_same_as_participant?: boolean;
  sponsor_first_name?: string;
  sponsor_last_name?: string;
  sponsor_email?: string;
  sponsor_phone?: string;
  financeur_same_as_sponsor?: boolean;
  financeur_name?: string;
  financeur_url?: string;
  confirm?: boolean;
}

type Invoke = (body: Record<string, unknown>) => Promise<Record<string, unknown>>;

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function todayPlusOneYearParis(): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const [y, m, d] = today.split("-");
  return `${Number(y) + 1}-${m}-${d}`;
}

function daysUntil(dateStr: string): number {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  return Math.round((Date.parse(`${dateStr}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** Construit le corps envoyé à add-training-participant, identique au dialogue manuel. */
export async function buildParticipantRequest(db: Db, input: AddParticipantInput) {
  if (!UUID_RE.test(input.training_id || "")) throw new Error("training_id doit être un UUID");
  const email = s(input.email).toLowerCase();
  if (!email) throw new Error("email est obligatoire");
  if (!EMAIL_RE.test(email)) throw new Error(`email invalide : ${email}`);

  const { data: t, error } = await db.from("trainings")
    .select("id, training_name, start_date, end_date, format_formation, session_type, is_free, catalog_id, client_name, is_cancelled")
    .eq("id", input.training_id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!t) throw new Error("Formation introuvable");
  if (t.is_cancelled) throw new Error("Formation annulée : ajout refusé");

  const isInter = t.session_type === "inter" || t.format_formation === "inter-entreprises" || t.format_formation === "e_learning";
  const isFree = t.is_free === true;

  const { data: dup, error: dupErr } = await db.from("training_participants")
    .select("id").eq("training_id", t.id).ilike("email", email).limit(1);
  if (dupErr) throw new Error(dupErr.message);
  if (dup?.length) throw new Error("Un participant avec cet email est déjà inscrit à cette formation.");

  // Formules : celles du catalogue de la formation, comme dans le dialogue
  let formulas: Array<{ id: string; name: string; coaching_sessions_count: number | null }> = [];
  if (t.catalog_id) {
    const { data: f, error: fErr } = await db.from("formation_formulas")
      .select("id, name, coaching_sessions_count").eq("formation_config_id", t.catalog_id).order("display_order");
    if (fErr) throw new Error(fErr.message);
    formulas = f ?? [];
  }
  let formula = null as (typeof formulas)[number] | null;
  const fid = s(input.formula_id), fname = s(input.formula_name).toLowerCase();
  if (fid || fname) {
    formula = formulas.find((f) => (fid && f.id === fid) || (fname && f.name.toLowerCase() === fname)) ?? null;
    if (!formula) {
      throw new Error(`Formule inconnue pour cette formation. Formules disponibles : ${formulas.map((f) => `${f.name} (${f.id})`).join(", ") || "aucune"}`);
    }
  } else {
    formula = (formulas.length === 1 ? formulas[0] : null);
  }

  const paymentMode = input.payment_mode ?? "invoice";
  if (paymentMode !== "online" && paymentMode !== "invoice") throw new Error("payment_mode doit être online ou invoice");

  const typeBpf = s(input.type_stagiaire_bpf);
  if (typeBpf && !(TYPE_STAGIAIRE_BPF as readonly string[]).includes(typeBpf)) {
    throw new Error(`type_stagiaire_bpf invalide. Valeurs : ${TYPE_STAGIAIRE_BPF.join(", ")}`);
  }
  const sourceBpf = s(input.source_financement_bpf);
  if (sourceBpf && !(SOURCE_FINANCEMENT_BPF as readonly string[]).includes(sourceBpf)) {
    throw new Error(`source_financement_bpf invalide. Valeurs : ${SOURCE_FINANCEMENT_BPF.join(", ")}`);
  }
  if (input.sold_price_ht !== undefined && (typeof input.sold_price_ht !== "number" || !isFinite(input.sold_price_ht) || input.sold_price_ht < 0)) {
    throw new Error("sold_price_ht doit être un nombre positif");
  }

  const firstName = s(input.first_name), lastName = s(input.last_name);
  const sameAsParticipant = input.sponsor_same_as_participant === true;
  const sponsorEmail = sameAsParticipant ? email : s(input.sponsor_email).toLowerCase();
  if (sponsorEmail && !EMAIL_RE.test(sponsorEmail)) throw new Error(`sponsor_email invalide : ${sponsorEmail}`);
  const financeurUrl = s(input.financeur_url);
  if (financeurUrl && !/^https?:\/\//i.test(financeurUrl)) throw new Error("financeur_url doit commencer par http(s)://");

  const coachingSessionsTotal = formula?.coaching_sessions_count || 0;
  // Intra : entreprise pré-remplie avec le client de la formation, comme le dialogue
  const company = s(input.company) || (!isInter ? s(t.client_name) : "");

  const body = {
    trainingId: t.id,
    trainingStartDate: t.start_date ?? null,
    trainingEndDate: t.end_date ?? null,
    formatFormation: t.format_formation ?? null,
    isInterEntreprise: isInter,
    email,
    firstName,
    lastName,
    company,
    companyAddress: s(input.company_address) || null,
    companyZip: s(input.company_zip) || null,
    companyCity: s(input.company_city) || null,
    typeStagiaireBpf: isFree ? null : (typeBpf || null),
    sourceFinancementBpf: isFree ? null : (sourceBpf || null),
    soldPriceHt: isFree ? null : (input.sold_price_ht ?? null),
    paymentMode,
    formulaId: formula?.id ?? null,
    formulaName: formula?.name ?? null,
    coachingSessionsTotal,
    coachingDeadline: coachingSessionsTotal > 0 ? todayPlusOneYearParis() : null,
    sponsorFirstName: sameAsParticipant ? firstName : s(input.sponsor_first_name),
    sponsorLastName: sameAsParticipant ? lastName : s(input.sponsor_last_name),
    sponsorEmail,
    sponsorPhone: s(input.sponsor_phone),
    financeurSameAsSponsor: input.financeur_same_as_sponsor ?? true,
    financeurName: s(input.financeur_name),
    financeurUrl,
    source: "manual",
  };

  // Effets attendus, pour l'aperçu
  const effects: string[] = [];
  const d = t.start_date ? daysUntil(t.start_date) : null;
  if (t.format_formation === "e_learning" && paymentMode !== "online") effects.push("email d'activation e-learning envoyé");
  else if (d === null) effects.push("convocation programmée (pas de date de début)");
  else if (d <= 0) effects.push("formation commencée ou passée : pas de convocation automatique, sauf formation en cours (mail d'accueil + rattrapage d'émargement)");
  else if (d < 2) effects.push("démarrage < 2 jours : convocation à envoyer manuellement");
  else effects.push("convocation envoyée immédiatement, recueil des besoins et récapitulatif formateur programmés");
  if (isInter && !isFree && paymentMode === "invoice") effects.push("convention générée et envoyée au commanditaire s'il a un email");

  const warnings: string[] = [];
  if (isInter && !isFree && !sponsorEmail && t.format_formation !== "e_learning" && paymentMode === "invoice") {
    warnings.push("aucun email de commanditaire : la convention ne pourra pas être envoyée");
  }
  if (formulas.length > 1 && !formula) warnings.push(`aucune formule choisie parmi : ${formulas.map((f) => f.name).join(", ")}`);

  return { training: t, body, effects, warnings, isInter, isFree };
}

export async function addTrainingParticipant(db: Db, input: AddParticipantInput, log: Log, invoke: Invoke): Promise<string> {
  const { training, body, effects, warnings } = await buildParticipantRequest(db, input);
  const label = `${training.training_name} (${training.start_date ?? "sans date"})`;

  if (input.confirm !== true) {
    return JSON.stringify({
      preview: true,
      message: "Aperçu seulement, rien n'a été écrit. Relance avec confirm=true après validation explicite de l'utilisateur.",
      training: label,
      participant: body,
      effects,
      warnings,
    });
  }

  const result = await invoke(body);
  if ((result as { error?: string }).error) throw new Error(String((result as { error?: string }).error));
  await log(`add_training_participant: ${body.email} -> ${label}`);
  return JSON.stringify({ added: true, training: label, email: body.email, warnings, result });
}
