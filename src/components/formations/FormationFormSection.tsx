import { Settings, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormationConfig, FormationDate } from "@/types/formations";
import type { FormationFormula } from "@/types/training";
import { LIEUX } from "@/lib/formationConstants";
import FormationConfigEditor from "@/components/formations/FormationConfigEditor";
import FormationDateManager from "@/components/formations/FormationDateManager";

interface FormationFormSectionProps {
  // Formation type
  formatFormation: "intra" | "inter" | "";
  setFormatFormation: (v: "intra" | "inter" | "") => void;

  // Participants
  participants: string;
  setParticipants: (v: string) => void;
  adresseCommanditaire: string;
  emailCommanditaire: string;
  countParticipants: () => number;

  // Formation selection
  formationDemandee: string;
  setFormationDemandee: (v: string) => void;

  // Config editor props
  formationConfigs: FormationConfig[];
  loadingConfigs: boolean;
  editingFormation: FormationConfig | null;
  setEditingFormation: (f: FormationConfig | null) => void;
  configDialogOpen: boolean;
  setConfigDialogOpen: (v: boolean) => void;
  newFormation: Partial<FormationConfig> | null;
  setNewFormation: (f: Partial<FormationConfig> | null) => void;
  onSaveConfig: () => Promise<void>;
  onAddConfig: () => Promise<void>;
  onDeleteConfig: (id: string, name: string) => Promise<void>;
  onSetDefaultConfig: (id: string) => Promise<void>;
  onMoveConfig: (index: number, direction: "up" | "down") => Promise<void>;

  // Formula
  formationFormulas: FormationFormula[];
  selectedFormulaId: string;
  setSelectedFormulaId: (v: string) => void;

  // Dates
  dateFormation: string;
  setDateFormation: (v: string) => void;
  dateFormationLibre: string;
  setDateFormationLibre: (v: string) => void;
  formationDates: FormationDate[];
  loadingDates: boolean;
  editingDate: FormationDate | null;
  setEditingDate: (d: FormationDate | null) => void;
  datesDialogOpen: boolean;
  setDatesDialogOpen: (v: boolean) => void;
  newDate: Partial<FormationDate> | null;
  setNewDate: (d: Partial<FormationDate> | null) => void;
  onAddDate: () => Promise<void>;
  onSetDefaultDate: (d: FormationDate) => Promise<void>;
  onDeleteDate: (d: FormationDate) => Promise<void>;
  onSaveDate: () => Promise<void>;

  // Lieu
  lieu: string;
  setLieu: (v: string) => void;
  lieuAutre: string;
  setLieuAutre: (v: string) => void;

  // Cadeau & frais
  includeCadeau: boolean;
  setIncludeCadeau: (v: boolean) => void;
  fraisDossier: "oui" | "non" | "";
  setFraisDossier: (v: "oui" | "non" | "") => void;

  // Subrogation
  typeSubrogation: "sans" | "avec" | "les2";
  setTypeSubrogation: (v: "sans" | "avec" | "les2") => void;

  // Summary helper
  getSelectedFormationConfig: () => FormationConfig | undefined;
}

