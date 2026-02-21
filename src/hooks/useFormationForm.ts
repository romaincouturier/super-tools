import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { SESSION_PRESETS, type Schedule } from "@/components/formations/ScheduleEditor";
import type { FormationConfig } from "@/components/formations/TrainingNameCombobox";
import { PREDEFINED_LOCATIONS } from "@/lib/constants";

export interface FormationFormState {
  selectedDates: Date[];
  calendarOpen: boolean;
  trainingName: string;
  elearningStartDate: Date | null;
  elearningEndDate: Date | null;
  elearningDuration: string;
  elearningAccessEmailContent: string;
  locationType: string;
  locationCustom: string;
  location: string; // for edit mode (direct string)
  clientName: string;
  clientAddress: string;
  soldPriceHt: string;
  maxParticipants: string;
  formatFormation: string;
  prerequisites: string[];
  objectives: string[];
  programFileUrl: string;
  supertiltLink: string;
  schedules: Schedule[];
  sponsorFirstName: string;
  sponsorLastName: string;
  sponsorEmail: string;
  sponsorFormalAddress: boolean;
  trainerId: string | null;
  assignedTo: string | null;
  financeurSameAsSponsor: boolean;
  financeurName: string;
  financeurUrl: string;
  catalogId: string | null;
  trainingNotes: string;
  supertiltSiteUrl: string;
}

export interface FormationFormData extends FormationFormState {
  finalLocation: string;
  startDate: Date | null;
  endDate: Date | null;
}

interface UseFormationFormOptions {
  mode: "create" | "edit";
  /** Prevents schedule regeneration until data is loaded (edit mode) */
  dataLoaded?: boolean;
}

