import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, FileText, Send, Eye } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import type { FormationConfig, DevisHistoryItem } from "@/types/formations";
import { LIEUX } from "@/lib/formationConstants";
import { useFormationConfigs } from "@/hooks/useFormationConfigs";
import { useFormationDates } from "@/hooks/useFormationDates";
import { useFormationFormulas } from "@/hooks/useFormationFormulas";
import { useDevisHistory } from "@/hooks/useDevisHistory";
import { useSirenSearch } from "@/hooks/useSirenSearch";
import DevisHistoryDialog from "@/components/formations/DevisHistoryDialog";
import FormationFormSection from "@/components/formations/FormationFormSection";
import ClientInfoSection from "@/components/formations/ClientInfoSection";
import TypeDevisSection from "@/components/formations/TypeDevisSection";

const MicroDevis = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [crmCardId, setCrmCardId] = useState<string | null>(null);
  const [nomClient, setNomClient] = useState("");
  const [adresseClient, setAdresseClient] = useState("");
  const [codePostalClient, setCodePostalClient] = useState("");
  const [villeClient, setVilleClient] = useState("");
  const [pays, setPays] = useState("france");
  const [paysAutre, setPaysAutre] = useState("");
  const [emailCommanditaire, setEmailCommanditaire] = useState("");
  const [civiliteCommanditaire, setCiviliteCommanditaire] = useState<"M." | "Mme" | "">("");
  const [nomCommanditaire, setNomCommanditaire] = useState("");
  const [typeDevis, setTypeDevis] = useState<"formation" | "jeu" | "">("");
  const [isAdministration, setIsAdministration] = useState<"oui" | "non" | "">("");
  const [noteDevis, setNoteDevis] = useState("");
  const [formatFormation, setFormatFormation] = useState<"intra" | "inter" | "">("");
  const [participants, setParticipants] = useState("");
  const [formationDemandee, setFormationDemandee] = useState("");
  const [formationLibre, setFormationLibre] = useState("");
  const [dateFormation, setDateFormation] = useState("");
  const [dateFormationLibre, setDateFormationLibre] = useState("");
  const [lieu, setLieu] = useState("");
  const [lieuAutre, setLieuAutre] = useState("");
  const [includeCadeau, setIncludeCadeau] = useState(false);
  const [fraisDossier, setFraisDossier] = useState<"oui" | "non" | "">("");
  const [typeSubrogation, setTypeSubrogation] = useState<"sans" | "avec" | "les2">("les2");
  const [jsonPreviewOpen, setJsonPreviewOpen] = useState(false);
  const [initialDefaultsApplied, setInitialDefaultsApplied] = useState(false);

  const STORAGE_KEY = "microDevisFormData";

  // Extracted hooks
  const sirenSearch = useSirenSearch();
  const configsHook = useFormationConfigs(user, initialDefaultsApplied, formationDemandee);
  const datesHook = useFormationDates(user, initialDefaultsApplied, dateFormation);
  const formulasHook = useFormationFormulas(formationDemandee, configsHook.formationConfigs);
  const historyHook = useDevisHistory();

  // Auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) navigate("/auth");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Apply initial defaults
  useEffect(() => {
    if (!initialDefaultsApplied && !formationDemandee && configsHook.formationConfigs.length > 0) {
      const def = configsHook.formationConfigs.find(f => f.is_default);
      if (def) setFormationDemandee(def.formation_name);
    }
  }, [configsHook.formationConfigs, initialDefaultsApplied, formationDemandee]);

  useEffect(() => {
    if (!initialDefaultsApplied && !dateFormation && datesHook.formationDates.length > 0) {
      const def = datesHook.formationDates.find(d => d.is_default);
      if (def) setDateFormation(def.date_label);
    }
  }, [datesHook.formationDates, initialDefaultsApplied, dateFormation]);

  useEffect(() => {
    if (!configsHook.loadingConfigs && !datesHook.loadingDates && !initialDefaultsApplied)
      setInitialDefaultsApplied(true);
  }, [configsHook.loadingConfigs, datesHook.loadingDates, initialDefaultsApplied]);

  // Load form from sessionStorage (skip CRM)
  useEffect(() => {
    if (searchParams.get("source") === "crm") return;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.formatFormation) setFormatFormation(d.formatFormation);
        if (d.formationDemandee) setFormationDemandee(d.formationDemandee);
        if (d.formationLibre) setFormationLibre(d.formationLibre);
        if (d.dateFormation) setDateFormation(d.dateFormation);
        if (d.dateFormationLibre) setDateFormationLibre(d.dateFormationLibre);
        if (d.lieu) setLieu(d.lieu);
        if (d.lieuAutre) setLieuAutre(d.lieuAutre);
        if (d.nomClient) setNomClient(d.nomClient);
        if (d.emailCommanditaire) setEmailCommanditaire(d.emailCommanditaire);
        if (d.typeDevis) setTypeDevis(d.typeDevis);
      }
    } catch (e) { console.error("Failed to load saved form data:", e); }
  }, [searchParams]);

  // Load CRM params
  useEffect(() => {
    if (searchParams.get("source") !== "crm") return;
    const n = searchParams.get("nomClient");
    const e = searchParams.get("emailCommanditaire");
    const a = searchParams.get("adresseCommanditaire");
    const c = searchParams.get("crmCardId");
    if (n) setNomClient(n);
    if (e) setEmailCommanditaire(e);
    if (a) {
      // Parse "Mme Dupont" or "M. Dupont" from CRM prefill
      if (a.startsWith("Mme ")) { setCiviliteCommanditaire("Mme"); setNomCommanditaire(a.slice(4)); }
      else if (a.startsWith("M. ")) { setCiviliteCommanditaire("M."); setNomCommanditaire(a.slice(3)); }
      else { setNomCommanditaire(a); }
    }
    if (c) setCrmCardId(c);
    setTypeDevis("formation");
    toast({ title: "Données préremplies", description: "Les informations de l'opportunité CRM ont été importées." });
  }, [searchParams, toast]);

  // Persist form
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      formatFormation, formationDemandee, formationLibre, dateFormation,
      dateFormationLibre, lieu, lieuAutre, nomClient, emailCommanditaire, typeDevis,
    }));
  }, [formatFormation, formationDemandee, formationLibre, dateFormation, dateFormationLibre, lieu, lieuAutre, nomClient, emailCommanditaire, typeDevis]);

  // Auto-set lieu
  useEffect(() => {
    if (formationDemandee.toLowerCase().includes("en ligne"))
      setLieu("En ligne en accédant à son compte sur supertilt.fr");
  }, [formationDemandee]);

  const handleDuplicateDevis = (item: DevisHistoryItem) => {
    const fd = item.details?.form_data;
    if (fd) {
      setNomClient(fd.nomClient || ""); setAdresseClient(fd.adresseClient || "");
      setCodePostalClient(fd.codePostalClient || ""); setVilleClient(fd.villeClient || "");
      setPays(fd.pays === "France" ? "france" : "autre");
      if (fd.pays && fd.pays !== "France") setPaysAutre(fd.pays);
      setEmailCommanditaire(fd.emailCommanditaire || "");
      if (fd.adresseCommanditaire) {
        const ac = fd.adresseCommanditaire;
        if (ac.startsWith("Mme ")) { setCiviliteCommanditaire("Mme"); setNomCommanditaire(ac.slice(4)); }
        else if (ac.startsWith("M. ")) { setCiviliteCommanditaire("M."); setNomCommanditaire(ac.slice(3)); }
        else { setNomCommanditaire(ac); }
      }
      setTypeDevis(fd.typeDevis || "formation"); setIsAdministration(fd.isAdministration ? "oui" : "non");
      setNoteDevis(fd.noteDevis || ""); setFormatFormation(fd.formatFormation || "inter");
      setFormationDemandee(fd.formationDemandee || ""); setFormationLibre(fd.formationLibre || "");
      setDateFormation(fd.dateFormation || ""); setDateFormationLibre(fd.dateFormationLibre || "");
      setParticipants(fd.participants || ""); setIncludeCadeau(fd.includeCadeau || false);
      setFraisDossier(fd.fraisDossier ? "oui" : "non"); setTypeSubrogation(fd.typeSubrogation || "les2");
      const lv = fd.lieu || "";
      if (LIEUX.includes(lv)) { setLieu(lv); setLieuAutre(fd.lieuAutre || ""); }
      else if (lv) { setLieu("autre"); setLieuAutre(fd.lieuAutre || lv); }
      else { setLieu(""); setLieuAutre(fd.lieuAutre || ""); }
    } else {
      setNomClient(item.details?.client_name || ""); setEmailCommanditaire(item.recipient_email || "");
      setTypeDevis("formation"); setFormatFormation("inter");
      setFormationDemandee(item.details?.formation_name || "");
      setTypeSubrogation((item.details?.type_subrogation as "sans" | "avec" | "les2") || "les2");
    }
    historyHook.setHistoryDialogOpen(false);
    toast({ title: "Devis dupliqué", description: "Le formulaire a été pré-rempli avec les données du devis sélectionné." });
  };

  const onSearchSiren = async () => {
    const r = await sirenSearch.handleSearchSiren();
    if (r) {
      if (r.nomClient) setNomClient(r.nomClient);
      if (r.adresseClient) setAdresseClient(r.adresseClient);
      if (r.codePostalClient) setCodePostalClient(r.codePostalClient);
      if (r.villeClient) setVilleClient(r.villeClient);
      if (r.pays) setPays(r.pays);
      if (r.paysAutre) setPaysAutre(r.paysAutre);
    }
  };

  const getSelectedFormationConfig = (): FormationConfig | undefined =>
    configsHook.formationConfigs.find(f => f.formation_name === formationDemandee);

  const countParticipants = (): number => {
    if (!participants.trim()) return 1;
    return Math.max(1, participants.split(/[,;\n]/).filter(l => l.trim()).length);
  };

  const buildPayload = () => {
    const sc = getSelectedFormationConfig();
    if (!sc) return null;
    const ep = formulasHook.activeFormula?.prix ?? sc.prix;
    const ed = formulasHook.activeFormula?.duree_heures ?? sc.duree_heures;
    const fl = lieu === "autre" ? lieuAutre : lieu === "Chez le client" ? [adresseClient, `${codePostalClient} ${villeClient}`.trim()].filter(p => p).join(", ") : lieu;
    const fp = pays === "autre" ? paysAutre : "France";
    const np = countParticipants();
    const pl = participants.split(/[,;\n]/).map(p => p.trim()).filter(p => p.length > 0);
    const ct = includeCadeau ? "Chaque participant(e) aura : 1 kit de facilitation graphique ainsi qu'un accès illimité et à vie au e-learning de 25h pour continuer sa formation en facilitation graphique" : "";
    const label = formulasHook.selectedFormula ? `${formationDemandee} — ${formulasHook.selectedFormula}` : formationDemandee;
    const adresseCommanditaire = `${civiliteCommanditaire} ${nomCommanditaire}`.trim();
    return {
      requestPayload: { nomClient, adresseClient, codePostalClient, villeClient, pays: fp, emailCommanditaire, adresseCommanditaire, isAdministration: isAdministration === "oui", noteDevis, formationDemandee: label, dateFormation, lieu: fl, includeCadeau, fraisDossier: fraisDossier === "oui", prix: ep, dureeHeures: ed, programmeUrl: sc.programme_url, nbParticipants: np, participants },
      pdfMonkeyPayload: { client: { name: nomClient, address: adresseClient, zip: codePostalClient, city: villeClient, country: fp }, note: noteDevis || "", affiche_frais: fraisDossier === "oui" ? "Oui" : "Non", subrogation: "Oui / Non (2 versions)", cadeau: ct, items: [{ name: label, participant_name: pl.length > 0 ? pl : [`${adresseCommanditaire} ${emailCommanditaire}`], date: dateFormation, place: fl, duration: `${ed}h`, quantity: np, unit_price: ep }], admin_fee: fraisDossier === "oui" ? 150 : 0, is_administration: isAdministration === "oui" },
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeDevis !== "formation") {
      toast({ title: "Fonctionnalité en développement", description: "La génération de devis pour les jeux sera bientôt disponible." });
      return;
    }
    const sc = getSelectedFormationConfig();
    if (!sc) { toast({ title: "Erreur", description: "Veuillez sélectionner une formation", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const finalLieu = lieu === "autre" ? lieuAutre : lieu;
      const finalPays = pays === "autre" ? paysAutre : "France";
      const normalizedEmail = emailCommanditaire.trim().toLowerCase();
      const af = formulasHook.formationFormulas.find(f => f.name === formulasHook.selectedFormula);
      const ep = af?.prix ?? sc.prix;
      const ed = af?.duree_heures ?? sc.duree_heures;
      const label = formulasHook.selectedFormula ? `${formationDemandee} — ${formulasHook.selectedFormula}` : formationDemandee;
      const response = await supabase.functions.invoke("generate-micro-devis", {
        body: { nomClient, adresseClient, codePostalClient, villeClient, pays: finalPays, emailCommanditaire: normalizedEmail, adresseCommanditaire: `${civiliteCommanditaire} ${nomCommanditaire}`.trim(), isAdministration: isAdministration === "oui", noteDevis, formationDemandee: label, dateFormation, lieu: finalLieu, includeCadeau, fraisDossier: fraisDossier === "oui", prix: ep, dureeHeures: ed, programmeUrl: sc.programme_url, nbParticipants: countParticipants(), participants, typeSubrogation, typeDevis, formatFormation, formationLibre, dateFormationLibre, lieuAutre, ...(crmCardId && { crmCardId, senderEmail: user?.email }) },
      });
      if (response.error) throw new Error(response.error.message);
      toast({ title: typeSubrogation === "les2" ? "Devis envoyés !" : "Devis envoyé !", description: typeSubrogation === "les2" ? `Les 2 devis ont été générés et envoyés à ${normalizedEmail}` : `Le devis a été généré et envoyé à ${normalizedEmail}` });
      if (searchParams.get("source") === "crm") { setTimeout(() => { window.close(); }, 1500); return; }
      setNomClient(""); setAdresseClient(""); setCodePostalClient(""); setVilleClient("");
      setPays("france"); setPaysAutre(""); setEmailCommanditaire(""); setAdresseCommanditaire("");
      setTypeDevis(""); setIsAdministration(""); setNoteDevis(""); setParticipants("");
      setFormationDemandee(configsHook.formationConfigs.find(f => f.is_default)?.formation_name || "");
      setDateFormation(""); setLieu(""); setLieuAutre(""); setIncludeCadeau(false); setFraisDossier("");
    } catch (error: unknown) {
      console.error("Error generating micro-devis:", error);
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>);
  }

  return (
    <ModuleLayout>
      <main className="max-w-4xl mx-auto p-6">
        <Card className="border-2 shadow-xl">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <FileText className="w-6 h-6 text-primary" />
                  Micro-devis
                </CardTitle>
                <CardDescription>Créez des devis rapides et simplifiés</CardDescription>
              </div>
              <DevisHistoryDialog
                historyDialogOpen={historyHook.historyDialogOpen}
                setHistoryDialogOpen={historyHook.setHistoryDialogOpen}
                historySearch={historyHook.historySearch}
                setHistorySearch={historyHook.setHistorySearch}
                loadingHistory={historyHook.loadingHistory}
                filteredHistory={historyHook.filteredHistory}
                onDuplicate={handleDuplicateDevis}
                onDelete={historyHook.handleDeleteDevis}
              />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              <ClientInfoSection
                siren={sirenSearch.siren} setSiren={sirenSearch.setSiren}
                searchingSiren={sirenSearch.searchingSiren} onSearchSiren={onSearchSiren}
                nomClient={nomClient} setNomClient={setNomClient}
                searchingSirenByName={sirenSearch.searchingSirenByName}
                onSearchSirenByName={() => sirenSearch.handleSearchSirenByName(nomClient)}
                adresseClient={adresseClient} setAdresseClient={setAdresseClient}
                codePostalClient={codePostalClient} setCodePostalClient={setCodePostalClient}
                villeClient={villeClient} setVilleClient={setVilleClient}
                pays={pays} setPays={setPays} paysAutre={paysAutre} setPaysAutre={setPaysAutre}
                emailCommanditaire={emailCommanditaire} setEmailCommanditaire={setEmailCommanditaire}
                adresseCommanditaire={adresseCommanditaire} setAdresseCommanditaire={setAdresseCommanditaire}
              />

              <TypeDevisSection
                typeDevis={typeDevis} setTypeDevis={setTypeDevis}
                isAdministration={isAdministration} setIsAdministration={setIsAdministration}
                noteDevis={noteDevis} setNoteDevis={setNoteDevis}
              />

              {typeDevis === "formation" && (
                <FormationFormSection
                  formatFormation={formatFormation} setFormatFormation={setFormatFormation}
                  participants={participants} setParticipants={setParticipants}
                  adresseCommanditaire={adresseCommanditaire} emailCommanditaire={emailCommanditaire}
                  countParticipants={countParticipants}
                  formationDemandee={formationDemandee} setFormationDemandee={setFormationDemandee}
                  formationConfigs={configsHook.formationConfigs} loadingConfigs={configsHook.loadingConfigs}
                  editingFormation={configsHook.editingFormation} setEditingFormation={configsHook.setEditingFormation}
                  configDialogOpen={configsHook.configDialogOpen} setConfigDialogOpen={configsHook.setConfigDialogOpen}
                  newFormation={configsHook.newFormation} setNewFormation={configsHook.setNewFormation}
                  onSaveConfig={configsHook.handleSaveFormationConfig} onAddConfig={configsHook.handleAddFormation}
                  onDeleteConfig={configsHook.handleDeleteFormation} onSetDefaultConfig={configsHook.handleSetDefault}
                  onMoveConfig={configsHook.handleMoveFormation}
                  formationFormulas={formulasHook.formationFormulas}
                  selectedFormulaId={formulasHook.selectedFormulaId} setSelectedFormulaId={formulasHook.setSelectedFormulaId}
                  dateFormation={dateFormation} setDateFormation={setDateFormation}
                  dateFormationLibre={dateFormationLibre} setDateFormationLibre={setDateFormationLibre}
                  formationDates={datesHook.formationDates} loadingDates={datesHook.loadingDates}
                  editingDate={datesHook.editingDate} setEditingDate={datesHook.setEditingDate}
                  datesDialogOpen={datesHook.datesDialogOpen} setDatesDialogOpen={datesHook.setDatesDialogOpen}
                  newDate={datesHook.newDate} setNewDate={datesHook.setNewDate}
                  onAddDate={datesHook.handleAddDate} onSetDefaultDate={datesHook.handleSetDefaultDate}
                  onDeleteDate={datesHook.handleDeleteDate} onSaveDate={datesHook.handleSaveDate}
                  lieu={lieu} setLieu={setLieu} lieuAutre={lieuAutre} setLieuAutre={setLieuAutre}
                  includeCadeau={includeCadeau} setIncludeCadeau={setIncludeCadeau}
                  fraisDossier={fraisDossier} setFraisDossier={setFraisDossier}
                  typeSubrogation={typeSubrogation} setTypeSubrogation={setTypeSubrogation}
                  getSelectedFormationConfig={getSelectedFormationConfig}
                />
              )}

              {typeDevis === "jeu" && (
                <div className="space-y-4 p-4 bg-secondary/50 rounded-lg border border-secondary">
                  <h3 className="text-lg font-semibold">Jeu</h3>
                  <p className="text-muted-foreground">Pour créer un devis pour un jeu, veuillez utiliser notre formulaire dédié :</p>
                  <Button asChild variant="outline" className="w-full">
                    <a href="https://docs.google.com/forms/d/e/1FAIpQLScoZ3qkcJDxbEQYysE2YSkTEV-bfmF6mkAumwQ20Hoqflp7_g/viewform" target="_blank" rel="noopener noreferrer">Accéder au formulaire de devis Jeu</a>
                  </Button>
                </div>
              )}

              <div className="flex gap-3">
                <Dialog open={jsonPreviewOpen} onOpenChange={setJsonPreviewOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" className="font-semibold py-6" disabled={!typeDevis || typeDevis !== "formation" || !formationDemandee}>
                      <Eye className="w-5 h-5 mr-2" />Prévisualiser JSON
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Prévisualisation du JSON PDF Monkey</DialogTitle>
                      <DialogDescription>Payload qui sera envoyé à PDF Monkey pour générer le devis</DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                      <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(buildPayload()?.pdfMonkeyPayload, null, 2)}
                      </pre>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button type="submit" className="flex-1 font-semibold text-lg py-6" disabled={submitting || !typeDevis}>
                  {submitting ? (<><Loader2 className="w-5 h-5 animate-spin mr-2" />Génération en cours...</>) : (<><Send className="w-5 h-5 mr-2" />Générer le micro-devis</>)}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </ModuleLayout>
  );
};

export default MicroDevis;
