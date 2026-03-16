import type { FormationConfig, FormationDate } from "@/types/formations";
import type { FormationFormula } from "@/types/training";

export interface ConfigEditorActions {
  editingFormation: FormationConfig | null;
  setEditingFormation: (f: FormationConfig | null) => void;
  newFormation: Partial<FormationConfig> | null;
  setNewFormation: (f: Partial<FormationConfig> | null) => void;
  onSave: () => Promise<void>;
  onAdd: () => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
  onMove: (index: number, direction: "up" | "down") => Promise<void>;
}

export interface DateManagerActions {
  editingDate: FormationDate | null;
  setEditingDate: (d: FormationDate | null) => void;
  newDate: Partial<FormationDate> | null;
  setNewDate: (d: Partial<FormationDate> | null) => void;
  onAdd: () => Promise<void>;
  onSetDefault: (d: FormationDate) => Promise<void>;
  onDelete: (d: FormationDate) => Promise<void>;
  onSave: () => Promise<void>;
}

export interface FormationFormSectionProps {
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