export default function FormationFormSection({
  formatFormation,
  setFormatFormation,
  participants,
  setParticipants,
  adresseCommanditaire,
  emailCommanditaire,
  countParticipants,
  formationDemandee,
  setFormationDemandee,
  formationConfigs,
  loadingConfigs,
  editingFormation,
  setEditingFormation,
  configDialogOpen,
  setConfigDialogOpen,
  newFormation,
  setNewFormation,
  onSaveConfig,
  onAddConfig,
  onDeleteConfig,
  onSetDefaultConfig,
  onMoveConfig,
  formationFormulas,
  selectedFormulaId,
  setSelectedFormulaId,
  dateFormation,
  setDateFormation,
  dateFormationLibre,
  setDateFormationLibre,
  formationDates,
  loadingDates,
  editingDate,
  setEditingDate,
  datesDialogOpen,
  setDatesDialogOpen,
  newDate,
  setNewDate,
  onAddDate,
  onSetDefaultDate,
  onDeleteDate,
  onSaveDate,
  lieu,
  setLieu,
  lieuAutre,
  setLieuAutre,
  includeCadeau,
  setIncludeCadeau,
  fraisDossier,
  setFraisDossier,
  typeSubrogation,
  setTypeSubrogation,
  getSelectedFormationConfig,
}: FormationFormSectionProps) {
  return (
    <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
      <h3 className="text-lg font-semibold text-primary">Formation</h3>

      {/* Formation type: intra or inter */}
      <div className="space-y-3">
        <Label>Type de formation *</Label>
        <RadioGroup value={formatFormation} onValueChange={(v) => setFormatFormation(v as "intra" | "inter")} className="flex gap-6">
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
          {adresseCommanditaire && emailCommanditaire && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => {
                const commanditaireEntry = `${adresseCommanditaire} ${emailCommanditaire}`;
                if (participants.trim()) {
                  if (!participants.includes(emailCommanditaire)) {
                    setParticipants(participants + "\n" + commanditaireEntry);
                  }
                } else {
                  setParticipants(commanditaireEntry);
                }
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Ajouter le commanditaire
            </Button>
          )}
        </div>
        <Textarea
          id="participants"
          placeholder="Jean Dupont jean@exemple.com, Marie Martin marie@exemple.com"
          value={participants}
          onChange={(e) => setParticipants(e.target.value)}
          className="min-h-[100px] font-mono text-sm"
        />
        {participants && (
          <p className="text-sm text-muted-foreground">
            {countParticipants()} participant(s) détecté(s)
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Formation demandée *</Label>
          <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2">
                <Settings className="w-3 h-3 mr-1" />
                Gérer
              </Button>
            </DialogTrigger>
            <FormationConfigEditor
              formationConfigs={formationConfigs}
              loadingConfigs={loadingConfigs}
              editingFormation={editingFormation}
              setEditingFormation={setEditingFormation}
              newFormation={newFormation}
              setNewFormation={setNewFormation}
              onSave={onSaveConfig}
              onAdd={onAddConfig}
              onDelete={onDeleteConfig}
              onSetDefault={onSetDefaultConfig}
              onMove={onMoveConfig}
            />
          </Dialog>
        </div>

        {/* Select from catalog */}
        <Select value={formationDemandee} onValueChange={setFormationDemandee}>
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

        {/* Formula selector when formation has formulas */}
        {formationFormulas.length >= 2 && (
          <div className="mt-3">
            <Label className="text-sm">Formule</Label>
            <Select value={selectedFormulaId} onValueChange={setSelectedFormulaId}>
              <SelectTrigger className="w-full bg-background mt-1">
                <SelectValue placeholder="Sélectionner une formule" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {formationFormulas.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <div className="flex items-center gap-2">
                      <span>{f.name}</span>
                      {(f.prix != null || f.duree_heures != null) && (
                        <span className="text-muted-foreground text-xs">
                          ({f.prix != null ? `${f.prix}€` : ""}{f.prix != null && f.duree_heures != null ? " · " : ""}{f.duree_heures != null ? `${f.duree_heures}h` : ""})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Dates de la formation *</Label>
          {formatFormation === "inter" && (
          <Dialog open={datesDialogOpen} onOpenChange={setDatesDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2">
                <Settings className="w-3 h-3 mr-1" />
                Gérer
              </Button>
            </DialogTrigger>
            <FormationDateManager
              formationDates={formationDates}
              loadingDates={loadingDates}
              editingDate={editingDate}
              setEditingDate={setEditingDate}
              newDate={newDate}
              setNewDate={setNewDate}
              onAdd={onAddDate}
              onSetDefault={onSetDefaultDate}
              onDelete={onDeleteDate}
              onSave={onSaveDate}
            />
          </Dialog>
          )}
        </div>

        {/* Inter-entreprises: select from predefined dates */}
        {formatFormation === "inter" && (
          <>
            {formationDates.length > 0 ? (
              <Select value={dateFormation} onValueChange={setDateFormation}>
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
              <Input
                id="dateFormation"
                placeholder="Ex: 15 et 16 janvier 2026, ou Du 10 au 14 mars 2026"
                value={dateFormation}
                onChange={(e) => setDateFormation(e.target.value)}
                required
              />
            )}
            <p className="text-xs text-muted-foreground">
              {formationDates.length > 0
                ? "Sélectionnez une date ou gérez les dates disponibles"
                : "Saisissez les dates au format souhaité (ex: \"26 et 27 janvier 2026\")"
              }
            </p>
          </>
        )}

        {/* Intra-entreprise: free text input for dates */}
        {formatFormation === "intra" && (
          <>
            <Input
              id="dateFormationLibre"
              placeholder="Ex: 15 et 16 janvier 2026, ou Du 10 au 14 mars 2026, ou À définir"
              value={dateFormationLibre}
              onChange={(e) => setDateFormationLibre(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Saisissez les dates souhaitées ou "À définir" si pas encore fixées
            </p>
          </>
        )}
      </div>

      <div className="space-y-3">
        <Label>Lieu *</Label>
        <RadioGroup value={lieu} onValueChange={setLieu} className="space-y-2">
          {LIEUX.map((l) => (
            <div key={l} className="flex items-center space-x-2">
              <RadioGroupItem value={l} id={`lieu-${l}`} />
              <Label htmlFor={`lieu-${l}`} className="font-normal cursor-pointer text-sm">
                {l}
              </Label>
            </div>
          ))}
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="autre" id="lieu-autre" />
            <Label htmlFor="lieu-autre" className="font-normal cursor-pointer text-sm">Autre :</Label>
            <Input
              placeholder="Adresse personnalisée"
              value={lieuAutre}
              onChange={(e) => {
                setLieuAutre(e.target.value);
                if (e.target.value) setLieu("autre");
              }}
              className="flex-1 max-w-md"
              disabled={lieu !== "autre"}
            />
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-3">
        <Label>Cadeau <span className="text-muted-foreground font-normal text-sm">(ne pas cocher si non applicable)</span></Label>
        <div className="flex items-start space-x-2">
          <Checkbox
            id="cadeau"
            checked={includeCadeau}
            onCheckedChange={(checked) => setIncludeCadeau(checked === true)}
          />
          <Label htmlFor="cadeau" className="font-normal cursor-pointer text-sm leading-relaxed">
            Chaque participant(e) aura : 1 kit de facilitation graphique ainsi qu'un accès illimité et à vie au e-learning de 25h pour continuer sa formation à la facilitation graphique
          </Label>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Afficher les frais de dossier dans le devis * <span className="text-muted-foreground font-normal text-sm">(Oui pour appliquer 150 euros de frais)</span></Label>
        <RadioGroup value={fraisDossier} onValueChange={(v) => setFraisDossier(v as "oui" | "non")} className="flex gap-4">
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
        <RadioGroup value={typeSubrogation} onValueChange={(v) => setTypeSubrogation(v as "sans" | "avec" | "les2")} className="space-y-2">
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
      {formationDemandee && (
        <div className="mt-4 p-3 bg-background rounded border" key={`summary-${formationDemandee}-${participants}-${fraisDossier}`}>
          <h4 className="font-medium text-sm mb-2">Résumé du devis</h4>
          {(() => {
            const config = getSelectedFormationConfig();
            if (!config) return null;
            const activeFormula = formationFormulas.find(f => f.id === selectedFormulaId);
            const prixUnitaire = activeFormula?.prix ?? config.prix;
            const nbParticipants = countParticipants();
            const prixFormation = prixUnitaire * nbParticipants;
            const frais = fraisDossier === "oui" ? 150 : 0;
            const totalHT = prixFormation + frais;
            const tva = 0;
            const totalTTC = totalHT + tva;

            return (
              <div className="text-sm space-y-1">
                <p>Formation : {prixUnitaire}€ × {nbParticipants} = <strong>{prixFormation}€</strong></p>
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
  );
}
