import type { FormationConfig, FormationDate } from "@/types/formations";
import type { FormationFormula } from "@/types/training";
import FormationTypeSelector from "@/components/formations/FormationTypeSelector";
import ParticipantInput from "@/components/formations/ParticipantInput";
import FormationConfigSection from "@/components/formations/FormationConfigSection";
import FormationDatesSection from "@/components/formations/FormationDatesSection";
import LocationSelector from "@/components/formations/LocationSelector";
import FormationOptions from "@/components/formations/FormationOptions";
import FormationSummary from "@/components/formations/FormationSummary";

interface FormationFormSectionProps {
  formatFormation: "intra" | "inter" | "";
  setFormatFormation: (v: "intra" | "inter" | "") => void;
  participants: string;
  setParticipants: (v: string) => void;
  adresseCommanditaire: string;
  emailCommanditaire: string;
  countParticipants: () => number;
  formationDemandee: string;
  setFormationDemandee: (v: string) => void;
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
  formationFormulas: FormationFormula[];
  selectedFormulaId: string;
  setSelectedFormulaId: (v: string) => void;
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
  lieu: string;
  setLieu: (v: string) => void;
  lieuAutre: string;
  setLieuAutre: (v: string) => void;
  includeCadeau: boolean;
  setIncludeCadeau: (v: boolean) => void;
  fraisDossier: "oui" | "non" | "";
  setFraisDossier: (v: "oui" | "non" | "") => void;
  typeSubrogation: "sans" | "avec" | "les2";
  setTypeSubrogation: (v: "sans" | "avec" | "les2") => void;
  getSelectedFormationConfig: () => FormationConfig | undefined;
}

export default function FormationFormSection(props: FormationFormSectionProps) {
  return (
    <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
      <h3 className="text-lg font-semibold text-primary">Formation</h3>
      <FormationTypeSelector formatFormation={props.formatFormation} setFormatFormation={props.setFormatFormation} />
      <ParticipantInput participants={props.participants} setParticipants={props.setParticipants} adresseCommanditaire={props.adresseCommanditaire} emailCommanditaire={props.emailCommanditaire} countParticipants={props.countParticipants} />
      <FormationConfigSection
        formationDemandee={props.formationDemandee}
        setFormationDemandee={props.setFormationDemandee}
        formationConfigs={props.formationConfigs}
        loadingConfigs={props.loadingConfigs}
        configDialogOpen={props.configDialogOpen}
        setConfigDialogOpen={props.setConfigDialogOpen}
        configEditorActions={{
          editingFormation: props.editingFormation,
          setEditingFormation: props.setEditingFormation,
          newFormation: props.newFormation,
          setNewFormation: props.setNewFormation,
          onSave: props.onSaveConfig,
          onAdd: props.onAddConfig,
          onDelete: props.onDeleteConfig,
          onSetDefault: props.onSetDefaultConfig,
          onMove: props.onMoveConfig,
        }}
        formationFormulas={props.formationFormulas}
        selectedFormulaId={props.selectedFormulaId}
        setSelectedFormulaId={props.setSelectedFormulaId}
      />
      <FormationDatesSection
        formatFormation={props.formatFormation}
        dateFormation={props.dateFormation}
        setDateFormation={props.setDateFormation}
        dateFormationLibre={props.dateFormationLibre}
        setDateFormationLibre={props.setDateFormationLibre}
        formationDates={props.formationDates}
        loadingDates={props.loadingDates}
        datesDialogOpen={props.datesDialogOpen}
        setDatesDialogOpen={props.setDatesDialogOpen}
        dateManagerActions={{
          editingDate: props.editingDate,
          setEditingDate: props.setEditingDate,
          newDate: props.newDate,
          setNewDate: props.setNewDate,
          onAdd: props.onAddDate,
          onSetDefault: props.onSetDefaultDate,
          onDelete: props.onDeleteDate,
          onSave: props.onSaveDate,
        }}
      />
      <LocationSelector lieu={props.lieu} setLieu={props.setLieu} lieuAutre={props.lieuAutre} setLieuAutre={props.setLieuAutre} />
      <FormationOptions includeCadeau={props.includeCadeau} setIncludeCadeau={props.setIncludeCadeau} fraisDossier={props.fraisDossier} setFraisDossier={props.setFraisDossier} typeSubrogation={props.typeSubrogation} setTypeSubrogation={props.setTypeSubrogation} />
      <FormationSummary formationDemandee={props.formationDemandee} participants={props.participants} fraisDossier={props.fraisDossier} getSelectedFormationConfig={props.getSelectedFormationConfig} formationFormulas={props.formationFormulas} selectedFormulaId={props.selectedFormulaId} countParticipants={props.countParticipants} />
    </div>
  );
}
