import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { capitalizeName } from "@/lib/utils";
import type { FormationConfig, FormationDate, DevisHistoryItem } from "@/types/micro-devis";
import { LIEUX } from "@/types/micro-devis";
import { User } from "@supabase/supabase-js";

// ────────────────────────────────────────────────────────────
// State shape for the entire form
// ────────────────────────────────────────────────────────────
export interface MicroDevisFormState {
  // Client info
  nomClient: string;
  adresseClient: string;
  codePostalClient: string;
  villeClient: string;
  pays: string;
  paysAutre: string;
  emailCommanditaire: string;
  adresseCommanditaire: string;
  // Devis type
  typeDevis: "formation" | "jeu" | "";
  isAdministration: "oui" | "non" | "";
  noteDevis: string;
  // Formation
  formatFormation: "intra" | "inter" | "";
  participants: string;
  formationDemandee: string;
  formationLibre: string;
  dateFormation: string;
  dateFormationLibre: string;
  lieu: string;
  lieuAutre: string;
  includeCadeau: boolean;
  fraisDossier: "oui" | "non" | "";
  typeSubrogation: "sans" | "avec" | "les2";
}

const STORAGE_KEY = "microDevisFormData";

function initialFormState(): MicroDevisFormState {
  return {
    nomClient: "",
    adresseClient: "",
    codePostalClient: "",
    villeClient: "",
    pays: "france",
    paysAutre: "",
    emailCommanditaire: "",
    adresseCommanditaire: "",
    typeDevis: "",
    isAdministration: "",
    noteDevis: "",
    formatFormation: "",
    participants: "",
    formationDemandee: "",
    formationLibre: "",
    dateFormation: "",
    dateFormationLibre: "",
    lieu: "",
    lieuAutre: "",
    includeCadeau: false,
    fraisDossier: "",
    typeSubrogation: "les2",
  };
}

