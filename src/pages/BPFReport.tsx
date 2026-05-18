import { useState, useEffect, useCallback } from "react";
import { FileText, Printer, Save, AlertTriangle, RefreshCw } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceFinancement =
  | "entreprise"
  | "opco_plan_competences"
  | "opco_cpf"
  | "opco_apprentissage"
  | "opco_professionnalisation"
  | "opco_alternance"
  | "opco_transition_pro"
  | "opco_demandeur_emploi"
  | "opco_tns"
  | "pouvoirs_publics_agents"
  | "instances_europeennes"
  | "etat"
  | "conseils_regionaux"
  | "france_travail"
  | "autres_publics"
  | "particulier"
  | "sous_traitance"
  | "autre";

type TypeStagiaire =
  | "salarie_prive"
  | "apprenti"
  | "demandeur_emploi"
  | "particulier"
  | "autre";

interface TrainingRow {
  id: string;
  source_financement_bpf: SourceFinancement | null;
  sold_price_ht: number | null;
  start_date: string | null;
  trainer_name: string;
  catalog_id: string | null;
  commanditaire_of_name: string | null;
}

interface ParticipantRow {
  id: string;
  training_id: string;
  type_stagiaire_bpf: TypeStagiaire | null;
  sold_price_ht: number | null;
  source_financement_bpf: SourceFinancement | null;
}

interface ScheduleRow {
  training_id: string;
  start_time: string;
  end_time: string;
}

interface ParticipantWithTraining {
  id: string;
  training_id: string;
  type_stagiaire_bpf: TypeStagiaire | null;
  training: {
    start_date: string | null;
    source_financement_bpf: SourceFinancement | null;
  };
}

interface FormationConfigRow {
  id: string;
  code_specialite_nsf: string | null;
  label_specialite_nsf: string | null;
}

interface BpfProduits {
  ligne1: number;   // entreprise
  ligne2a: number;  // opco_apprentissage
  ligne2b: number;  // opco_professionnalisation
  ligne2c: number;  // opco_alternance
  ligne2d: number;  // opco_transition_pro
  ligne2e: number;  // opco_cpf
  ligne2f: number;  // opco_demandeur_emploi
  ligne2g: number;  // opco_tns
  ligne2h: number;  // opco_plan_competences
  ligne3: number;   // pouvoirs_publics_agents
  ligne4: number;   // instances_europeennes
  ligne5: number;   // etat
  ligne6: number;   // conseils_regionaux
  ligne7: number;   // france_travail
  ligne8: number;   // autres_publics
  ligne9: number;   // particulier
  ligne10: number;  // sous_traitance
  ligne11: number;  // autre
  unclassified: number;
}

interface TrainerStats {
  trainer_name: string;
  nb_sessions: number;
  total_hours: number;
}

interface StagiaireStats {
  type: TypeStagiaire | null;
  label: string;
  nb_stagiaires: number;
  nb_heures: number;
}

interface NsfStats {
  code: string;
  label: string;
  nb_stagiaires: number;
  total_heures: number;
}

interface SectionGStats {
  commanditaire: string;
  nb_stagiaires: number;
  nb_heures: number;
}

