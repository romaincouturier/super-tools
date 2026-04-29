import { useState, useEffect, useCallback, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Schedule, SESSION_PRESETS } from "@/components/formations/ScheduleEditor";
import { supabase } from "@/integrations/supabase/client";
import { FormationConfig } from "@/components/formations/TrainingNameCombobox";
import { FormationFormula } from "@/types/training";
import { ScheduledAction } from "@/components/formations/ScheduledActionsEditor";

export interface FormationFormState {
  // Core fields
  trainingName: string;
  selectedDates: Date[];
  calendarOpen: boolean;
  schedules: Schedule[];

  // E-learning
  elearningStartDate: Date | null;
  elearningEndDate: Date | null;
  elearningDuration: string;
  elearningAccessEmailContent: string;

  // Location
  locationType: string;
  locationCustom: string;

  // Client
  clientName: string;
  clientAddress: string;

  // Pricing / participants
  soldPriceHt: string;
  maxParticipants: string;

  // Session type/format
  sessionType: string;
  sessionFormat: string;

  // Program / catalog
  prerequisites: string[];
  objectives: string[];
  programFileUrl: string;
  supertiltLink: string;
  privateGroupUrl: string;
  catalogId: string | null;

  // Sponsor
  sponsorFirstName: string;
  sponsorLastName: string;
  sponsorEmail: string;
  sponsorFormalAddress: boolean;

  // Financeur
  financeurSameAsSponsor: boolean;
  financeurName: string;
  financeurUrl: string;

  // Permanent mode (Create only)
  isPermanent: boolean;

  // Catalog formulas
  catalogFormulas: FormationFormula[];
  selectedFormulaId: string | null;
  hasFormulas: boolean;

  // Scheduled actions (Create only)
  scheduledActions: ScheduledAction[];

  // Edit-specific
  trainerId: string | null;
  assignedTo: string | null;
  trainingNotes: string;
  specificInstructions: string;

  // Settings
  supertiltSiteUrl: string;
}

const PREDEFINED_LOCATIONS = [
  { value: "en_ligne", label: "En ligne en accédant à son compte sur supertilt.fr" },
  { value: "lyon", label: "Espace Gailleton, 2 Pl. Gailleton, 69002 Lyon" },
  { value: "paris", label: "Agile Tribu, 4ter Pass. de la Main d'Or, 75011 Paris" },
  { value: "chez_client", label: "Chez le client (adresse du client)" },
  { value: "autre", label: "Autre" },
];

export { PREDEFINED_LOCATIONS };

