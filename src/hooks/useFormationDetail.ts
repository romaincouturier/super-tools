import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { sendThankYouEmail } from "@/services/emailSender";
import { User } from "@supabase/supabase-js";
import type { FormationFormula } from "@/types/training";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppSetting } from "@/hooks/useAppSetting";
import { useToast } from "@/hooks/use-toast";
import { ScheduledAction } from "@/components/formations/ScheduledActionsEditor";
import confetti from "canvas-confetti";

export interface Training {
  id: string;
  start_date: string;
  end_date: string | null;
  training_name: string;
  location: string;
  client_name: string;
  client_address: string | null;
  sold_price_ht: number | null;
  evaluation_link: string;
  program_file_url: string | null;
  prerequisites: string[];
  objectives: string[];
  format_formation: string | null;
  session_type?: string | null;
  session_format?: string | null;
  created_at: string;
  sponsor_first_name: string | null;
  sponsor_last_name: string | null;
  sponsor_email: string | null;
  sponsor_formal_address: boolean;
  participants_formal_address: boolean;
  invoice_file_url: string | null;
  attendance_sheets_urls: string[];
  supports_url: string | null;
  trainer_name: string;
  train_booked: boolean;
  hotel_booked: boolean;
  restaurant_booked: boolean;
  room_rental_booked: boolean;
  equipment_ready: boolean;
  convention_file_url?: string | null;
  signed_convention_urls?: string[];
  elearning_duration?: number | null;
  notes?: string | null;
  assigned_to?: string | null;
  max_participants?: number | null;
  is_cancelled?: boolean;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
}

export interface Schedule {
  id: string;
  day_date: string;
  start_time: string;
  end_time: string;
}

export interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  needs_survey_status: string;
  needs_survey_sent_at: string | null;
  added_at: string;
  sponsor_first_name?: string | null;
  sponsor_last_name?: string | null;
  sponsor_email?: string | null;
  invoice_file_url?: string | null;
  payment_mode?: string;
  sold_price_ht?: number | null;
  formula?: string | null;
  formula_id?: string | null;
}