interface BpfReportData {
  id?: string;
  annee: number;
  produits_ligne1?: number | null;
  produits_opco_a?: number | null;
  produits_opco_b?: number | null;
  produits_opco_c?: number | null;
  produits_opco_d?: number | null;
  produits_opco_e?: number | null;
  produits_opco_f?: number | null;
  produits_opco_g?: number | null;
  produits_opco_h?: number | null;
  produits_ligne3?: number | null;
  produits_ligne4?: number | null;
  produits_ligne5?: number | null;
  produits_ligne6?: number | null;
  produits_ligne7?: number | null;
  produits_ligne8?: number | null;
  produits_ligne9?: number | null;
  produits_ligne10?: number | null;
  produits_ligne11?: number | null;
  charges_total?: number | null;
  charges_salaires_formateurs?: number | null;
  charges_achats_prestations?: number | null;
  chiffre_affaires_global?: number | null;
  use_auto_calculation?: boolean | null;
  bilan_comptable_pdf_url?: string | null;
  notes?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapSourceToBpfLine(source: SourceFinancement | null): keyof Omit<BpfProduits, "unclassified"> | "unclassified" {
  switch (source) {
    case "entreprise": return "ligne1";
    case "opco_apprentissage": return "ligne2a";
    case "opco_professionnalisation": return "ligne2b";
    case "opco_alternance": return "ligne2c";
    case "opco_transition_pro": return "ligne2d";
    case "opco_cpf": return "ligne2e";
    case "opco_demandeur_emploi": return "ligne2f";
    case "opco_tns": return "ligne2g";
    case "opco_plan_competences": return "ligne2h";
    case "pouvoirs_publics_agents": return "ligne3";
    case "instances_europeennes": return "ligne4";
    case "etat": return "ligne5";
    case "conseils_regionaux": return "ligne6";
    case "france_travail": return "ligne7";
    case "autres_publics": return "ligne8";
    case "particulier": return "ligne9";
    case "sous_traitance": return "ligne10";
    case "autre": return "ligne11";
    default: return "unclassified";
  }
}

function calcScheduleHours(schedules: ScheduleRow[]): number {
  return schedules.reduce((total, s) => {
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    const durationHours = (eh * 60 + em - (sh * 60 + sm)) / 60;
    return total + (durationHours <= 4 ? 3.5 : 7);
  }, 0);
}

function EUR(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function emptyProduits(): BpfProduits {
  return {
    ligne1: 0, ligne2a: 0, ligne2b: 0, ligne2c: 0, ligne2d: 0,
    ligne2e: 0, ligne2f: 0, ligne2g: 0, ligne2h: 0,
    ligne3: 0, ligne4: 0, ligne5: 0, ligne6: 0, ligne7: 0,
    ligne8: 0, ligne9: 0, ligne10: 0, ligne11: 0, unclassified: 0,
  };
}

const BPF_LINES: { key: keyof BpfProduits; label: string; bpfRef: string }[] = [
  { key: "ligne1",  label: "Entreprises",                                              bpfRef: "1" },
  { key: "ligne2a", label: "OPCO – Contrats d'apprentissage",                          bpfRef: "2a" },
  { key: "ligne2b", label: "OPCO – Contrats de professionnalisation",                 bpfRef: "2b" },
  { key: "ligne2c", label: "OPCO – Alternance",                                        bpfRef: "2c" },
  { key: "ligne2d", label: "OPCO – Pro-A / Transition pro",                            bpfRef: "2d" },
  { key: "ligne2e", label: "OPCO – CPF",                                               bpfRef: "2e" },
  { key: "ligne2f", label: "OPCO – Demandeurs d'emploi",                              bpfRef: "2f" },
  { key: "ligne2g", label: "OPCO – TNS",                                               bpfRef: "2g" },
  { key: "ligne2h", label: "OPCO – Plan de compétences",                              bpfRef: "2h" },
  { key: "ligne3",  label: "Pouvoirs publics – agents",                                bpfRef: "3" },
  { key: "ligne4",  label: "Instances européennes",                                    bpfRef: "4" },
  { key: "ligne5",  label: "État",                                                     bpfRef: "5" },
  { key: "ligne6",  label: "Conseils régionaux",                                       bpfRef: "6" },
  { key: "ligne7",  label: "France Travail (Pôle Emploi)",                            bpfRef: "7" },
  { key: "ligne8",  label: "Autres fonds publics",                                    bpfRef: "8" },
  { key: "ligne9",  label: "Particuliers à leurs frais",                              bpfRef: "9" },
  { key: "ligne10", label: "Sous-traitance",                                           bpfRef: "10" },
  { key: "ligne11", label: "Autre",                                                    bpfRef: "11" },
];

const STAGIAIRE_LABELS: Record<TypeStagiaire, string> = {
  salarie_prive: "Salariés employeurs privés",
  apprenti: "Apprentis",
  demandeur_emploi: "Demandeurs d'emploi",
  particulier: "Particuliers à leurs frais",
  autre: "Autres",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BPFReport() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState(currentYear - 1);
  const [activeTab, setActiveTab] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-computed data
  const [produits, setProduits] = useState<BpfProduits>(emptyProduits());
  const [trainers, setTrainers] = useState<TrainerStats[]>([]);
  const [stagiaires, setStagiaires] = useState<StagiaireStats[]>([]);
  const [nsfStats, setNsfStats] = useState<NsfStats[]>([]);
  const [sectionG, setSectionG] = useState<SectionGStats[]>([]);
  const [unclassifiedParticipants, setUnclassifiedParticipants] = useState(0);
  const [trainingsWithoutCatalog, setTrainingsWithoutCatalog] = useState(0);
  const [balanceSheetCa, setBalanceSheetCa] = useState<number | null>(null);

  // Manual form
  const [useAutoCalc, setUseAutoCalc] = useState(true);
  const [manualProduits, setManualProduits] = useState<Record<string, string>>({});
  const [chargesTotal, setChargesTotal] = useState("");
  const [chargesSalaires, setChargesSalaires] = useState("");
  const [chargesAchats, setChargesAchats] = useState("");
  const [caGlobal, setCaGlobal] = useState("");
  const [notes, setNotes] = useState("");
  const [existingReportId, setExistingReportId] = useState<string | null>(null);

  // ── Fetch auto-computed data ────────────────────────────────────────────────

  const fetchAutoData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch trainings for the year
      const { data: trainingsData, error: tErr } = await supabase
        .from("trainings")
        .select("id, sold_price_ht, catalog_id, trainer_name, start_date")
        .eq("is_cancelled", false)
        .not("start_date", "is", null)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .gte("start_date", `${annee}-01-01`)
        .lte("start_date", `${annee}-12-31`);

      if (tErr) throw tErr;

      // Fetch CA global from balance_sheets for the selected year
      const { data: bsData } = await supabase
        .from("balance_sheets")
        .select("data")
        .eq("annee", annee)
        .maybeSingle();
      if (bsData?.data) {
        const caFromBs = (bsData.data as { compte_resultat?: { chiffre_affaires?: number } })
          .compte_resultat?.chiffre_affaires ?? null;
        setBalanceSheetCa(caFromBs && caFromBs > 0 ? caFromBs : null);
      } else {
        setBalanceSheetCa(null);
      }

      // Fetch trainings with all BPF fields
      const { data: trainingsExtData, error: tExtErr } = await (supabase
        .from("trainings")
        .select("id, sold_price_ht, catalog_id, trainer_name, start_date, source_financement_bpf, is_cancelled, commanditaire_of_name")
        .not("start_date", "is", null)
        .gte("start_date", `${annee}-01-01`)
        .lte("start_date", `${annee}-12-31`) as unknown as Promise<{ data: TrainingRow[] | null; error: unknown }>);

      if (tExtErr) throw tExtErr;

      const trainings: TrainingRow[] = (trainingsExtData ?? []).filter(
        (t) => t.is_cancelled !== true
      ) as TrainingRow[];

      // 2. Fetch participants with type_stagiaire_bpf
      const trainingIds = trainings.map((t) => t.id);

      let participants: ParticipantRow[] = [];
      let participantsWithTraining: ParticipantWithTraining[] = [];

      if (trainingIds.length > 0) {
        const { data: pData, error: pErr } = await (supabase
          .from("training_participants")
          .select("id, training_id, type_stagiaire_bpf, sold_price_ht")
          .in("training_id", trainingIds) as unknown as Promise<{ data: ParticipantRow[] | null; error: unknown }>);

        if (pErr) throw pErr;
        participants = pData ?? [];

        // Also fetch participants with their training's source_financement_bpf
        const { data: pwtData, error: pwtErr } = await (supabase
          .from("training_participants")
          .select("id, training_id, type_stagiaire_bpf, training:training_id(start_date, source_financement_bpf)")
          .in("training_id", trainingIds) as unknown as Promise<{ data: ParticipantWithTraining[] | null; error: unknown }>);

        if (pwtErr) throw pwtErr;
        participantsWithTraining = pwtData ?? [];
      }

      // 3. Fetch training_schedules for the year
      let schedules: ScheduleRow[] = [];
      if (trainingIds.length > 0) {
        const { data: sData, error: sErr } = await supabase
          .from("training_schedules")
          .select("training_id, start_time, end_time")
          .in("training_id", trainingIds);

        if (sErr) throw sErr;
        schedules = sData ?? [];
      }

      // Map schedules by training_id
      const schedulesByTraining: Record<string, ScheduleRow[]> = {};
      for (const s of schedules) {
        if (!schedulesByTraining[s.training_id]) schedulesByTraining[s.training_id] = [];
        schedulesByTraining[s.training_id].push(s);
      }

      // ── Compute Produits (Section C) ────────────────────────────────────────
      const newProduits = emptyProduits();

      // Intra trainings: revenue at training level
      for (const t of trainings) {
        if (t.sold_price_ht != null) {
          const line = mapSourceToBpfLine(t.source_financement_bpf);
          newProduits[line] += t.sold_price_ht;
        }
      }

      // Per-participant pricing (inter sessions)
      for (const p of participants) {
        if (p.sold_price_ht != null) {
          const training = trainings.find((t) => t.id === p.training_id);
          const line = mapSourceToBpfLine(training?.source_financement_bpf ?? null);
          newProduits[line] += p.sold_price_ht;
        }
      }

      setProduits(newProduits);

      // ── Compute Trainers (Section E) ────────────────────────────────────────
      const trainerMap: Record<string, { nb_sessions: number; total_hours: number }> = {};
      for (const t of trainings) {
        if (!t.trainer_name) continue;
        if (!trainerMap[t.trainer_name]) {
          trainerMap[t.trainer_name] = { nb_sessions: 0, total_hours: 0 };
        }
        trainerMap[t.trainer_name].nb_sessions += 1;
        const hours = calcScheduleHours(schedulesByTraining[t.id] ?? []);
        trainerMap[t.trainer_name].total_hours += hours;
      }
      setTrainers(
        Object.entries(trainerMap).map(([name, stats]) => ({
          trainer_name: name,
          ...stats,
        }))
      );

      // ── Compute Stagiaires (Section F1) ─────────────────────────────────────
      const stagiaireMap: Record<string, { nb: number; hours: number }> = {
        salarie_prive: { nb: 0, hours: 0 },
        apprenti: { nb: 0, hours: 0 },
        demandeur_emploi: { nb: 0, hours: 0 },
        particulier: { nb: 0, hours: 0 },
        autre: { nb: 0, hours: 0 },
      };
      let unclassified = 0;

      for (const p of participantsWithTraining) {
        const trainingSchedules = schedulesByTraining[p.training_id] ?? [];
        const hours = calcScheduleHours(trainingSchedules);
        const type = p.type_stagiaire_bpf;
        if (type && stagiaireMap[type]) {
          stagiaireMap[type].nb += 1;
          stagiaireMap[type].hours += hours;
        } else {
          unclassified += 1;
        }
      }

      setUnclassifiedParticipants(unclassified);
      setStagiaires(
        (Object.keys(stagiaireMap) as TypeStagiaire[]).map((type) => ({
          type,
          label: STAGIAIRE_LABELS[type],
          nb_stagiaires: stagiaireMap[type].nb,
          nb_heures: stagiaireMap[type].hours,
        }))
      );

      // ── Compute NSF Specialities (Section F4) ───────────────────────────────
      if (trainingIds.length > 0) {
        const { data: fcData, error: fcErr } = await (supabase
          .from("formation_configs")
          .select("id, code_specialite_nsf, label_specialite_nsf") as unknown as Promise<{ data: FormationConfigRow[] | null; error: unknown }>);

        if (fcErr) throw fcErr;

        const fcMap: Record<string, FormationConfigRow> = {};
        for (const fc of fcData ?? []) {
          fcMap[fc.id] = fc;
        }

        const nsfMap: Record<string, { label: string; nb_stagiaires: number; total_heures: number }> = {};
        let withoutCatalog = 0;

        for (const t of trainings) {
          const trainingParticipants = participants.filter((p) => p.training_id === t.id);
          const hours = calcScheduleHours(schedulesByTraining[t.id] ?? []);

          if (!t.catalog_id || !fcMap[t.catalog_id]) {
            withoutCatalog += 1;
            continue;
          }

          const fc = fcMap[t.catalog_id];
          if (!fc.code_specialite_nsf) continue;

          const key = fc.code_specialite_nsf;
          if (!nsfMap[key]) {
            nsfMap[key] = {
              label: fc.label_specialite_nsf ?? fc.code_specialite_nsf,
              nb_stagiaires: 0,
              total_heures: 0,
            };
          }
          nsfMap[key].nb_stagiaires += trainingParticipants.length;
          nsfMap[key].total_heures += hours * trainingParticipants.length;
        }

        setTrainingsWithoutCatalog(withoutCatalog);
        setNsfStats(
          Object.entries(nsfMap)
            .map(([code, stats]) => ({ code, ...stats }))
            .sort((a, b) => b.nb_stagiaires - a.nb_stagiaires)
        );
      }

      // ── Section G : sous-traitance reçue ────────────────────────────────────
      const soustraitanceTrainings = trainings.filter(
        (t) => t.source_financement_bpf === "sous_traitance"
      );
      const gMap: Record<string, { nb_stagiaires: number; nb_heures: number }> = {};
      for (const t of soustraitanceTrainings) {
        const key = t.commanditaire_of_name ?? "Organisme non renseigné";
        if (!gMap[key]) gMap[key] = { nb_stagiaires: 0, nb_heures: 0 };
        const trainingParticipants = participants.filter((p) => p.training_id === t.id);
        const hours = calcScheduleHours(schedulesByTraining[t.id] ?? []);
        gMap[key].nb_stagiaires += trainingParticipants.length;
        gMap[key].nb_heures += hours * trainingParticipants.length;
      }
      setSectionG(
        Object.entries(gMap).map(([commanditaire, stats]) => ({ commanditaire, ...stats }))
      );
    } catch (err) {
      console.error("BPF fetch error:", err);
      toastError(toast, "Impossible de charger les données BPF.", { title: "Erreur de chargement" });
    } finally {
      setLoading(false);
    }
  }, [annee, toast]);

  // ── Fetch existing manual report ────────────────────────────────────────────

  const fetchManualReport = useCallback(async () => {
    const { data, error } = await (supabase
      .from("bpf_reports")
      .select("*")
      .eq("annee", annee)
      .maybeSingle() as unknown as Promise<{ data: BpfReportData | null; error: unknown }>);

    if (error) {
      console.error("BPF report fetch error:", error);
      return;
    }

    if (data) {
      setExistingReportId(data.id ?? null);
      setUseAutoCalc(data.use_auto_calculation ?? true);
      setChargesTotal(data.charges_total?.toString() ?? "");
      setChargesSalaires(data.charges_salaires_formateurs?.toString() ?? "");
      setChargesAchats(data.charges_achats_prestations?.toString() ?? "");
      // Prefer saved value; balance_sheets fallback is applied after fetch in the effect
      setCaGlobal(data.chiffre_affaires_global?.toString() ?? "");
      setNotes(data.notes ?? "");

      const mp: Record<string, string> = {};
      if (data.produits_ligne1 != null) mp["ligne1"] = data.produits_ligne1.toString();
      if (data.produits_opco_a != null) mp["ligne2a"] = data.produits_opco_a.toString();
      if (data.produits_opco_b != null) mp["ligne2b"] = data.produits_opco_b.toString();
      if (data.produits_opco_c != null) mp["ligne2c"] = data.produits_opco_c.toString();
      if (data.produits_opco_d != null) mp["ligne2d"] = data.produits_opco_d.toString();
      if (data.produits_opco_e != null) mp["ligne2e"] = data.produits_opco_e.toString();
      if (data.produits_opco_f != null) mp["ligne2f"] = data.produits_opco_f.toString();
      if (data.produits_opco_g != null) mp["ligne2g"] = data.produits_opco_g.toString();
      if (data.produits_opco_h != null) mp["ligne2h"] = data.produits_opco_h.toString();
      if (data.produits_ligne3 != null) mp["ligne3"] = data.produits_ligne3.toString();
      if (data.produits_ligne4 != null) mp["ligne4"] = data.produits_ligne4.toString();
      if (data.produits_ligne5 != null) mp["ligne5"] = data.produits_ligne5.toString();
      if (data.produits_ligne6 != null) mp["ligne6"] = data.produits_ligne6.toString();
      if (data.produits_ligne7 != null) mp["ligne7"] = data.produits_ligne7.toString();
      if (data.produits_ligne8 != null) mp["ligne8"] = data.produits_ligne8.toString();
      if (data.produits_ligne9 != null) mp["ligne9"] = data.produits_ligne9.toString();
      if (data.produits_ligne10 != null) mp["ligne10"] = data.produits_ligne10.toString();
      if (data.produits_ligne11 != null) mp["ligne11"] = data.produits_ligne11.toString();
      setManualProduits(mp);
    } else {
      setExistingReportId(null);
      setUseAutoCalc(true);
      setManualProduits({});
      setChargesTotal("");
      setChargesSalaires("");
      setChargesAchats("");
      setCaGlobal("");
      setNotes("");
    }
  }, [annee]);

  useEffect(() => {
    void fetchAutoData();
    void fetchManualReport();
  }, [fetchAutoData, fetchManualReport]);

  // Pre-fill caGlobal from balance_sheets when no saved value and a bilan exists
  useEffect(() => {
    if (balanceSheetCa !== null && caGlobal === "") {
      setCaGlobal(balanceSheetCa.toString());
    }
  }, [balanceSheetCa, caGlobal]);

  // ── Save manual report ──────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const parseNum = (v: string) => (v.trim() === "" ? null : parseFloat(v));

      const payload = {
        annee,
        use_auto_calculation: useAutoCalc,
        produits_ligne1: parseNum(manualProduits["ligne1"] ?? ""),
        produits_opco_a: parseNum(manualProduits["ligne2a"] ?? ""),
        produits_opco_b: parseNum(manualProduits["ligne2b"] ?? ""),
        produits_opco_c: parseNum(manualProduits["ligne2c"] ?? ""),
        produits_opco_d: parseNum(manualProduits["ligne2d"] ?? ""),
        produits_opco_e: parseNum(manualProduits["ligne2e"] ?? ""),
        produits_opco_f: parseNum(manualProduits["ligne2f"] ?? ""),
        produits_opco_g: parseNum(manualProduits["ligne2g"] ?? ""),
        produits_opco_h: parseNum(manualProduits["ligne2h"] ?? ""),
        produits_ligne3: parseNum(manualProduits["ligne3"] ?? ""),
        produits_ligne4: parseNum(manualProduits["ligne4"] ?? ""),
        produits_ligne5: parseNum(manualProduits["ligne5"] ?? ""),
        produits_ligne6: parseNum(manualProduits["ligne6"] ?? ""),
        produits_ligne7: parseNum(manualProduits["ligne7"] ?? ""),
        produits_ligne8: parseNum(manualProduits["ligne8"] ?? ""),
        produits_ligne9: parseNum(manualProduits["ligne9"] ?? ""),
        produits_ligne10: parseNum(manualProduits["ligne10"] ?? ""),
        produits_ligne11: parseNum(manualProduits["ligne11"] ?? ""),
        charges_total: parseNum(chargesTotal),
        charges_salaires_formateurs: parseNum(chargesSalaires),
        charges_achats_prestations: parseNum(chargesAchats),
        chiffre_affaires_global: parseNum(caGlobal),
        notes: notes || null,
        updated_at: new Date().toISOString(),
      };

      let error: unknown;

      if (existingReportId) {
        const res = await (supabase
          .from("bpf_reports")
          .update(payload)
          .eq("id", existingReportId) as unknown as Promise<{ error: unknown }>);
        error = res.error;
      } else {
        const res = await (supabase
          .from("bpf_reports")
          .insert(payload) as unknown as Promise<{ error: unknown }>);
        error = res.error;
      }

      if (error) throw error;

      toast({ title: "Sauvegardé", description: "Le bilan BPF a été enregistré." });
      await fetchManualReport();
    } catch (err) {
      console.error("BPF save error:", err);
      toastError(toast, "Impossible de sauvegarder.");
    } finally {
      setSaving(false);
    }
  };

  // ── Derived values ──────────────────────────────────────────────────────────

  const totalProduits = BPF_LINES.reduce((s, l) => s + (produits[l.key] ?? 0), 0);
  const totalStagiaires = stagiaires.reduce((s, r) => s + r.nb_stagiaires, 0);
  const totalHeuresStagiaires = stagiaires.reduce((s, r) => s + r.nb_heures, 0);

  const caGlobalNum = parseFloat(caGlobal) || 0;
  const partFormation = caGlobalNum > 0 ? (totalProduits / caGlobalNum) * 100 : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ModuleLayout>
      <div className="max-w-6xl mx-auto p-3 md:p-6 print:p-4">
        <PageHeader
          icon={FileText}
          title="Bilan Pédagogique et Financier"
          subtitle={`Cerfa 10443*17 — Rapport annuel légal obligatoire`}
          backTo="/formations"
          actions={
            <div className="flex items-center gap-2">
              <Select value={annee.toString()} onValueChange={(v) => setAnnee(parseInt(v, 10))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
                <Printer className="w-4 h-4 mr-2" />
                Imprimer / PDF
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="print:hidden">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Enregistrement…" : "Sauvegarder"}
              </Button>
            </div>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="print:hidden">
          <TabsList className="mb-4">
            <TabsTrigger value="auto">Calcul automatique</TabsTrigger>
            <TabsTrigger value="manual">Données manuelles</TabsTrigger>
          </TabsList>

          {/* ── TAB 1: Calcul automatique ─────────────────────────────────── */}
          <TabsContent value="auto" className="space-y-6">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Chargement des données…
              </div>
            )}

            {!loading && (
              <>
                {/* Section C — Produits */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Section C — Produits de la formation professionnelle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {produits.unclassified > 0 && (
                      <div className="flex items-center gap-2 mb-4 text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span className="text-sm">
                          <strong>{EUR(produits.unclassified)}</strong> de chiffre d&apos;affaires n&apos;a pas de source de financement renseignée.
                          Assignez <code className="text-xs bg-amber-100 px-1 rounded">source_financement_bpf</code> sur chaque formation.
                        </span>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Ligne</TableHead>
                          <TableHead>Source de financement</TableHead>
                          <TableHead className="text-right">Montant HT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {BPF_LINES.filter((l) => produits[l.key] > 0 || true).map((l) => (
                          <TableRow key={l.key} className={produits[l.key] === 0 ? "text-muted-foreground" : ""}>
                            <TableCell className="font-mono text-xs">{l.bpfRef}</TableCell>
                            <TableCell>{l.label}</TableCell>
                            <TableCell className="text-right font-mono">
                              {produits[l.key] > 0 ? EUR(produits[l.key]) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold border-t-2">
                          <TableCell />
                          <TableCell>TOTAL produits formation</TableCell>
                          <TableCell className="text-right font-mono">{EUR(totalProduits)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Section E — Formateurs */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Section E — Formateurs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {trainers.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Aucun formateur trouvé pour {annee}.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Formateur</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="text-right">Sessions</TableHead>
                            <TableHead className="text-right">Heures totales</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {trainers.map((t) => (
                            <TableRow key={t.trainer_name}>
                              <TableCell className="font-medium">{t.trainer_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">Interne</Badge>
                              </TableCell>
                              <TableCell className="text-right">{t.nb_sessions}</TableCell>
                              <TableCell className="text-right">{t.total_hours.toFixed(1)} h</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Section F1 — Stagiaires */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Section F1 — Stagiaires par type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {unclassifiedParticipants > 0 && (
                      <div className="flex items-center gap-2 mb-4 text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span className="text-sm">
                          <strong>{unclassifiedParticipants} participant(s)</strong> sans type renseigné. Complétez le champ{" "}
                          <code className="text-xs bg-amber-100 px-1 rounded">type_stagiaire_bpf</code> sur chaque participant.
                        </span>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type de stagiaire</TableHead>
                          <TableHead className="text-right">Nb stagiaires</TableHead>
                          <TableHead className="text-right">Nb heures</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stagiaires.map((s) => (
                          <TableRow key={s.type ?? "autre"}>
                            <TableCell>{s.label}</TableCell>
                            <TableCell className="text-right">{s.nb_stagiaires}</TableCell>
                            <TableCell className="text-right">{s.nb_heures.toFixed(1)} h</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold border-t-2">
                          <TableCell>TOTAL</TableCell>
                          <TableCell className="text-right">{totalStagiaires}</TableCell>
                          <TableCell className="text-right">{totalHeuresStagiaires.toFixed(1)} h</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Section G — Sous-traitance reçue */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Section G — Formations confiées par un autre organisme</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sectionG.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        Aucune formation en sous-traitance reçue pour {annee}. Pour comptabiliser une formation ici, assignez{" "}
                        <code className="text-xs bg-muted px-1 rounded">source_financement_bpf = sous_traitance</code> sur la session.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Organisme commanditaire</TableHead>
                            <TableHead className="text-right">Nb stagiaires</TableHead>
                            <TableHead className="text-right">Nb heures</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sectionG.map((g) => (
                            <TableRow key={g.commanditaire}>
                              <TableCell>{g.commanditaire}</TableCell>
                              <TableCell className="text-right">{g.nb_stagiaires}</TableCell>
                              <TableCell className="text-right">{g.nb_heures.toFixed(1)} h</TableCell>
                            </TableRow>
                          ))}
                          {sectionG.length > 1 && (
                            <TableRow className="font-semibold border-t-2">
                              <TableCell>TOTAL</TableCell>
                              <TableCell className="text-right">
                                {sectionG.reduce((s, g) => s + g.nb_stagiaires, 0)}
                              </TableCell>
                              <TableCell className="text-right">
                                {sectionG.reduce((s, g) => s + g.nb_heures, 0).toFixed(1)} h
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Section F3 — Objectif des prestations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Section F3 — Objectif des prestations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type de formation</TableHead>
                          <TableHead className="text-right">Nb stagiaires</TableHead>
                          <TableHead className="text-right">Nb heures</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>d. Autres formations professionnelles continues</TableCell>
                          <TableCell className="text-right">{totalStagiaires}</TableCell>
                          <TableCell className="text-right">{totalHeuresStagiaires.toFixed(1)} h</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground mt-2">
                      Note : Les certifications RNCP ne sont pas encore tracées — toutes les formations sont classées en « Autres formations professionnelles ».
                    </p>
                  </CardContent>
                </Card>

                {/* Section F4 — Spécialités NSF */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Section F4 — Spécialités (codes NSF)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {trainingsWithoutCatalog > 0 && (
                      <div className="flex items-center gap-2 mb-4 text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span className="text-sm">
                          <strong>{trainingsWithoutCatalog} formation(s)</strong> sans catalogue associé — impossible de déterminer le code NSF.
                        </span>
                      </div>
                    )}
                    {nsfStats.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        Aucune spécialité NSF trouvée. Renseignez <code className="text-xs bg-muted px-1 rounded">code_specialite_nsf</code> dans les fiches catalogue.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24">Code NSF</TableHead>
                            <TableHead>Libellé</TableHead>
                            <TableHead className="text-right">Nb stagiaires</TableHead>
                            <TableHead className="text-right">Nb heures</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {nsfStats.map((n) => (
                            <TableRow key={n.code}>
                              <TableCell className="font-mono text-sm">{n.code}</TableCell>
                              <TableCell>{n.label}</TableCell>
                              <TableCell className="text-right">{n.nb_stagiaires}</TableCell>
                              <TableCell className="text-right">{n.total_heures.toFixed(1)} h</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ── TAB 2: Données manuelles ──────────────────────────────────── */}
          <TabsContent value="manual" className="space-y-6">

            {/* Section C override */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Section C — Produits (saisie manuelle)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="useAutoCalc"
                    checked={useAutoCalc}
                    onChange={(e) => setUseAutoCalc(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="useAutoCalc" className="cursor-pointer">
                    Utiliser les valeurs calculées automatiquement depuis les formations
                  </Label>
                </div>

                {!useAutoCalc && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {BPF_LINES.map((l) => (
                      <div key={l.key} className="flex flex-col gap-1">
                        <Label htmlFor={`mp-${l.key}`} className="text-xs">
                          Ligne {l.bpfRef} — {l.label}
                        </Label>
                        <Input
                          id={`mp-${l.key}`}
                          type="number"
                          placeholder="0"
                          value={manualProduits[l.key] ?? ""}
                          onChange={(e) =>
                            setManualProduits((prev) => ({ ...prev, [l.key]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section D — Charges */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Section D — Charges</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="chargesTotal">Total charges (€ HT)</Label>
                    <Input
                      id="chargesTotal"
                      type="number"
                      placeholder="0"
                      value={chargesTotal}
                      onChange={(e) => setChargesTotal(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="chargesSalaires">dont Salaires formateurs (€ HT)</Label>
                    <Input
                      id="chargesSalaires"
                      type="number"
                      placeholder="0"
                      value={chargesSalaires}
                      onChange={(e) => setChargesSalaires(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="chargesAchats">dont Achats prestations formation (€ HT)</Label>
                    <Input
                      id="chargesAchats"
                      type="number"
                      placeholder="0"
                      value={chargesAchats}
                      onChange={(e) => setChargesAchats(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CA global */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chiffre d&apos;affaires global</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-1 max-w-xs">
                  <Label htmlFor="caGlobal">CA global de l&apos;entreprise (€ HT)</Label>
                  <Input
                    id="caGlobal"
                    type="number"
                    placeholder="0"
                    value={caGlobal}
                    onChange={(e) => setCaGlobal(e.target.value)}
                  />
                  {balanceSheetCa !== null && (
                    <p className="text-xs text-muted-foreground">
                      Importé depuis le bilan comptable {annee} :{" "}
                      <strong>{EUR(balanceSheetCa)}</strong>
                    </p>
                  )}
                  {balanceSheetCa === null && (
                    <p className="text-xs text-muted-foreground">
                      Importez votre bilan comptable {annee} dans{" "}
                      <a href="/finances" className="underline">Finances</a>{" "}
                      pour pré-remplir automatiquement ce champ.
                    </p>
                  )}
                </div>
                {partFormation !== null && (
                  <div className="bg-muted rounded p-3 text-sm">
                    Part CA formation = {EUR(totalProduits)} / {EUR(caGlobalNum)} × 100{" "}
                    = <strong>{partFormation.toFixed(1)}%</strong>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes libres</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                  placeholder="Notes, observations, précisions sur le bilan…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Print-only view */}
        <div className="hidden print:block space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-xl font-bold">Bilan Pédagogique et Financier — {annee}</h1>
            <p className="text-sm text-muted-foreground">Cerfa 10443*17</p>
          </div>

          <section>
            <h2 className="font-semibold text-base border-b pb-1 mb-3">Section C — Produits</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 w-12">Ligne</th>
                  <th className="text-left py-1">Source</th>
                  <th className="text-right py-1">Montant HT</th>
                </tr>
              </thead>
              <tbody>
                {BPF_LINES.filter((l) => produits[l.key] > 0).map((l) => (
                  <tr key={l.key} className="border-b border-dashed">
                    <td className="py-1 font-mono text-xs">{l.bpfRef}</td>
                    <td className="py-1">{l.label}</td>
                    <td className="py-1 text-right font-mono">{EUR(produits[l.key])}</td>
                  </tr>
                ))}
                <tr className="font-semibold border-t">
                  <td />
                  <td className="py-1">TOTAL</td>
                  <td className="py-1 text-right font-mono">{EUR(totalProduits)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="font-semibold text-base border-b pb-1 mb-3">Section F1 — Stagiaires</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">Type</th>
                  <th className="text-right py-1">Nb stagiaires</th>
                  <th className="text-right py-1">Nb heures</th>
                </tr>
              </thead>
              <tbody>
                {stagiaires.map((s) => (
                  <tr key={s.type ?? "autre"} className="border-b border-dashed">
                    <td className="py-1">{s.label}</td>
                    <td className="py-1 text-right">{s.nb_stagiaires}</td>
                    <td className="py-1 text-right">{s.nb_heures.toFixed(1)} h</td>
                  </tr>
                ))}
                <tr className="font-semibold border-t">
                  <td className="py-1">TOTAL</td>
                  <td className="py-1 text-right">{totalStagiaires}</td>
                  <td className="py-1 text-right">{totalHeuresStagiaires.toFixed(1)} h</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </ModuleLayout>
  );
}
