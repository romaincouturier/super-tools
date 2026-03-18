import type { FormationFormSectionProps } from "@/components/formations/formationFormTypes";
import FormationTypeSelector from "@/components/formations/FormationTypeSelector";
import ParticipantInput from "@/components/formations/ParticipantInput";
import FormationConfigSection from "@/components/formations/FormationConfigSection";
import FormationDatesSection from "@/components/formations/FormationDatesSection";
import LocationSelector from "@/components/formations/LocationSelector";
import FormationOptions from "@/components/formations/FormationOptions";
import FormationSummary from "@/components/formations/FormationSummary";

export type { FormationFormSectionProps };

export default function FormationFormSection(props: FormationFormSectionProps) {
  const configEditorActions = {
    editingFormation: props.editingFormation,
    setEditingFormation: props.setEditingFormation,
    newFormation: props.newFormation,
    setNewFormation: props.setNewFormation,
    onSave: props.onSaveConfig,
    onAdd: props.onAddConfig,
    onDelete: props.onDeleteConfig,
    onSetDefault: props.onSetDefaultConfig,
    onMove: props.onMoveConfig,
  };

  const dateManagerActions = {
    editingDate: props.editingDate,
    setEditingDate: props.setEditingDate,
    newDate: props.newDate,
    setNewDate: props.setNewDate,
    onAdd: props.onAddDate,
    onSetDefault: props.onSetDefaultDate,
    onDelete: props.onDeleteDate,
    onSave: props.onSaveDate,
  };

  return (
    <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
      <h3 className="text-lg font-semibold text-primary">Formation</h3>
      <FormationTypeSelector
        formatFormation={props.formatFormation}
        setFormatFormation={props.setFormatFormation}
      />
      <ParticipantInput
        participants={props.participants}
        setParticipants={props.setParticipants}
        prenomCommanditaire={props.prenomCommanditaire}
        nomCommanditaire={props.nomCommanditaire}
        emailCommanditaire={props.emailCommanditaire}
        countParticipants={props.countParticipants}
      />
      <FormationConfigSection
        formationDemandee={props.formationDemandee}
        setFormationDemandee={props.setFormationDemandee}
        formationConfigs={props.formationConfigs}
        loadingConfigs={props.loadingConfigs}
        configDialogOpen={props.configDialogOpen}
        setConfigDialogOpen={props.setConfigDialogOpen}
        configEditorActions={configEditorActions}
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
        dateManagerActions={dateManagerActions}
      />
      <LocationSelector
        lieu={props.lieu}
        setLieu={props.setLieu}
        lieuAutre={props.lieuAutre}
        setLieuAutre={props.setLieuAutre}
      />
      <FormationOptions
        includeCadeau={props.includeCadeau}
        setIncludeCadeau={props.setIncludeCadeau}
        fraisDossier={props.fraisDossier}
        setFraisDossier={props.setFraisDossier}
        typeSubrogation={props.typeSubrogation}
        setTypeSubrogation={props.setTypeSubrogation}
      />
      <FormationSummary
        formationDemandee={props.formationDemandee}
        participants={props.participants}
        fraisDossier={props.fraisDossier}
        getSelectedFormationConfig={props.getSelectedFormationConfig}
        formationFormulas={props.formationFormulas}
        selectedFormulaId={props.selectedFormulaId}
        countParticipants={props.countParticipants}
      />
    </div>
  );
}
