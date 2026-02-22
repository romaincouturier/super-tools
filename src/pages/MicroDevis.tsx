import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, FileText, ArrowLeft, Send, Plus, Eye, Search } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star } from "lucide-react";
import { LIEUX } from "@/types/micro-devis";
import { DevisHistoryDialog } from "@/components/micro-devis/DevisHistoryDialog";
import { FormationConfigDialog } from "@/components/micro-devis/FormationConfigDialog";
import { FormationDatesDialog } from "@/components/micro-devis/FormationDatesDialog";
import { useMicroDevisForm } from "@/hooks/useMicroDevisForm";

const MicroDevis = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const {
    form, setField,
    formationConfigs, loadingConfigs, editingFormation, setEditingFormation,
    configDialogOpen, setConfigDialogOpen, newFormation, setNewFormation,
    formationDates, loadingDates, editingDate, setEditingDate,
    datesDialogOpen, setDatesDialogOpen, newDate, setNewDate,
    jsonPreviewOpen, setJsonPreviewOpen, submitting,
    siren, setSiren, searchingSiren,
    loadingHistory, historySearch, setHistorySearch,
    historyDialogOpen, setHistoryDialogOpen, filteredHistory,
    getSelectedFormationConfig, countParticipants,
    handleSearchSiren, handleDuplicateDevis, handleDeleteDevis,
    handleSaveFormationConfig, handleAddFormation, handleDeleteFormation,
    handleSetDefault, handleMoveFormation,
    handleAddDate, handleDeleteDate, handleSetDefaultDate, handleSaveDate,
    buildPayload, handleSubmit,
  } = useMicroDevisForm(user);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-4xl mx-auto p-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux outils
        </Button>

        <Card className="border-2 shadow-xl">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <FileText className="w-6 h-6 text-primary" />
                  Micro-devis
                </CardTitle>
                <CardDescription>
                  Créez des devis rapides et simplifiés
                </CardDescription>
              </div>
              <DevisHistoryDialog
                open={historyDialogOpen}
                onOpenChange={setHistoryDialogOpen}
                loading={loadingHistory}
                historySearch={historySearch}
                onSearchChange={setHistorySearch}
                filteredHistory={filteredHistory}
                onDuplicate={handleDuplicateDevis}
                onDelete={handleDeleteDevis}
              />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Section: Informations client */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Informations client</h3>

                {/* SIREN search */}
                <div className="flex gap-2 items-end p-3 bg-muted/50 rounded-lg border">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="siren" className="text-sm">
                      Rechercher par SIREN
                      <span className="text-muted-foreground font-normal ml-1">(9 chiffres)</span>
                    </Label>
                    <Input
                      id="siren"
                      placeholder="123456789"
                      value={siren}
                      onChange={(e) => setSiren(e.target.value.replace(/\D/g, "").slice(0, 9))}
                      className="font-mono"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSearchSiren}
                    disabled={searchingSiren || siren.length !== 9}
                  >
                    {searchingSiren ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span className="ml-2">Rechercher</span>
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nomClient">Nom du client *</Label>
                  <Input id="nomClient" placeholder="Nom de l'entreprise ou du client" value={form.nomClient} onChange={(e) => setField("nomClient", e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adresseClient">Adresse du client *</Label>
                  <Input id="adresseClient" placeholder="Numéro et nom de rue" value={form.adresseClient} onChange={(e) => setField("adresseClient", e.target.value)} required />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codePostalClient">Code postal *</Label>
                    <Input id="codePostalClient" placeholder="69000" value={form.codePostalClient} onChange={(e) => setField("codePostalClient", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="villeClient">Ville *</Label>
                    <Input id="villeClient" placeholder="Lyon" value={form.villeClient} onChange={(e) => setField("villeClient", e.target.value)} required />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Pays *</Label>
                    <RadioGroup value={form.pays} onValueChange={(v) => setField("pays", v)} className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="france" id="pays-france" />
                        <Label htmlFor="pays-france" className="font-normal cursor-pointer">France</Label>
                      </div>
                      <div className="flex items-center space-x-2 flex-1">
                        <RadioGroupItem value="autre" id="pays-autre" />
                        <Label htmlFor="pays-autre" className="font-normal cursor-pointer">Autre :</Label>
                        <Input
                          placeholder="Pays"
                          value={form.paysAutre}
                          onChange={(e) => {
                            setField("paysAutre", e.target.value);
                            if (e.target.value) setField("pays", "autre");
                          }}
                          className="flex-1"
                          disabled={form.pays !== "autre"}
                        />
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailCommanditaire">Email du commanditaire *</Label>
                    <Input id="emailCommanditaire" type="email" placeholder="email@exemple.com" value={form.emailCommanditaire} onChange={(e) => setField("emailCommanditaire", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adresseCommanditaire">
                      Comment s'adresser au commanditaire *
                      <span className="text-muted-foreground font-normal text-sm ml-1">(Ex : Mme Poilvert)</span>
                    </Label>
                    <Input id="adresseCommanditaire" placeholder="Mme Dupont" value={form.adresseCommanditaire} onChange={(e) => setField("adresseCommanditaire", e.target.value)} required />
                  </div>
                </div>
              </div>

              {/* Section: Type de devis */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Type de devis</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label>S'agit-il d'un devis pour</Label>
                    <RadioGroup value={form.typeDevis} onValueChange={(v) => setField("typeDevis", v as "formation" | "jeu")}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="formation" id="type-formation" />
                        <Label htmlFor="type-formation" className="font-normal cursor-pointer">Une formation</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="jeu" id="type-jeu" />
                        <Label htmlFor="type-jeu" className="font-normal cursor-pointer">Un jeu</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label>Le client est une administration *</Label>
                    <RadioGroup value={form.isAdministration} onValueChange={(v) => setField("isAdministration", v as "oui" | "non")} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="oui" id="admin-oui" />
                        <Label htmlFor="admin-oui" className="font-normal cursor-pointer">Oui</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="non" id="admin-non" />
                        <Label htmlFor="admin-non" className="font-normal cursor-pointer">Non</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="noteDevis">
                    Note à faire figurer impérativement sur le devis
                    <span className="text-muted-foreground font-normal text-sm ml-1">(facultatif)</span>
                  </Label>
                  <Textarea id="noteDevis" placeholder="Notes ou mentions spéciales à inclure dans le devis..." value={form.noteDevis} onChange={(e) => setField("noteDevis", e.target.value)} className="min-h-[80px]" />
                </div>
              </div>

              {/* Section: Formation (conditional) */}
              {form.typeDevis === "formation" && (
                <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <h3 className="text-lg font-semibold text-primary">Formation</h3>

                  <div className="space-y-3">
                    <Label>Type de formation *</Label>
                    <RadioGroup value={form.formatFormation} onValueChange={(v) => setField("formatFormation", v as "intra" | "inter")} className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="intra" id="format-intra" />
                        <Label htmlFor="format-intra" className="font-normal cursor-pointer">
                          Intra-entreprise
                          <span className="text-xs text-muted-foreground ml-1">(formation sur-mesure)</span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="inter" id="format-inter" />
                        <Label htmlFor="format-inter" className="font-normal cursor-pointer">
                          Inter-entreprises
                          <span className="text-xs text-muted-foreground ml-1">(catalogue)</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="participants">
                        Liste des participants
                        <span className="text-muted-foreground font-normal text-sm ml-1">(Prénom Nom e-mail ;,)</span>
                      </Label>
                      {form.adresseCommanditaire && form.emailCommanditaire && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            const commanditaireEntry = `${form.adresseCommanditaire} ${form.emailCommanditaire}`;
                            if (form.participants.trim()) {
                              if (!form.participants.includes(form.emailCommanditaire)) {
                                setField("participants", form.participants + "\n" + commanditaireEntry);
                              }
                            } else {
                              setField("participants", commanditaireEntry);
                            }
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Ajouter le commanditaire
                        </Button>
                      )}
                    </div>
                    <Textarea id="participants" placeholder="Jean Dupont jean@exemple.com, Marie Martin marie@exemple.com" value={form.participants} onChange={(e) => setField("participants", e.target.value)} className="min-h-[100px] font-mono text-sm" />
                    {form.participants && (
                      <p className="text-sm text-muted-foreground">
                        {countParticipants()} participant(s) détecté(s)
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Formation demandée *</Label>
                      <FormationConfigDialog
                        open={configDialogOpen}
                        onOpenChange={setConfigDialogOpen}
                        configs={formationConfigs}
                        loadingConfigs={loadingConfigs}
                        editingFormation={editingFormation}
                        onEditFormation={setEditingFormation}
                        newFormation={newFormation}
                        onNewFormation={setNewFormation}
                        onSave={handleSaveFormationConfig}
                        onAdd={handleAddFormation}
                        onDelete={handleDeleteFormation}
                        onSetDefault={handleSetDefault}
                        onMove={handleMoveFormation}
                      />
                    </div>

                    {form.formatFormation === "inter" && (
                      <Select value={form.formationDemandee} onValueChange={(v) => setField("formationDemandee", v)}>
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue placeholder="Sélectionner une formation" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          {formationConfigs.map((config) => (
                            <SelectItem key={config.id} value={config.formation_name}>
                              <div className="flex items-center gap-2">
                                {config.is_default && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                                <span>{config.formation_name}</span>
                                <span className="text-muted-foreground text-xs">
                                  ({config.prix}€ • {config.duree_heures}h)
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {form.formatFormation === "intra" && (
                      <Input placeholder="Nom de la formation souhaitée" value={form.formationLibre} onChange={(e) => setField("formationLibre", e.target.value)} required />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Dates de la formation *</Label>
                      {form.formatFormation === "inter" && (
                        <FormationDatesDialog
                          open={datesDialogOpen}
                          onOpenChange={setDatesDialogOpen}
                          dates={formationDates}
                          loadingDates={loadingDates}
                          editingDate={editingDate}
                          onEditDate={setEditingDate}
                          newDate={newDate}
                          onNewDate={setNewDate}
                          onAddDate={handleAddDate}
                          onDeleteDate={handleDeleteDate}
                          onSetDefault={handleSetDefaultDate}
                          onSaveDate={handleSaveDate}
                        />
                      )}
                    </div>

                    {form.formatFormation === "inter" && (
                      <>
                        {formationDates.length > 0 ? (
                          <Select value={form.dateFormation} onValueChange={(v) => setField("dateFormation", v)}>
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue placeholder="Sélectionner une date" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              {formationDates.map((dateConfig) => (
                                <SelectItem key={dateConfig.id} value={dateConfig.date_label}>
                                  <div className="flex items-center gap-2">
                                    {dateConfig.is_default && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                                    <span>{dateConfig.date_label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input id="dateFormation" placeholder="Ex: 15 et 16 janvier 2026, ou Du 10 au 14 mars 2026" value={form.dateFormation} onChange={(e) => setField("dateFormation", e.target.value)} required />
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formationDates.length > 0
                            ? "Sélectionnez une date ou gérez les dates disponibles"
                            : "Saisissez les dates au format souhaité (ex: \"26 et 27 janvier 2026\")"
                          }
                        </p>
                      </>
                    )}

                    {form.formatFormation === "intra" && (
                      <>
                        <Input id="dateFormationLibre" placeholder="Ex: 15 et 16 janvier 2026, ou Du 10 au 14 mars 2026, ou À définir" value={form.dateFormationLibre} onChange={(e) => setField("dateFormationLibre", e.target.value)} required />
                        <p className="text-xs text-muted-foreground">
                          Saisissez les dates souhaitées ou "À définir" si pas encore fixées
                        </p>
                      </>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label>Lieu *</Label>
                    <RadioGroup value={form.lieu} onValueChange={(v) => setField("lieu", v)} className="space-y-2">
                      {LIEUX.map((l) => (
                        <div key={l} className="flex items-center space-x-2">
                          <RadioGroupItem value={l} id={`lieu-${l}`} />
                          <Label htmlFor={`lieu-${l}`} className="font-normal cursor-pointer text-sm">{l}</Label>
                        </div>
                      ))}
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="autre" id="lieu-autre" />
                        <Label htmlFor="lieu-autre" className="font-normal cursor-pointer text-sm">Autre :</Label>
                        <Input
                          placeholder="Adresse personnalisée"
                          value={form.lieuAutre}
                          onChange={(e) => {
                            setField("lieuAutre", e.target.value);
                            if (e.target.value) setField("lieu", "autre");
                          }}
                          className="flex-1 max-w-md"
                          disabled={form.lieu !== "autre"}
                        />
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label>Cadeau <span className="text-muted-foreground font-normal text-sm">(ne pas cocher si non applicable)</span></Label>
                    <div className="flex items-start space-x-2">
                      <Checkbox id="cadeau" checked={form.includeCadeau} onCheckedChange={(checked) => setField("includeCadeau", checked === true)} />
                      <Label htmlFor="cadeau" className="font-normal cursor-pointer text-sm leading-relaxed">
                        Chaque participant(e) aura : 1 kit de facilitation graphique ainsi qu'un accès illimité et à vie au e-learning de 25h pour continuer sa formation à la facilitation graphique
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Afficher les frais de dossier dans le devis * <span className="text-muted-foreground font-normal text-sm">(Oui pour appliquer 150 euros de frais)</span></Label>
                    <RadioGroup value={form.fraisDossier} onValueChange={(v) => setField("fraisDossier", v as "oui" | "non")} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="oui" id="frais-oui" />
                        <Label htmlFor="frais-oui" className="font-normal cursor-pointer">Oui</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="non" id="frais-non" />
                        <Label htmlFor="frais-non" className="font-normal cursor-pointer">Non</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label>Type de devis à générer *</Label>
                    <RadioGroup value={form.typeSubrogation} onValueChange={(v) => setField("typeSubrogation", v as "sans" | "avec" | "les2")} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sans" id="subrogation-sans" />
                        <Label htmlFor="subrogation-sans" className="font-normal cursor-pointer">Devis sans subrogation de paiement</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="avec" id="subrogation-avec" />
                        <Label htmlFor="subrogation-avec" className="font-normal cursor-pointer">Devis avec subrogation de paiement (prise en charge OPCO)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="les2" id="subrogation-les2" />
                        <Label htmlFor="subrogation-les2" className="font-normal cursor-pointer">Les 2</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Summary */}
                  {form.formationDemandee && (
                    <div className="mt-4 p-3 bg-background rounded border" key={`summary-${form.formationDemandee}-${form.participants}-${form.fraisDossier}`}>
                      <h4 className="font-medium text-sm mb-2">Résumé du devis</h4>
                      {(() => {
                        const config = getSelectedFormationConfig();
                        if (!config) return null;
                        const nbParticipants = countParticipants();
                        const prixFormation = config.prix * nbParticipants;
                        const frais = form.fraisDossier === "oui" ? 150 : 0;
                        const totalHT = prixFormation + frais;
                        const tva = 0;
                        const totalTTC = totalHT + tva;

                        return (
                          <div className="text-sm space-y-1">
                            <p>Formation : {config.prix}€ × {nbParticipants} = <strong>{prixFormation}€</strong></p>
                            {frais > 0 && <p>Frais de dossier : {frais}€</p>}
                            <p>Total HT : <strong>{totalHT}€</strong></p>
                            <p>TVA (0%) : Exonéré</p>
                            <p className="text-base">Total TTC : <strong>{totalTTC.toFixed(2)}€</strong></p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Section: Jeu (conditional) */}
              {form.typeDevis === "jeu" && (
                <div className="space-y-4 p-4 bg-secondary/50 rounded-lg border border-secondary">
                  <h3 className="text-lg font-semibold">Jeu</h3>
                  <p className="text-muted-foreground">
                    Pour créer un devis pour un jeu, veuillez utiliser notre formulaire dédié :
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <a
                      href="https://docs.google.com/forms/d/e/1FAIpQLScoZ3qkcJDxbEQYysE2YSkTEV-bfmF6mkAumwQ20Hoqflp7_g/viewform"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Accéder au formulaire de devis Jeu
                    </a>
                  </Button>
                </div>
              )}

              <div className="flex gap-3">
                <Dialog open={jsonPreviewOpen} onOpenChange={setJsonPreviewOpen}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="font-semibold py-6"
                      disabled={!form.typeDevis || form.typeDevis !== "formation" || !form.formationDemandee}
                    >
                      <Eye className="w-5 h-5 mr-2" />
                      Prévisualiser JSON
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Prévisualisation du JSON PDF Monkey</DialogTitle>
                      <DialogDescription>
                        Payload qui sera envoyé à PDF Monkey pour générer le devis
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                      <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(buildPayload()?.pdfMonkeyPayload, null, 2)}
                      </pre>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  type="submit"
                  className="flex-1 font-semibold text-lg py-6"
                  disabled={submitting || !form.typeDevis}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Génération en cours...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Générer le micro-devis
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MicroDevis;