export function useMicroDevisForm(user: User | null) {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // ── Form state (single object instead of 30+ useState) ──
  const [form, setForm] = useState<MicroDevisFormState>(initialFormState);

  // Helper to update a single field
  const setField = useCallback(<K extends keyof MicroDevisFormState>(
    key: K,
    value: MicroDevisFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── Formation configs ──
  const [formationConfigs, setFormationConfigs] = useState<FormationConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [editingFormation, setEditingFormation] = useState<FormationConfig | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [newFormation, setNewFormation] = useState<Partial<FormationConfig> | null>(null);

  // ── Formation dates ──
  const [formationDates, setFormationDates] = useState<FormationDate[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [editingDate, setEditingDate] = useState<FormationDate | null>(null);
  const [datesDialogOpen, setDatesDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState<Partial<FormationDate> | null>(null);

  // ── UI state ──
  const [jsonPreviewOpen, setJsonPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [crmCardId, setCrmCardId] = useState<string | null>(null);
  const [siren, setSiren] = useState("");
  const [searchingSiren, setSearchingSiren] = useState(false);
  const [initialDefaultsApplied, setInitialDefaultsApplied] = useState(false);

  // ── History ──
  const [devisHistory, setDevisHistory] = useState<DevisHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // ────────────────────────────────────────────────────────────
  // Effects
  // ────────────────────────────────────────────────────────────

  // Load formation configs
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("formation_configs")
          .select("*")
          .order("display_order");
        if (error) throw error;
        if (data && data.length > 0) {
          const configs = data as FormationConfig[];
          setFormationConfigs(configs);
          if (!initialDefaultsApplied && !form.formationDemandee) {
            const def = configs.find((f) => f.is_default);
            if (def) setField("formationDemandee", def.formation_name);
          }
        }
      } catch (error) {
        console.error("Error loading formation configs:", error);
        toast({ title: "Erreur", description: "Impossible de charger les configurations de formations", variant: "destructive" });
      } finally {
        setLoadingConfigs(false);
      }
    };
    load();
  }, [user, toast, initialDefaultsApplied, form.formationDemandee, setField]);

  // Load formation dates
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("formation_dates")
          .select("*")
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
          setFormationDates(data as FormationDate[]);
          if (!initialDefaultsApplied && !form.dateFormation) {
            const def = data.find((d: FormationDate) => d.is_default);
            if (def) setField("dateFormation", def.date_label);
          }
        }
      } catch (error) {
        console.error("Error loading formation dates:", error);
        toast({ title: "Erreur", description: "Impossible de charger les dates de formations", variant: "destructive" });
      } finally {
        setLoadingDates(false);
      }
    };
    load();
  }, [user, toast, initialDefaultsApplied, form.dateFormation, setField]);

  // Mark initial defaults applied
  useEffect(() => {
    if (!loadingConfigs && !loadingDates && !initialDefaultsApplied) {
      setInitialDefaultsApplied(true);
    }
  }, [loadingConfigs, loadingDates, initialDefaultsApplied]);

  // Restore from sessionStorage (skip if coming from CRM)
  useEffect(() => {
    if (searchParams.get("source") === "crm") return;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setForm((prev) => ({ ...prev, ...data }));
      }
    } catch (e) {
      console.error("Failed to load saved form data:", e);
    }
  }, [searchParams]);

  // Load from CRM URL params
  useEffect(() => {
    if (searchParams.get("source") !== "crm") return;
    const nomClientParam = searchParams.get("nomClient");
    const emailParam = searchParams.get("emailCommanditaire");
    const adresseParam = searchParams.get("adresseCommanditaire");
    const cardIdParam = searchParams.get("crmCardId");
    setForm((prev) => ({
      ...prev,
      ...(nomClientParam && { nomClient: nomClientParam }),
      ...(emailParam && { emailCommanditaire: emailParam }),
      ...(adresseParam && { adresseCommanditaire: adresseParam }),
      typeDevis: "formation" as const,
    }));
    if (cardIdParam) setCrmCardId(cardIdParam);
    toast({ title: "Données préremplies", description: "Les informations de l'opportunité CRM ont été importées." });
  }, [searchParams, toast]);

  // Persist key fields to sessionStorage
  useEffect(() => {
    const data = {
      formatFormation: form.formatFormation,
      formationDemandee: form.formationDemandee,
      formationLibre: form.formationLibre,
      dateFormation: form.dateFormation,
      dateFormationLibre: form.dateFormationLibre,
      lieu: form.lieu,
      lieuAutre: form.lieuAutre,
      nomClient: form.nomClient,
      emailCommanditaire: form.emailCommanditaire,
      typeDevis: form.typeDevis,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [
    form.formatFormation, form.formationDemandee, form.formationLibre,
    form.dateFormation, form.dateFormationLibre, form.lieu, form.lieuAutre,
    form.nomClient, form.emailCommanditaire, form.typeDevis,
  ]);

  // Auto-set lieu when formation contains "en ligne"
  useEffect(() => {
    if (form.formationDemandee.toLowerCase().includes("en ligne")) {
      setField("lieu", "En ligne en accédant à son compte sur supertilt.fr");
    }
  }, [form.formationDemandee, setField]);

  // Load devis history when dialog opens
  useEffect(() => {
    if (!historyDialogOpen) return;
    const load = async () => {
      setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from("activity_logs")
          .select("id, created_at, recipient_email, details")
          .eq("action_type", "micro_devis_sent")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        setDevisHistory((data || []) as unknown as DevisHistoryItem[]);
      } catch (error) {
        console.error("Error loading devis history:", error);
        toast({ title: "Erreur", description: "Impossible de charger l'historique des devis", variant: "destructive" });
      } finally {
        setLoadingHistory(false);
      }
    };
    load();
  }, [historyDialogOpen, toast]);

  // ────────────────────────────────────────────────────────────
  // Derived values
  // ────────────────────────────────────────────────────────────

  const getSelectedFormationConfig = (): FormationConfig | undefined =>
    formationConfigs.find((f) => f.formation_name === form.formationDemandee);

  const countParticipants = (): number => {
    if (!form.participants.trim()) return 1;
    const lines = form.participants.split(/[,;\n]/).filter((l) => l.trim());
    return Math.max(1, lines.length);
  };

  const buildClientAddress = () => {
    const parts = [form.adresseClient];
    if (form.codePostalClient || form.villeClient) {
      parts.push(`${form.codePostalClient} ${form.villeClient}`.trim());
    }
    return parts.filter((p) => p).join(", ");
  };

  const filteredHistory = devisHistory.filter((item) => {
    const s = historySearch.toLowerCase();
    return (
      item.recipient_email?.toLowerCase().includes(s) ||
      item.details?.formation_name?.toLowerCase().includes(s) ||
      item.details?.client_name?.toLowerCase().includes(s)
    );
  });

  // ────────────────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────────────────

  const handleSearchSiren = async () => {
    if (!siren || !/^\d{9}$/.test(siren)) {
      toast({ title: "SIREN invalide", description: "Le SIREN doit contenir exactement 9 chiffres", variant: "destructive" });
      return;
    }
    setSearchingSiren(true);
    try {
      const response = await supabase.functions.invoke("search-siren", { body: { siren } });
      if (response.error) {
        const errorData = response.data;
        if (errorData?.error) {
          toast({ title: "Service temporairement indisponible", description: `${errorData.error} Vous pouvez saisir les informations manuellement.` });
        } else {
          toast({ title: "Erreur de recherche", description: "Impossible de contacter le service INSEE. Veuillez saisir les informations manuellement." });
        }
        return;
      }
      const data = response.data;
      if (data?.error) {
        toast({ title: "Recherche SIREN", description: data.error });
        return;
      }
      setForm((prev) => ({
        ...prev,
        ...(data?.nomClient && { nomClient: capitalizeName(data.nomClient) }),
        ...(data?.adresse && { adresseClient: capitalizeName(data.adresse) }),
        ...(data?.codePostal && { codePostalClient: data.codePostal }),
        ...(data?.ville && { villeClient: capitalizeName(data.ville) }),
        ...(data?.pays && data.pays !== "France" ? { pays: "autre", paysAutre: capitalizeName(data.pays) } : { pays: "france" }),
      }));
      toast({ title: "Entreprise trouvée", description: `${data?.nomClient || "Entreprise"} - ${data?.ville || ""}` });
    } catch {
      toast({ title: "Recherche SIREN indisponible", description: "Le service de recherche est temporairement indisponible. Vous pouvez saisir les informations manuellement." });
    } finally {
      setSearchingSiren(false);
    }
  };

  const handleDuplicateDevis = (item: DevisHistoryItem) => {
    const formData = item.details?.form_data;
    if (formData) {
      const lieuValue = formData.lieu || "";
      let newLieu = "";
      let newLieuAutre = formData.lieuAutre || "";
      if (LIEUX.includes(lieuValue)) {
        newLieu = lieuValue;
      } else if (lieuValue) {
        newLieu = "autre";
        newLieuAutre = formData.lieuAutre || lieuValue;
      }

      setForm({
        nomClient: formData.nomClient || "",
        adresseClient: formData.adresseClient || "",
        codePostalClient: formData.codePostalClient || "",
        villeClient: formData.villeClient || "",
        pays: formData.pays === "France" ? "france" : "autre",
        paysAutre: formData.pays && formData.pays !== "France" ? formData.pays : "",
        emailCommanditaire: formData.emailCommanditaire || "",
        adresseCommanditaire: formData.adresseCommanditaire || "",
        typeDevis: formData.typeDevis || "formation",
        isAdministration: formData.isAdministration ? "oui" : "non",
        noteDevis: formData.noteDevis || "",
        formatFormation: formData.formatFormation || "inter",
        participants: formData.participants || "",
        formationDemandee: formData.formationDemandee || "",
        formationLibre: formData.formationLibre || "",
        dateFormation: formData.dateFormation || "",
        dateFormationLibre: formData.dateFormationLibre || "",
        lieu: newLieu,
        lieuAutre: newLieuAutre,
        includeCadeau: formData.includeCadeau || false,
        fraisDossier: formData.fraisDossier ? "oui" : "non",
        typeSubrogation: formData.typeSubrogation || "les2",
      });
    } else {
      setForm((prev) => ({
        ...prev,
        nomClient: item.details?.client_name || "",
        emailCommanditaire: item.recipient_email || "",
        typeDevis: "formation",
        formatFormation: "inter",
        formationDemandee: item.details?.formation_name || "",
        typeSubrogation: (item.details?.type_subrogation as "sans" | "avec" | "les2") || "les2",
      }));
    }
    setHistoryDialogOpen(false);
    toast({ title: "Devis dupliqué", description: "Le formulaire a été pré-rempli avec les données du devis sélectionné." });
  };

  const handleDeleteDevis = async (item: DevisHistoryItem) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce devis de l'historique ?")) return;
    try {
      const { error } = await supabase.from("activity_logs").delete().eq("id", item.id);
      if (error) throw error;
      setDevisHistory((prev) => prev.filter((d) => d.id !== item.id));
      toast({ title: "Devis supprimé", description: "Le devis a été supprimé de l'historique." });
    } catch (error) {
      console.error("Error deleting devis:", error);
      toast({ title: "Erreur", description: "Impossible de supprimer le devis.", variant: "destructive" });
    }
  };

  // ── Formation config CRUD ──

  const handleSaveFormationConfig = async () => {
    if (!editingFormation) return;
    try {
      const { error } = await supabase.from("formation_configs").update({
        formation_name: editingFormation.formation_name,
        prix: editingFormation.prix,
        duree_heures: editingFormation.duree_heures,
        programme_url: editingFormation.programme_url,
      }).eq("id", editingFormation.id);
      if (error) throw error;
      setFormationConfigs((prev) => prev.map((f) => (f.id === editingFormation.id ? editingFormation : f)));
      toast({ title: "Configuration sauvegardée", description: `Les paramètres de "${editingFormation.formation_name}" ont été mis à jour.` });
      setEditingFormation(null);
    } catch (error) {
      console.error("Error saving formation config:", error);
      toast({ title: "Erreur", description: "Impossible de sauvegarder la configuration", variant: "destructive" });
    }
  };

  const handleAddFormation = async () => {
    if (!newFormation?.formation_name || !newFormation?.programme_url) return;
    try {
      const { data, error } = await supabase.from("formation_configs").insert({
        formation_name: newFormation.formation_name,
        prix: newFormation.prix || 0,
        duree_heures: newFormation.duree_heures || 0,
        programme_url: newFormation.programme_url || null,
        is_default: false,
      }).select().single();
      if (error) throw error;
      setFormationConfigs((prev) => [...prev, data as FormationConfig].sort((a, b) => a.formation_name.localeCompare(b.formation_name)));
      toast({ title: "Formation ajoutée", description: `"${newFormation.formation_name}" a été ajoutée.` });
      setNewFormation(null);
    } catch (error) {
      console.error("Error adding formation:", error);
      toast({ title: "Erreur", description: "Impossible d'ajouter la formation", variant: "destructive" });
    }
  };

  const handleDeleteFormation = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("formation_configs").delete().eq("id", id);
      if (error) throw error;
      setFormationConfigs((prev) => prev.filter((f) => f.id !== id));
      toast({ title: "Formation supprimée", description: `"${name}" a été supprimée.` });
    } catch (error) {
      console.error("Error deleting formation:", error);
      toast({ title: "Erreur", description: "Impossible de supprimer la formation", variant: "destructive" });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await supabase.from("formation_configs").update({ is_default: false }).neq("id", "");
      const { error } = await supabase.from("formation_configs").update({ is_default: true }).eq("id", id);
      if (error) throw error;
      setFormationConfigs((prev) => prev.map((f) => ({ ...f, is_default: f.id === id })));
      const formation = formationConfigs.find((f) => f.id === id);
      toast({ title: "Formation par défaut", description: `"${formation?.formation_name}" est maintenant la formation par défaut.` });
    } catch (error) {
      console.error("Error setting default:", error);
      toast({ title: "Erreur", description: "Impossible de définir la formation par défaut", variant: "destructive" });
    }
  };

  const handleMoveFormation = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formationConfigs.length) return;
    const newConfigs = [...formationConfigs];
    const temp = newConfigs[index];
    newConfigs[index] = newConfigs[newIndex];
    newConfigs[newIndex] = temp;
    const updates = [
      { id: newConfigs[index].id, display_order: index },
      { id: newConfigs[newIndex].id, display_order: newIndex },
    ];
    setFormationConfigs(newConfigs);
    try {
      for (const update of updates) {
        const { error } = await supabase.from("formation_configs").update({ display_order: update.display_order }).eq("id", update.id);
        if (error) throw error;
      }
    } catch (error) {
      console.error("Error reordering formations:", error);
      toast({ title: "Erreur", description: "Impossible de réorganiser les formations", variant: "destructive" });
    }
  };

  // ── Formation dates CRUD ──

  const handleAddDate = async (label: string) => {
    try {
      const { data, error } = await supabase.from("formation_dates").insert({ date_label: label, is_default: false }).select().single();
      if (error) throw error;
      setFormationDates((prev) => [...prev, data as FormationDate]);
      toast({ title: "Date ajoutée", description: `"${label}" a été ajoutée.` });
      setNewDate(null);
    } catch (error) {
      console.error("Error adding date:", error);
      toast({ title: "Erreur", description: "Impossible d'ajouter la date", variant: "destructive" });
    }
  };

  const handleDeleteDate = async (id: string, label: string) => {
    try {
      const { error } = await supabase.from("formation_dates").delete().eq("id", id);
      if (error) throw error;
      setFormationDates((prev) => prev.filter((d) => d.id !== id));
      toast({ title: "Date supprimée", description: `"${label}" a été supprimée.` });
    } catch (error) {
      console.error("Error deleting date:", error);
      toast({ title: "Erreur", description: "Impossible de supprimer la date", variant: "destructive" });
    }
  };

  const handleSetDefaultDate = async (id: string, label: string) => {
    try {
      await supabase.from("formation_dates").update({ is_default: false }).neq("id", "");
      const { error } = await supabase.from("formation_dates").update({ is_default: true }).eq("id", id);
      if (error) throw error;
      setFormationDates((prev) => prev.map((d) => ({ ...d, is_default: d.id === id })));
      toast({ title: "Date par défaut", description: `"${label}" est maintenant la date par défaut.` });
    } catch (error) {
      console.error("Error setting default:", error);
      toast({ title: "Erreur", description: "Impossible de définir la date par défaut", variant: "destructive" });
    }
  };

  const handleSaveDate = async (date: FormationDate) => {
    try {
      const { error } = await supabase.from("formation_dates").update({ date_label: date.date_label }).eq("id", date.id);
      if (error) throw error;
      setFormationDates((prev) => prev.map((d) => (d.id === date.id ? date : d)));
      toast({ title: "Date sauvegardée", description: "Les modifications ont été enregistrées." });
      setEditingDate(null);
    } catch (error) {
      console.error("Error saving date:", error);
      toast({ title: "Erreur", description: "Impossible de sauvegarder la date", variant: "destructive" });
    }
  };

  // ── Build payload ──

  const buildPayload = () => {
    const selectedConfig = getSelectedFormationConfig();
    if (!selectedConfig) return null;
    const finalLieu = form.lieu === "autre"
      ? form.lieuAutre
      : form.lieu === "Chez le client"
        ? buildClientAddress()
        : form.lieu;
    const finalPays = form.pays === "autre" ? form.paysAutre : "France";
    const nbParticipants = countParticipants();
    const participantsList = form.participants.split(/[,;\n]/).map((p) => p.trim()).filter((p) => p.length > 0);
    const cadeauText = form.includeCadeau
      ? "Chaque participant(e) aura : 1 kit de facilitation graphique ainsi qu'un accès illimité et à vie au e-learning de 25h pour continuer sa formation en facilitation graphique"
      : "";

    return {
      requestPayload: {
        nomClient: form.nomClient,
        adresseClient: form.adresseClient,
        codePostalClient: form.codePostalClient,
        villeClient: form.villeClient,
        pays: finalPays,
        emailCommanditaire: form.emailCommanditaire,
        adresseCommanditaire: form.adresseCommanditaire,
        isAdministration: form.isAdministration === "oui",
        noteDevis: form.noteDevis,
        formationDemandee: form.formationDemandee,
        dateFormation: form.dateFormation,
        lieu: finalLieu,
        includeCadeau: form.includeCadeau,
        fraisDossier: form.fraisDossier === "oui",
        prix: selectedConfig.prix,
        dureeHeures: selectedConfig.duree_heures,
        programmeUrl: selectedConfig.programme_url,
        nbParticipants,
        participants: form.participants,
      },
      pdfMonkeyPayload: {
        client: {
          name: form.nomClient,
          address: form.adresseClient,
          zip: form.codePostalClient,
          city: form.villeClient,
          country: finalPays,
        },
        note: form.noteDevis || "",
        affiche_frais: form.fraisDossier === "oui" ? "Oui" : "Non",
        subrogation: "Oui / Non (2 versions)",
        cadeau: cadeauText,
        items: [{
          name: form.formationDemandee,
          participant_name: participantsList.length > 0 ? participantsList : [`${form.adresseCommanditaire} ${form.emailCommanditaire}`],
          date: form.dateFormation,
          place: finalLieu,
          duration: `${selectedConfig.duree_heures}h`,
          quantity: nbParticipants,
          unit_price: selectedConfig.prix,
        }],
        admin_fee: form.fraisDossier === "oui" ? 150 : 0,
        is_administration: form.isAdministration === "oui",
      },
    };
  };

  // ── Submit ──

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.typeDevis !== "formation") {
      toast({ title: "Fonctionnalité en développement", description: "La génération de devis pour les jeux sera bientôt disponible." });
      return;
    }
    const selectedConfig = getSelectedFormationConfig();
    if (!selectedConfig) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une formation", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const finalLieu = form.lieu === "autre" ? form.lieuAutre : form.lieu;
      const finalPays = form.pays === "autre" ? form.paysAutre : "France";
      const normalizedEmail = form.emailCommanditaire.trim().toLowerCase();
      const response = await supabase.functions.invoke("generate-micro-devis", {
        body: {
          nomClient: form.nomClient, adresseClient: form.adresseClient, codePostalClient: form.codePostalClient,
          villeClient: form.villeClient, pays: finalPays, emailCommanditaire: normalizedEmail,
          adresseCommanditaire: form.adresseCommanditaire, isAdministration: form.isAdministration === "oui",
          noteDevis: form.noteDevis, formationDemandee: form.formationDemandee, dateFormation: form.dateFormation,
          lieu: finalLieu, includeCadeau: form.includeCadeau, fraisDossier: form.fraisDossier === "oui",
          prix: selectedConfig.prix, dureeHeures: selectedConfig.duree_heures, programmeUrl: selectedConfig.programme_url,
          nbParticipants: countParticipants(), participants: form.participants, typeSubrogation: form.typeSubrogation,
          typeDevis: form.typeDevis, formatFormation: form.formatFormation, formationLibre: form.formationLibre,
          dateFormationLibre: form.dateFormationLibre, lieuAutre: form.lieuAutre,
          ...(crmCardId && { crmCardId, senderEmail: user?.email }),
        },
      });
      if (response.error) throw new Error(response.error.message);
      const successMessage = form.typeSubrogation === "les2"
        ? `Les 2 devis ont été générés et envoyés à ${normalizedEmail}`
        : `Le devis a été généré et envoyé à ${normalizedEmail}`;
      toast({ title: form.typeSubrogation === "les2" ? "Devis envoyés !" : "Devis envoyé !", description: successMessage });
      if (searchParams.get("source") === "crm") {
        setTimeout(() => { window.close(); }, 1500);
        return;
      }
      // Reset form
      const defaultFormation = formationConfigs.find((f) => f.is_default);
      setForm({
        ...initialFormState(),
        formationDemandee: defaultFormation?.formation_name || "",
      });
    } catch (error: unknown) {
      console.error("Error generating micro-devis:", error);
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({ title: "Erreur", description: errorMessage, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return {
    // Form state
    form,
    setField,
    setForm,

    // Formation configs
    formationConfigs,
    loadingConfigs,
    editingFormation,
    setEditingFormation,
    configDialogOpen,
    setConfigDialogOpen,
    newFormation,
    setNewFormation,

    // Formation dates
    formationDates,
    loadingDates,
    editingDate,
    setEditingDate,
    datesDialogOpen,
    setDatesDialogOpen,
    newDate,
    setNewDate,

    // UI state
    jsonPreviewOpen,
    setJsonPreviewOpen,
    submitting,
    siren,
    setSiren,
    searchingSiren,
    crmCardId,

    // History
    devisHistory,
    loadingHistory,
    historySearch,
    setHistorySearch,
    historyDialogOpen,
    setHistoryDialogOpen,
    filteredHistory,

    // Derived
    getSelectedFormationConfig,
    countParticipants,

    // Handlers
    handleSearchSiren,
    handleDuplicateDevis,
    handleDeleteDevis,
    handleSaveFormationConfig,
    handleAddFormation,
    handleDeleteFormation,
    handleSetDefault,
    handleMoveFormation,
    handleAddDate,
    handleDeleteDate,
    handleSetDefaultDate,
    handleSaveDate,
    buildPayload,
    handleSubmit,
  };
}