export function useFormationForm() {
  // Core fields
  const [trainingName, setTrainingName] = useState("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // E-learning
  const [elearningStartDate, setElearningStartDate] = useState<Date | null>(null);
  const [elearningEndDate, setElearningEndDate] = useState<Date | null>(null);
  const [elearningDuration, setElearningDuration] = useState("");
  const [elearningAccessEmailContent, setElearningAccessEmailContent] = useState("");

  // Location
  const [locationType, setLocationType] = useState("");
  const [locationCustom, setLocationCustom] = useState("");

  // Client
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");

  // Pricing / participants
  const [soldPriceHt, setSoldPriceHt] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");

  // Session type/format
  const [sessionType, setSessionType] = useState("");
  const [sessionFormat, setSessionFormat] = useState("");

  // Program / catalog
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [programFileUrl, setProgramFileUrl] = useState("");
  const [supertiltLink, setSupertiltLink] = useState("");
  const [privateGroupUrl, setPrivateGroupUrl] = useState("");
  const [catalogId, setCatalogId] = useState<string | null>(null);

  // Sponsor
  const [sponsorFirstName, setSponsorFirstName] = useState("");
  const [sponsorLastName, setSponsorLastName] = useState("");
  const [sponsorEmail, setSponsorEmail] = useState("");
  const [sponsorFormalAddress, setSponsorFormalAddress] = useState(false);

  // Financeur
  const [financeurSameAsSponsor, setFinanceurSameAsSponsor] = useState(true);
  const [financeurName, setFinanceurName] = useState("");
  const [financeurUrl, setFinanceurUrl] = useState("");

  // Permanent mode
  const [isPermanent, setIsPermanent] = useState(false);

  // Catalog formulas
  const [catalogFormulas, setCatalogFormulas] = useState<FormationFormula[]>([]);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(null);
  const [hasFormulas, setHasFormulas] = useState(false);

  // Scheduled actions
  const [scheduledActions, setScheduledActions] = useState<ScheduledAction[]>([]);

  // Edit-specific
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [trainingNotes, setTrainingNotes] = useState("");
  const [specificInstructions, setSpecificInstructions] = useState("");

  // Settings
  const [supertiltSiteUrl, setSupertiltSiteUrl] = useState("");

  // Track data loaded (for edit mode schedule regeneration guard)
  const [dataLoaded, setDataLoaded] = useState(false);

  // Derived helpers
  const isElearning = isPermanent || sessionFormat === "distanciel_asynchrone";
  const isInter = isPermanent || sessionType === "inter";

  const getLegacyFormatFormation = useCallback((): string | null => {
    if (!sessionType && !sessionFormat) return null;
    if (sessionFormat === "distanciel_asynchrone") return "e_learning";
    if (sessionFormat === "distanciel_synchrone") return "classe_virtuelle";
    if (sessionType === "inter") return "inter-entreprises";
    return "intra";
  }, [sessionType, sessionFormat]);

  const getFinalLocation = useCallback((): string => {
    if (locationType === "autre") return locationCustom;
    if (locationType === "chez_client") return clientAddress || "Chez le client";
    const predefined = PREDEFINED_LOCATIONS.find((l) => l.value === locationType);
    return predefined?.label || "";
  }, [locationType, locationCustom, clientAddress]);

  const formatSelectedDates = useCallback((): string => {
    if (selectedDates.length === 0) return "Sélectionner les jours";
    if (selectedDates.length === 1) {
      return format(selectedDates[0], "d MMMM yyyy", { locale: fr });
    }
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    return `${selectedDates.length} jours sélectionnés (${format(sorted[0], "d MMM", { locale: fr })} - ${format(sorted[sorted.length - 1], "d MMM", { locale: fr })})`;
  }, [selectedDates]);

  const getStartDate = useCallback((): Date | null => {
    if (isElearning) return elearningStartDate;
    if (selectedDates.length === 0) return null;
    return selectedDates.reduce((min, d) => (d < min ? d : min), selectedDates[0]);
  }, [isElearning, elearningStartDate, selectedDates]);

  const getEndDate = useCallback((): Date | null => {
    if (isElearning) return elearningEndDate;
    if (selectedDates.length <= 1) return null;
    return selectedDates.reduce((max, d) => (d > max ? d : max), selectedDates[0]);
  }, [isElearning, elearningEndDate, selectedDates]);

  const fetchSupertiltSiteUrl = useCallback(async () => {
    const { data: settingData } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "supertilt_site_url")
      .maybeSingle();
    if (settingData?.setting_value) {
      setSupertiltSiteUrl(settingData.setting_value);
    }
  }, []);

  // Apply catalog fields when a formation config is selected
  const applyCatalogFields = useCallback((formation: FormationConfig | null) => {
    if (formation) {
      setCatalogId(formation.id);
      if (formation.programme_url) setProgramFileUrl(formation.programme_url);
      if (formation.objectives?.length) setObjectives(formation.objectives);
      if (formation.prerequisites?.length) setPrerequisites(formation.prerequisites);
      if (formation.supertilt_link) setSupertiltLink(formation.supertilt_link);
      if (formation.elearning_duration) setElearningDuration(String(formation.elearning_duration));
      if (formation.elearning_access_email_content) setElearningAccessEmailContent(formation.elearning_access_email_content);
    } else {
      setCatalogId(null);
      setCatalogFormulas([]);
      setSelectedFormulaId(null);
      setHasFormulas(false);
    }
  }, []);

  // Generate schedules from selected dates
  const regenerateSchedules = useCallback(
    (dates: Date[], currentSchedules: Schedule[]) => {
      if (dates.length === 0) return [];

      const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());

      const newSchedules = sortedDates.map((day, index) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const existing = currentSchedules.find((s) => s.day_date === dateStr);
        if (existing) return existing;

        if (index > 0 && currentSchedules.length > 0) {
          const firstSchedule = currentSchedules[0];
          return {
            day_date: dateStr,
            start_time: firstSchedule.start_time,
            end_time: firstSchedule.end_time,
            session_type: firstSchedule.session_type,
          };
        }

        return {
          day_date: dateStr,
          start_time: SESSION_PRESETS.full.start,
          end_time: SESSION_PRESETS.full.end,
          session_type: "full" as const,
        };
      });

      const selectedDateStrs = sortedDates.map((d) => format(d, "yyyy-MM-dd"));
      return newSchedules.filter((s) => selectedDateStrs.includes(s.day_date));
    },
    []
  );

  // Build the insert/update payload for the trainings table
  const buildTrainingPayload = useCallback(
    (opts: { isCreate: boolean }) => {
      const startDate = getStartDate();
      const endDate = getEndDate();

      const base: Record<string, unknown> = {
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        training_name: trainingName,
        format_formation: isPermanent ? "e_learning" : getLegacyFormatFormation(),
        session_type: isPermanent ? "inter" : (sessionType || null),
        session_format: isPermanent ? "distanciel_asynchrone" : (sessionFormat || null),
        prerequisites,
        objectives,
        program_file_url: programFileUrl || null,
        supertilt_link: supertiltLink || null,
        private_group_url: privateGroupUrl || null,
        sponsor_formal_address: isInter ? true : sponsorFormalAddress,
        participants_formal_address: false,
        financeur_same_as_sponsor: isInter ? true : financeurSameAsSponsor,
        elearning_duration: isElearning && elearningDuration ? parseFloat(elearningDuration) : null,
        catalog_id: catalogId || null,
      };

      if (opts.isCreate) {
        // Create-specific: use locationType-based resolution, inter defaults
        base.location = isPermanent
          ? "En ligne en accédant à son compte sur supertilt.fr"
          : getFinalLocation();
        base.client_name = isInter ? "Inter-entreprises" : clientName;
        base.client_address = isInter ? null : (clientAddress || null);
        base.sold_price_ht = isPermanent
          ? null
          : soldPriceHt
            ? Math.round(parseFloat(soldPriceHt) * 100) / 100
            : null;
        base.max_participants = isPermanent ? 0 : (maxParticipants ? parseInt(maxParticipants, 10) : 0);
        base.evaluation_link = "";
        base.sponsor_first_name = isInter ? null : (sponsorFirstName || null);
        base.sponsor_last_name = isInter ? null : (sponsorLastName || null);
        base.sponsor_email = isInter ? null : (sponsorEmail || null);
        base.financeur_name = (isPermanent || financeurSameAsSponsor) ? null : (financeurName || null);
        base.financeur_url = (isPermanent || financeurSameAsSponsor) ? null : (financeurUrl || null);
        base.trainer_id = null;
      } else {
        // Edit-specific: uses location string directly
        base.client_name = clientName;
        base.client_address = clientAddress || null;
        base.sold_price_ht = soldPriceHt ? Math.round(parseFloat(soldPriceHt) * 100) / 100 : null;
        base.max_participants = maxParticipants ? parseInt(maxParticipants, 10) : 0;
        base.sponsor_first_name = sponsorFirstName || null;
        base.sponsor_last_name = sponsorLastName || null;
        base.sponsor_email = sponsorEmail || null;
        base.financeur_name = financeurSameAsSponsor ? null : (financeurName || null);
        base.financeur_url = financeurSameAsSponsor ? null : (financeurUrl || null);
        base.trainer_id = trainerId || null;
        base.assigned_to = assignedTo || null;
        base.notes = trainingNotes.trim() || null;
        base.specific_instructions = specificInstructions.trim() || null;
      }

      return base;
    },
    [
      trainingName, isPermanent, isElearning, isInter,
      sessionType, sessionFormat, prerequisites, objectives,
      programFileUrl, supertiltLink, privateGroupUrl,
      sponsorFormalAddress, financeurSameAsSponsor,
      elearningDuration, catalogId,
      clientName, clientAddress, soldPriceHt, maxParticipants,
      sponsorFirstName, sponsorLastName, sponsorEmail,
      financeurName, financeurUrl,
      locationType, locationCustom,
      trainerId, assignedTo, trainingNotes, specificInstructions,
      getStartDate, getEndDate, getLegacyFormatFormation, getFinalLocation,
    ]
  );

  return {
    // State
    trainingName, setTrainingName,
    selectedDates, setSelectedDates,
    calendarOpen, setCalendarOpen,
    schedules, setSchedules,
    elearningStartDate, setElearningStartDate,
    elearningEndDate, setElearningEndDate,
    elearningDuration, setElearningDuration,
    elearningAccessEmailContent, setElearningAccessEmailContent,
    locationType, setLocationType,
    locationCustom, setLocationCustom,
    clientName, setClientName,
    clientAddress, setClientAddress,
    soldPriceHt, setSoldPriceHt,
    maxParticipants, setMaxParticipants,
    sessionType, setSessionType,
    sessionFormat, setSessionFormat,
    prerequisites, setPrerequisites,
    objectives, setObjectives,
    programFileUrl, setProgramFileUrl,
    supertiltLink, setSupertiltLink,
    privateGroupUrl, setPrivateGroupUrl,
    catalogId, setCatalogId,
    sponsorFirstName, setSponsorFirstName,
    sponsorLastName, setSponsorLastName,
    sponsorEmail, setSponsorEmail,
    sponsorFormalAddress, setSponsorFormalAddress,
    financeurSameAsSponsor, setFinanceurSameAsSponsor,
    financeurName, setFinanceurName,
    financeurUrl, setFinanceurUrl,
    isPermanent, setIsPermanent,
    catalogFormulas, setCatalogFormulas,
    selectedFormulaId, setSelectedFormulaId,
    hasFormulas, setHasFormulas,
    scheduledActions, setScheduledActions,
    trainerId, setTrainerId,
    assignedTo, setAssignedTo,
    trainingNotes, setTrainingNotes,
    specificInstructions, setSpecificInstructions,
    supertiltSiteUrl,
    dataLoaded, setDataLoaded,

    // Derived
    isElearning,
    isInter,

    // Helpers
    getLegacyFormatFormation,
    getFinalLocation,
    formatSelectedDates,
    getStartDate,
    getEndDate,
    fetchSupertiltSiteUrl,
    applyCatalogFields,
    regenerateSchedules,
    buildTrainingPayload,
  };
}

export type FormationFormHook = ReturnType<typeof useFormationForm>;