export function useFormationDetail() {
  const isMobile = useIsMobile();
  const googleMapsApiKey = useAppSetting("google_maps_api_key", "AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8");
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState<Training | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [scheduledActions, setScheduledActions] = useState<ScheduledAction[]>([]);
  const [savingActions, setSavingActions] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [emailsRefreshTrigger, setEmailsRefreshTrigger] = useState(0);
  const [autoAddParticipantOpen, setAutoAddParticipantOpen] = useState(false);
  const [addParticipantData, setAddParticipantData] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    company?: string;
    soldPriceHt?: string;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesChanged, setNotesChanged] = useState(false);
  const [showThankYouPreview, setShowThankYouPreview] = useState(false);
  const [sendingThankYou, setSendingThankYou] = useState(false);
  const [thankYouSentAt, setThankYouSentAt] = useState<string | null>(null);
  const [assignedUserName, setAssignedUserName] = useState<string | null>(null);
  const [availableFormulas, setAvailableFormulas] = useState<FormationFormula[]>([]);
  const [catalogRequiredEquipment, setCatalogRequiredEquipment] = useState<string | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auto-open add participant dialog from URL params (CRM integration)
  useEffect(() => {
    const pFirstName = searchParams.get("addParticipantFirstName") || undefined;
    const pLastName = searchParams.get("addParticipantLastName") || undefined;
    const pEmail = searchParams.get("addParticipantEmail") || undefined;
    const pCompany = searchParams.get("addParticipantCompany") || undefined;
    const pSoldPriceHt = searchParams.get("addParticipantSoldPriceHt") || undefined;
    const hasParams = !!(pFirstName || pLastName || pEmail);

    if (hasParams && !loading && training) {
      setAddParticipantData({
        firstName: pFirstName,
        lastName: pLastName,
        email: pEmail,
        company: pCompany,
        soldPriceHt: pSoldPriceHt,
      });
      setAutoAddParticipantOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("addParticipantFirstName");
      newParams.delete("addParticipantLastName");
      newParams.delete("addParticipantEmail");
      newParams.delete("addParticipantCompany");
      newParams.delete("addParticipantSoldPriceHt");
      newParams.delete("fromCrmCardId");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, loading, training]);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await fetchTrainingData();
      if (!cancelled) setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        if (event === "SIGNED_OUT" || !session?.user) {
          navigate("/auth");
        } else if (event === "SIGNED_IN") {
          setUser(session.user);
        }
        // Ignore TOKEN_REFRESHED / other events to avoid unnecessary re-renders
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchTrainingData = async () => {
    if (!id) return;

    const { data: trainingData, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", id)
      .single();

    if (trainingError) {
      console.error("Error fetching training:", trainingError);
      navigate("/formations");
      return;
    }

    setTraining(trainingData);
    setNotes(trainingData.notes || "");
    setNotesChanged(false);

    if (trainingData.catalog_id) {
      const [{ data: formulasData }, { data: catalogData }] = await Promise.all([
        supabase
          .from("formation_formulas")
          .select("*")
          .eq("formation_config_id", trainingData.catalog_id)
          .order("display_order"),
        supabase
          .from("formation_configs")
          .select("required_equipment")
          .eq("id", trainingData.catalog_id)
          .maybeSingle(),
      ]);
      setAvailableFormulas((formulasData as FormationFormula[]) || []);
      setCatalogRequiredEquipment(catalogData?.required_equipment || null);
    } else {
      setAvailableFormulas([]);
      setCatalogRequiredEquipment(null);
    }

    if (trainingData.assigned_to) {
      const { data: assignedProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", trainingData.assigned_to)
        .maybeSingle();
      if (assignedProfile) {
        const name = [assignedProfile.first_name, assignedProfile.last_name].filter(Boolean).join(" ");
        setAssignedUserName(name || assignedProfile.email.split("@")[0]);
      }
    } else {
      setAssignedUserName(null);
    }

    const { data: schedulesData } = await supabase
      .from("training_schedules")
      .select("*")
      .eq("training_id", id)
      .order("day_date", { ascending: true });

    setSchedules(schedulesData || []);
    await fetchParticipants();
    await fetchScheduledActions();
  };

  const fetchScheduledActions = async () => {
    if (!id) return;
    const { data: actionsData } = await supabase
      .from("training_actions")
      .select("*")
      .eq("training_id", id)
      .order("due_date", { ascending: true });

    if (actionsData) {
      setScheduledActions(actionsData.map(action => ({
        id: action.id,
        description: action.description,
        dueDate: new Date(action.due_date),
        assignedEmail: action.assigned_user_email,
        assignedName: action.assigned_user_name || "",
        completed: action.status === "completed",
      })));
    }
  };

  // Fetch thank-you email sent date
  useEffect(() => {
    if (!id) return;
    const fetchThankYouSentDate = async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("created_at, details")
        .eq("action_type", "thank_you_email_sent")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) {
        const match = data.find((log: any) => {
          const details = log.details as { training_id?: string } | null;
          return details?.training_id === id;
        });
        if (match) setThankYouSentAt(match.created_at);
      }
    };
    fetchThankYouSentDate();
  }, [id]);

  const handleSendThankYouEmail = async () => {
    setSendingThankYou(true);
    try {
      const data = await sendThankYouEmail(id!);
      toast({
        title: "Email de remerciement envoyé",
        description: `Le mail a été envoyé à ${data.recipientCount} participant(s). Les emails post-formation ont été programmés automatiquement.`,
      });
      setThankYouSentAt(new Date().toISOString());
      setShowThankYouPreview(false);
      setEmailsRefreshTrigger((prev) => prev + 1);
    } catch (error: unknown) {
      console.error("Send error:", error);
      toast({
        title: "Erreur d'envoi",
        description: error instanceof Error ? error.message : "Impossible d'envoyer le mail de remerciement.",
        variant: "destructive",
      });
    } finally {
      setSendingThankYou(false);
    }
  };

  const handleSaveActions = async (actions: ScheduledAction[]) => {
    if (!id || !user) return;
    setSavingActions(true);
    try {
      const { data: existingActions } = await supabase
        .from("training_actions")
        .select("id")
        .eq("training_id", id);

      const existingIds = new Set((existingActions || []).map(a => a.id));
      const newIds = new Set(actions.map(a => a.id));

      const toDelete = [...existingIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        await supabase.from("training_actions").delete().in("id", toDelete);
      }

      for (const action of actions) {
        if (!action.description || !action.dueDate || !action.assignedEmail) continue;
        const isExistingAction = existingIds.has(action.id);

        if (isExistingAction) {
          await supabase
            .from("training_actions")
            .update({
              description: action.description,
              due_date: format(action.dueDate, 'yyyy-MM-dd'),
              assigned_user_email: action.assignedEmail,
              assigned_user_name: action.assignedName || null,
            })
            .eq("id", action.id);
        } else {
          await supabase
            .from("training_actions")
            .insert({
              training_id: id,
              description: action.description,
              due_date: format(action.dueDate, 'yyyy-MM-dd'),
              assigned_user_email: action.assignedEmail,
              assigned_user_name: action.assignedName || null,
              created_by: user.id,
            });
        }
      }

      toast({ title: "Actions enregistrées", description: "Les actions programmées ont été sauvegardées." });
      await fetchScheduledActions();
    } catch (error) {
      console.error("Error saving actions:", error);
      toast({ title: "Erreur", description: "Impossible de sauvegarder les actions.", variant: "destructive" });
    } finally {
      setSavingActions(false);
    }
  };

  const handleToggleActionComplete = async (actionId: string, completed: boolean) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from("training_actions")
        .update({
          status: completed ? "completed" : "pending",
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", actionId);

      if (error) throw error;
      setScheduledActions((prev) =>
        prev.map((a) => (a.id === actionId ? { ...a, completed } : a))
      );
    } catch (error) {
      console.error("Error toggling action:", error);
      toast({ title: "Erreur", description: "Impossible de mettre à jour l'action.", variant: "destructive" });
    }
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from("trainings")
        .update({ notes: notes.trim() || null })
        .eq("id", id);
      if (error) throw error;
      setNotesChanged(false);
      toast({ title: "Notes enregistrées" });
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({ title: "Erreur", description: "Impossible de sauvegarder les notes.", variant: "destructive" });
    } finally {
      setSavingNotes(false);
    }
  };

  const prevParticipantCountRef = useRef<number>(0);

  const celebrateFullSession = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    const colors = ["#ffd100", "#101820", "#f59e0b", "#10b981", "#3b82f6"];

    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };

    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors });
    requestAnimationFrame(frame);

    toast({ title: "🎉 Session complète !", description: "Le nombre maximum de participants est atteint." });
  };

  const notifySessionFull = async (trainingId: string) => {
    try {
      await supabase.functions.invoke("notify-session-full", {
        body: { trainingId },
      });
    } catch (error) {
      console.error("Error notifying session full:", error);
    }
  };

  const fetchParticipants = async () => {
    if (!id) return;
    const { data: participantsData } = await supabase
      .from("training_participants")
      .select("*")
      .eq("training_id", id)
      .order("added_at", { ascending: true });

    const newList = participantsData || [];
    const prevCount = prevParticipantCountRef.current;
    const newCount = newList.length;
    prevParticipantCountRef.current = newCount;

    if (
      training &&
      training.max_participants &&
      training.max_participants > 0 &&
      newCount >= training.max_participants &&
      prevCount < training.max_participants &&
      prevCount > 0
    ) {
      celebrateFullSession();
      // Notify communication manager for inter-enterprise sessions
      if (isInterSession) {
        notifySessionFull(id);
      }
    }

    setParticipants(newList);
  };

  const formatDateWithSchedule = (startDate: string | null, endDate: string | null, schedulesList: Schedule[]) => {
    if (schedulesList.length > 0) {
      const totalDays = schedulesList.length;
      const firstSchedule = schedulesList[0];
      const lastSchedule = schedulesList[schedulesList.length - 1];
      const firstDate = parseISO(firstSchedule.day_date);
      const lastDate = parseISO(lastSchedule.day_date);

      const allSameTimes = schedulesList.every(
        s => s.start_time === firstSchedule.start_time && s.end_time === firstSchedule.end_time
      );
      const timeInfo = allSameTimes
        ? ` • ${firstSchedule.start_time.slice(0, 5)} - ${firstSchedule.end_time.slice(0, 5)}`
        : " • horaires variables";

      if (totalDays === 1) {
        return format(firstDate, "EEEE d MMMM yyyy", { locale: fr }) + timeInfo;
      }

      const isContiguous = schedulesList.every((schedule, index) => {
        if (index === 0) return true;
        const prevDate = parseISO(schedulesList[index - 1].day_date);
        const currDate = parseISO(schedule.day_date);
        const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays === 1;
      });

      if (isContiguous) {
        return `Du ${format(firstDate, "EEEE d MMMM", { locale: fr })} au ${format(lastDate, "EEEE d MMMM yyyy", { locale: fr })}${timeInfo}`;
      }

      return `${totalDays} jours • ${format(firstDate, "d MMM", { locale: fr })} au ${format(lastDate, "d MMM yyyy", { locale: fr })}${timeInfo}`;
    }

    if (!startDate) return "Formation permanente – accès continu";

    const start = parseISO(startDate);
    if (!endDate) return format(start, "EEEE d MMMM yyyy", { locale: fr });
    const end = parseISO(endDate);
    return `Du ${format(start, "EEEE d MMMM", { locale: fr })} au ${format(end, "EEEE d MMMM yyyy", { locale: fr })}`;
  };

  const getFormatLabel = () => {
    if (!training) return null;
    const parts: string[] = [];
    if (training.session_type === "intra") parts.push("Intra");
    else if (training.session_type === "inter") parts.push("Inter");
    else if (training.format_formation === "intra") parts.push("Intra");
    else if (isInterSession) parts.push("Inter");
    if (training.session_format === "presentiel") parts.push("Présentiel");
    else if (training.session_format === "distanciel_synchrone") parts.push("Classe virtuelle");
    else if (training.session_format === "distanciel_asynchrone") parts.push("E-learning");
    else if (training.format_formation === "e_learning") parts.push("E-learning");
    else if (training.format_formation === "classe_virtuelle") parts.push("Classe virtuelle");
    return parts.length > 0 ? parts.join(" · ") : null;
  };

  const isElearningSession = training?.session_format === "distanciel_asynchrone" || training?.format_formation === "e_learning";
  const isPresentiel = training?.session_format === "presentiel";
  const isInterSession = training?.session_type === "inter" || training?.format_formation === "inter-entreprises" || training?.format_formation === "e_learning";

  const getSponsorName = () => {
    if (training?.sponsor_first_name && training?.sponsor_last_name) {
      return `${training.sponsor_first_name} ${training.sponsor_last_name}`;
    }
    if (training?.sponsor_first_name) return training.sponsor_first_name;
    if (training?.sponsor_last_name) return training.sponsor_last_name;
    return null;
  };

  const calculateTotalDuration = (): number => {
    if (schedules.length === 0) return 0;
    return schedules.reduce((total, schedule) => {
      const [startHours, startMinutes] = schedule.start_time.split(":").map(Number);
      const [endHours, endMinutes] = schedule.end_time.split(":").map(Number);
      const startInMinutes = startHours * 60 + startMinutes;
      const endInMinutes = endHours * 60 + endMinutes;
      const durationInHours = (endInMinutes - startInMinutes) / 60;
      return total + (durationInHours <= 4 ? 3.5 : 7);
    }, 0);
  };

  return {
    id,
    user,
    loading,
    training,
    setTraining,
    schedules,
    participants,
    scheduledActions,
    setScheduledActions,
    savingActions,
    mapDialogOpen,
    setMapDialogOpen,
    emailsRefreshTrigger,
    setEmailsRefreshTrigger,
    autoAddParticipantOpen,
    setAutoAddParticipantOpen,
    addParticipantData,
    setAddParticipantData,
    notes,
    setNotes,
    savingNotes,
    notesChanged,
    setNotesChanged,
    showThankYouPreview,
    setShowThankYouPreview,
    sendingThankYou,
    thankYouSentAt,
    assignedUserName,
    availableFormulas,
    catalogRequiredEquipment,
    duplicateDialogOpen,
    setDuplicateDialogOpen,
    navigate,
    toast,
    isMobile,
    googleMapsApiKey,
    // Derived
    isElearningSession,
    isPresentiel,
    isInterSession,
    // Functions
    fetchTrainingData,
    fetchParticipants,
    handleSendThankYouEmail,
    handleSaveActions,
    handleToggleActionComplete,
    handleSaveNotes,
    formatDateWithSchedule,
    getFormatLabel,
    getSponsorName,
    calculateTotalDuration,
  };
}