export function useFormationForm({ mode, dataLoaded = true }: UseFormationFormOptions) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [trainingName, setTrainingName] = useState("");
  const [elearningStartDate, setElearningStartDate] = useState<Date | null>(null);
  const [elearningEndDate, setElearningEndDate] = useState<Date | null>(null);
  const [elearningDuration, setElearningDuration] = useState("");
  const [elearningAccessEmailContent, setElearningAccessEmailContent] = useState("");
  const [locationType, setLocationType] = useState("");
  const [locationCustom, setLocationCustom] = useState("");
  const [location, setLocation] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [soldPriceHt, setSoldPriceHt] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [formatFormation, setFormatFormation] = useState("");
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [programFileUrl, setProgramFileUrl] = useState("");
  const [supertiltLink, setSupertiltLink] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [sponsorFirstName, setSponsorFirstName] = useState("");
  const [sponsorLastName, setSponsorLastName] = useState("");
  const [sponsorEmail, setSponsorEmail] = useState("");
  const [sponsorFormalAddress, setSponsorFormalAddress] = useState(true);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [financeurSameAsSponsor, setFinanceurSameAsSponsor] = useState(true);
  const [financeurName, setFinanceurName] = useState("");
  const [financeurUrl, setFinanceurUrl] = useState("");
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [trainingNotes, setTrainingNotes] = useState("");
  const [supertiltSiteUrl, setSupertiltSiteUrl] = useState("");

  // Generate schedules when selected dates change
  useEffect(() => {
    if (mode === "edit" && !dataLoaded) return;
    if (selectedDates.length === 0) {
      if (mode === "create") setSchedules([]);
      return;
    }

    const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    const newSchedules = sortedDates.map((day, index) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const existing = schedules.find((s) => s.day_date === dateStr);
      if (existing) return existing;

      if (index > 0 && schedules.length > 0) {
        const firstSchedule = schedules[0];
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
    setSchedules(newSchedules.filter((s) => selectedDateStrs.includes(s.day_date)));
  }, [selectedDates, dataLoaded, mode]);

  // Fetch SuperTilt site URL
  const fetchSupertiltSiteUrl = useCallback(async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "supertilt_site_url")
      .maybeSingle();
    if (data?.setting_value) setSupertiltSiteUrl(data.setting_value);
  }, []);

  // Get the final location string
  const getFinalLocation = useCallback((): string => {
    if (mode === "edit") return location;
    if (locationType === "autre") return locationCustom;
    if (locationType === "chez_client") return clientAddress || "Chez le client";
    const predefined = PREDEFINED_LOCATIONS.find((l) => l.value === locationType);
    return predefined?.label || "";
  }, [mode, location, locationType, locationCustom, clientAddress]);

  // Date helpers
  const formatSelectedDates = useCallback((): string => {
    if (selectedDates.length === 0) return "Sélectionner les jours";
    if (selectedDates.length === 1) {
      return format(selectedDates[0], "d MMMM yyyy", { locale: fr });
    }
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    return `${selectedDates.length} jours sélectionnés (${format(sorted[0], "d MMM", { locale: fr })} - ${format(sorted[sorted.length - 1], "d MMM", { locale: fr })})`;
  }, [selectedDates]);

  const getStartDate = useCallback((): Date | null => {
    if (formatFormation === "e_learning") return elearningStartDate;
    if (selectedDates.length === 0) return null;
    return selectedDates.reduce((min, d) => (d < min ? d : min), selectedDates[0]);
  }, [formatFormation, elearningStartDate, selectedDates]);

  const getEndDate = useCallback((): Date | null => {
    if (formatFormation === "e_learning") return elearningEndDate;
    if (selectedDates.length <= 1) return null;
    return selectedDates.reduce((max, d) => (d > max ? d : max), selectedDates[0]);
  }, [formatFormation, elearningEndDate, selectedDates]);

  // Handle formation catalog selection
  const handleFormationSelect = useCallback(
    (formation: FormationConfig | null) => {
      if (formation) {
        setCatalogId(formation.id);
        if (formation.programme_url) setProgramFileUrl(formation.programme_url);
        if (formation.objectives?.length && (mode === "edit" || objectives.length === 0)) {
          setObjectives(formation.objectives);
        }
        if (formation.prerequisites?.length && (mode === "edit" || prerequisites.length === 0)) {
          setPrerequisites(formation.prerequisites);
        }
        if (formation.supertilt_link) setSupertiltLink(formation.supertilt_link);
        if (formation.elearning_duration) setElearningDuration(String(formation.elearning_duration));
        if (formation.elearning_access_email_content) {
          setElearningAccessEmailContent(formation.elearning_access_email_content);
        }
      } else {
        setCatalogId(null);
      }
    },
    [mode, objectives.length, prerequisites.length]
  );

  // Handle format change (auto-set location for e-learning)
  const handleFormatChange = useCallback(
    async (val: string) => {
      setFormatFormation(val);
      if (val === "e_learning" && locationType !== "en_ligne") {
        setLocationType("en_ligne");
      }
      if (val === "e_learning" && !elearningAccessEmailContent) {
        const templateType = sponsorFormalAddress ? "elearning_access_vous" : "elearning_access_tu";
        const { data: template } = await supabase
          .from("email_templates")
          .select("html_content")
          .eq("template_type", templateType)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (template?.html_content) {
          setElearningAccessEmailContent(template.html_content);
        }
      }
    },
    [locationType, elearningAccessEmailContent, sponsorFormalAddress]
  );

  // Build form data object
  const getFormData = useCallback((): FormationFormData => {
    return {
      selectedDates,
      calendarOpen,
      trainingName,
      elearningStartDate,
      elearningEndDate,
      elearningDuration,
      elearningAccessEmailContent,
      locationType,
      locationCustom,
      location,
      clientName,
      clientAddress,
      soldPriceHt,
      maxParticipants,
      formatFormation,
      prerequisites,
      objectives,
      programFileUrl,
      supertiltLink,
      schedules,
      sponsorFirstName,
      sponsorLastName,
      sponsorEmail,
      sponsorFormalAddress,
      trainerId,
      assignedTo,
      financeurSameAsSponsor,
      financeurName,
      financeurUrl,
      catalogId,
      trainingNotes,
      supertiltSiteUrl,
      finalLocation: getFinalLocation(),
      startDate: getStartDate(),
      endDate: getEndDate(),
    };
  }, [
    selectedDates, calendarOpen, trainingName, elearningStartDate, elearningEndDate,
    elearningDuration, elearningAccessEmailContent, locationType, locationCustom,
    location, clientName, clientAddress, soldPriceHt, maxParticipants, formatFormation,
    prerequisites, objectives, programFileUrl, supertiltLink, schedules,
    sponsorFirstName, sponsorLastName, sponsorEmail, sponsorFormalAddress,
    trainerId, assignedTo, financeurSameAsSponsor, financeurName, financeurUrl,
    catalogId, trainingNotes, supertiltSiteUrl, getFinalLocation, getStartDate, getEndDate,
  ]);

  // Populate form from existing training data (edit mode)
  const populateFromTraining = useCallback(
    async (training: Record<string, unknown>) => {
      setTrainingName(training.training_name as string);
      setLocation(training.location as string);
      setClientName(training.client_name as string);
      setClientAddress((training.client_address as string) || "");
      setSoldPriceHt(training.sold_price_ht != null ? String(training.sold_price_ht) : "");
      setMaxParticipants(training.max_participants != null ? String(training.max_participants) : "");
      setFormatFormation((training.format_formation as string) || "");
      setPrerequisites((training.prerequisites as string[]) || []);
      setObjectives((training.objectives as string[]) || []);
      setProgramFileUrl((training.program_file_url as string) || "");
      setSupertiltLink((training.supertilt_link as string) || "");
      setSponsorFirstName((training.sponsor_first_name as string) || "");
      setSponsorLastName((training.sponsor_last_name as string) || "");
      setSponsorEmail((training.sponsor_email as string) || "");
      setSponsorFormalAddress((training.sponsor_formal_address as boolean) ?? true);
      setTrainerId((training.trainer_id as string) || null);
      setAssignedTo((training.assigned_to as string) || null);
      setFinanceurSameAsSponsor((training.financeur_same_as_sponsor as boolean) ?? true);
      setFinanceurName((training.financeur_name as string) || "");
      setFinanceurUrl((training.financeur_url as string) || "");
      setTrainingNotes((training.notes as string) || "");
      setCatalogId((training.catalog_id as string) || null);

      if (training.format_formation === "e_learning") {
        setElearningStartDate(parseISO(training.start_date as string));
        if (training.end_date) setElearningEndDate(parseISO(training.end_date as string));
        setElearningDuration(training.elearning_duration != null ? String(training.elearning_duration) : "");
        setElearningAccessEmailContent((training.elearning_access_email_content as string) || "");
        setSchedules([]);
        setSelectedDates([]);
      }
    },
    []
  );

  return {
    // State
    selectedDates, setSelectedDates,
    calendarOpen, setCalendarOpen,
    trainingName, setTrainingName,
    elearningStartDate, setElearningStartDate,
    elearningEndDate, setElearningEndDate,
    elearningDuration, setElearningDuration,
    elearningAccessEmailContent, setElearningAccessEmailContent,
    locationType, setLocationType,
    locationCustom, setLocationCustom,
    location, setLocation,
    clientName, setClientName,
    clientAddress, setClientAddress,
    soldPriceHt, setSoldPriceHt,
    maxParticipants, setMaxParticipants,
    formatFormation, setFormatFormation,
    prerequisites, setPrerequisites,
    objectives, setObjectives,
    programFileUrl, setProgramFileUrl,
    supertiltLink, setSupertiltLink,
    schedules, setSchedules,
    sponsorFirstName, setSponsorFirstName,
    sponsorLastName, setSponsorLastName,
    sponsorEmail, setSponsorEmail,
    sponsorFormalAddress, setSponsorFormalAddress,
    trainerId, setTrainerId,
    assignedTo, setAssignedTo,
    financeurSameAsSponsor, setFinanceurSameAsSponsor,
    financeurName, setFinanceurName,
    financeurUrl, setFinanceurUrl,
    catalogId, setCatalogId,
    trainingNotes, setTrainingNotes,
    supertiltSiteUrl,
    // Derived
    getFinalLocation,
    formatSelectedDates,
    getStartDate,
    getEndDate,
    getFormData,
    // Actions
    fetchSupertiltSiteUrl,
    handleFormationSelect,
    handleFormatChange,
    populateFromTraining,
  };
}
