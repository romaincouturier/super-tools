import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Clock, CheckCircle, AlertCircle, Calendar, ChevronDown, Users, User, Zap, Ghost } from "lucide-react";
import { format, parseISO, addDays, isAfter, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Types ──────────────────────────────────────────────────────────────────
interface TimelineEmail {
  id: string;
  emailType: string;
  label: string;
  scheduledDate: Date;
  recipientLabel: string;
  recipientType: "participant" | "trainer" | "sponsor" | "all" | "formateur";
  phase: "inscription" | "avant" | "pendant" | "fin" | "coaching" | "inter";
  /** "db" = from scheduled_emails table, "predicted" = computed from rules */
  source: "db" | "predicted";
  status: "sent" | "pending" | "predicted" | "error" | "missing";
  participantId?: string | null;
  dbId?: string;
  /** Only for predicted: why it may not happen */
  condition?: string;
}

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface Schedule {
  day_date: string;
  start_time: string;
  end_time: string;
}

interface EmailTimelineProps {
  trainingId: string;
  participants: Participant[];
  refreshTrigger?: number;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  sessionType: string | null;
  sessionFormat: string | null;
  formatFormation: string | null;
  trainerName: string;
  sponsorName: string | null;
  sponsorEmail: string | null;
  thankYouSentAt: string | null;
  schedules: Schedule[];
  hasCoaching: boolean;
  isElearning: boolean;
}

// ─── Labels ─────────────────────────────────────────────────────────────────
const EMAIL_TYPE_LABELS: Record<string, string> = {
  welcome: "Mail d'accueil",
  needs_survey: "Recueil des besoins",
  needs_survey_reminder: "Relance recueil des besoins",
  reminder: "Rappel logistique",
  trainer_summary: "Synthèse formateur",
  participant_list_reminder: "Rappel liste participants",
  thank_you: "Remerciement",
  google_review: "Avis Google",
  video_testimonial: "Témoignage vidéo",
  cold_evaluation: "Évaluation à froid",
  funder_reminder: "Rappel financeur",
  evaluation_reminder_1: "Relance évaluation (1ère)",
  evaluation_reminder_2: "Relance évaluation (2ème)",
  follow_up_news: "Prise de nouvelles IA",
  live_reminder: "Rappel live / visio",
  coaching_first_invite: "Invitation coaching",
  coaching_periodic_reminder: "Rappel coaching périodique",
  coaching_final_reminder: "Rappel coaching final",
  booking_reminder: "Rappel réservation coaching",
  next_inter_session_reminder: "Programmer prochaine session inter",
  elearning_access: "Accès e-learning",
  certificate: "Envoi certificat",
  attendance: "Émargement",
  trainer_notification: "Notification formateur",
};

const PHASE_LABELS: Record<string, { label: string; icon: string; order: number }> = {
  inscription: { label: "Inscription", icon: "📝", order: 0 },
  avant: { label: "Avant la formation", icon: "📅", order: 1 },
  pendant: { label: "Pendant la formation", icon: "🎯", order: 2 },
  fin: { label: "Après la formation", icon: "🎉", order: 3 },
  coaching: { label: "Coaching", icon: "🧠", order: 4 },
  inter: { label: "Inter-entreprise", icon: "🏢", order: 5 },
};

const RECIPIENT_ICONS: Record<string, typeof User> = {
  participant: User,
  all: Users,
  trainer: Zap,
  formateur: Zap,
  sponsor: User,
};

// ─── Component ──────────────────────────────────────────────────────────────
const EmailTimelineComputed = ({
  trainingId,
  participants,
  refreshTrigger,
  trainingStartDate,
  trainingEndDate,
  sessionType,
  sessionFormat: _sessionFormat,
  formatFormation,
  trainerName,
  sponsorName,
  sponsorEmail,
  thankYouSentAt,
  schedules,
  hasCoaching,
  isElearning,
}: EmailTimelineProps) => {
  const [dbEmails, setDbEmails] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [delaySettings, setDelaySettings] = useState({
    logistic: 3,
    trainerSummary: 1,
    googleReview: 7,
    videoTestimonial: 14,
    coldEvaluation: 30,
    coldEvaluationFunder: 45,
    evalReminder1: 2,
    evalReminder2: 5,
    followUpNews: 30,
    needsSurvey: 7,
  });
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(["inscription", "avant", "fin"]));
  const [liveMeetings, setLiveMeetings] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    fetchData();
  }, [trainingId]);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchDbEmails();
    }
  }, [refreshTrigger]);

  const fetchData = async () => {
    const emailsRes = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("training_id", trainingId)
      .order("scheduled_for", { ascending: true });

    const settingsRes = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "delay_logistic_reminder_days",
        "delay_trainer_summary_days",
        "delay_google_review_days",
        "delay_video_testimonial_days",
        "delay_cold_evaluation_days",
        "delay_cold_evaluation_funder_days",
        "delay_evaluation_reminder_1_days",
        "delay_evaluation_reminder_2_days",
        "delay_follow_up_news_days",
        "delay_needs_survey_days",
      ]);

    const livesRes = await supabase
      .from("training_live_meetings")
      .select("*")
      .eq("training_id", trainingId)
      .order("live_date", { ascending: true });

    if (emailsRes.data) setDbEmails(emailsRes.data);
    if (livesRes.data) setLiveMeetings(livesRes.data);

    if (settingsRes.data) {
      const s = { ...delaySettings };
      settingsRes.data.forEach((row) => {
        const v = parseInt(row.setting_value || "0", 10);
        if (row.setting_key === "delay_logistic_reminder_days") s.logistic = v || 3;
        if (row.setting_key === "delay_trainer_summary_days") s.trainerSummary = v || 1;
        if (row.setting_key === "delay_google_review_days") s.googleReview = v || 7;
        if (row.setting_key === "delay_video_testimonial_days") s.videoTestimonial = v || 14;
        if (row.setting_key === "delay_cold_evaluation_days") s.coldEvaluation = v || 30;
        if (row.setting_key === "delay_cold_evaluation_funder_days") s.coldEvaluationFunder = v || 45;
        if (row.setting_key === "delay_evaluation_reminder_1_days") s.evalReminder1 = v || 2;
        if (row.setting_key === "delay_evaluation_reminder_2_days") s.evalReminder2 = v || 5;
        if (row.setting_key === "delay_follow_up_news_days") s.followUpNews = v || 30;
        if (row.setting_key === "delay_needs_survey_days") s.needsSurvey = v || 7;
      });
      setDelaySettings(s);
    }

    setLoading(false);
  };

  const fetchDbEmails = async () => {
    const { data } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("training_id", trainingId)
      .order("scheduled_for", { ascending: true });
    if (data) setDbEmails(data);
  };

  const isInterSession = sessionType === "inter" || formatFormation === "inter-entreprises" || formatFormation === "e_learning";

  // ─── Build the complete timeline ─────────────────────────────────────
  const timeline = useMemo(() => {
    const items: TimelineEmail[] = [];
    const now = new Date();

    // Convert DB emails to timeline items
    const dbEmailSet = new Set<string>(); // track "type|participantId" for dedup
    dbEmails.forEach((e) => {
      const key = `${e.email_type}|${e.participant_id || "all"}`;
      dbEmailSet.add(key);

      const participant = e.participant_id ? participants.find((p) => p.id === e.participant_id) : null;
      let recipientLabel = "Tous les participants";
      let recipientType: TimelineEmail["recipientType"] = "all";

      if (participant) {
        recipientLabel = [participant.first_name, participant.last_name].filter(Boolean).join(" ") || participant.email;
        recipientType = "participant";
      } else if (e.email_type === "trainer_summary" || e.email_type === "participant_list_reminder" || e.email_type === "next_inter_session_reminder") {
        recipientLabel = trainerName || "Formateur";
        recipientType = "formateur";
      } else if (e.email_type === "cold_evaluation" && !e.participant_id) {
        recipientLabel = sponsorName ? `Commanditaire : ${sponsorName}` : sponsorEmail || "Commanditaire";
        recipientType = "sponsor";
      }

      const phase = getPhaseForType(e.email_type as string);
      items.push({
        id: e.id as string,
        emailType: e.email_type as string,
        label: EMAIL_TYPE_LABELS[e.email_type as string] || (e.email_type as string),
        scheduledDate: parseISO(e.scheduled_for as string),
        recipientLabel,
        recipientType,
        phase,
        source: "db",
        status: e.sent_at || e.status === "sent" ? "sent" : e.status === "error" ? "error" : "pending",
        participantId: e.participant_id as string | null | undefined,
        dbId: e.id as string | undefined,
      });
    });

    // ─── Predicted emails (not yet in DB) ─────────────────────────────
    if (!trainingStartDate) return items;

    const startDate = parseISO(trainingStartDate);
    const endDate = trainingEndDate ? parseISO(trainingEndDate) : startDate;
    const lastScheduleDate = schedules.length > 0 ? parseISO(schedules[schedules.length - 1].day_date) : endDate;
    const referenceEndDate = lastScheduleDate > endDate ? lastScheduleDate : endDate;

    // Helper: only add if not already in DB
    const addPredicted = (
      type: string,
      date: Date,
      recipientLabel: string,
      recipientType: TimelineEmail["recipientType"],
      phase: TimelineEmail["phase"],
      condition?: string,
      participantId?: string,
    ) => {
      const key = `${type}|${participantId || "all"}`;
      if (dbEmailSet.has(key)) return;
      items.push({
        id: `predicted-${type}-${participantId || "all"}-${date.getTime()}`,
        emailType: type,
        label: EMAIL_TYPE_LABELS[type] || type,
        scheduledDate: date,
        recipientLabel,
        recipientType,
        phase,
        source: "predicted",
        status: "predicted",
        participantId,
        condition,
      });
    };

    // --- AVANT FORMATION ---
    if (!isElearning) {
      // Participant list reminder J-7
      const listReminderDate = addDays(startDate, -7);
      if (isAfter(listReminderDate, now)) {
        addPredicted("participant_list_reminder", listReminderDate, trainerName || "Formateur", "formateur", "avant", "Si liste incomplète");
      }

      // Logistic reminder J-X
      const logisticDate = addDays(startDate, -delaySettings.logistic);
      if (isAfter(logisticDate, now)) {
        participants.forEach((p) => {
          const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email;
          addPredicted("reminder", logisticDate, name, "participant", "avant", undefined, p.id);
        });
      }

      // Trainer summary J-X
      const trainerSummaryDate = addDays(startDate, -delaySettings.trainerSummary);
      if (isAfter(trainerSummaryDate, now)) {
        addPredicted("trainer_summary", trainerSummaryDate, trainerName || "Formateur", "formateur", "avant");
      }
    }

    // --- PENDANT ---
    if (!isElearning) {
      schedules.forEach((s) => {
        const schedDate = parseISO(s.day_date);
        if (isAfter(schedDate, now) || differenceInDays(now, schedDate) === 0) {
          addPredicted("attendance", schedDate, "Tous les participants", "all", "pendant", "Émargement matin + après-midi");
        }
      });
    }

    // --- LIVES ---
    liveMeetings.forEach((live) => {
      if (!live.live_date) return;
      const liveDate = parseISO(live.live_date as string);
      const reminderDate = addDays(liveDate, -1);
      if (isAfter(reminderDate, now)) {
        participants.forEach((p) => {
          const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email;
          addPredicted("live_reminder", reminderDate, name, "participant", "avant", `Rappel pour le live du ${format(liveDate, "d MMM", { locale: fr })}`, p.id);
        });
      }
    });

    // --- FIN DE FORMATION (post thank-you) ---
    const thankYouSent = !!thankYouSentAt;
    const postCondition = thankYouSent ? undefined : "Après envoi du mail de remerciement";

    // Use actual thank-you date or estimate from end date
    const postRefDate = thankYouSentAt ? parseISO(thankYouSentAt) : referenceEndDate;

    participants.forEach((p) => {
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email;

      const evalCondition = postCondition ? postCondition + " • Annulé si éval soumise" : "Annulé si éval soumise";
      addPredicted("google_review", addDays(postRefDate, delaySettings.googleReview), name, "participant", "fin", postCondition, p.id);
      addPredicted("evaluation_reminder_1", addDays(postRefDate, delaySettings.evalReminder1), name, "participant", "fin", evalCondition, p.id);
      addPredicted("evaluation_reminder_2", addDays(postRefDate, delaySettings.evalReminder2), name, "participant", "fin", evalCondition, p.id);
      addPredicted("video_testimonial", addDays(postRefDate, delaySettings.videoTestimonial), name, "participant", "fin", postCondition, p.id);
      addPredicted("follow_up_news", addDays(postRefDate, delaySettings.followUpNews), name, "participant", "fin", postCondition, p.id);
    });

    // Cold evaluation for sponsor
    if (sponsorEmail || sponsorName) {
      addPredicted("cold_evaluation", addDays(postRefDate, delaySettings.coldEvaluation), sponsorName ? `Commanditaire : ${sponsorName}` : `Commanditaire : ${sponsorEmail}`, "sponsor", "fin", postCondition);
    }

    // Funder reminder
    addPredicted("funder_reminder", addDays(postRefDate, delaySettings.coldEvaluationFunder), sponsorName ? `Commanditaire : ${sponsorName}` : "Commanditaire", "sponsor", "fin", postCondition);

    // --- INTER ---
    if (isInterSession) {
      addPredicted("next_inter_session_reminder", addDays(referenceEndDate, 7), trainerName || "Formateur", "formateur", "inter", "J+7 ouvrés après fin de session");
    }

    // --- COACHING ---
    if (hasCoaching) {
      participants.forEach((p) => {
        const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email;
        addPredicted("coaching_first_invite", addDays(referenceEndDate, 1), name, "participant", "coaching", "J+1 après fin de formation", p.id);
      });
    }

    return items;
  }, [dbEmails, participants, trainingStartDate, trainingEndDate, schedules, delaySettings, thankYouSentAt, trainerName, sponsorName, sponsorEmail, isInterSession, isElearning, hasCoaching, liveMeetings]);

  // ─── Group by phase ──────────────────────────────────────────────────
  const groupedByPhase = useMemo(() => {
    const groups: Record<string, TimelineEmail[]> = {};
    timeline.forEach((item) => {
      if (!groups[item.phase]) groups[item.phase] = [];
      groups[item.phase].push(item);
    });
    // Sort each group by date
    Object.values(groups).forEach((g) => g.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime()));
    return groups;
  }, [timeline]);

  const sortedPhases = useMemo(() => {
    return Object.keys(groupedByPhase).sort((a, b) => (PHASE_LABELS[a]?.order ?? 99) - (PHASE_LABELS[b]?.order ?? 99));
  }, [groupedByPhase]);

  // ─── Stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const sent = timeline.filter((t) => t.status === "sent").length;
    const pending = timeline.filter((t) => t.status === "pending").length;
    const predicted = timeline.filter((t) => t.status === "predicted").length;
    const error = timeline.filter((t) => t.status === "error").length;
    return { sent, pending, predicted, error, total: timeline.length };
  }, [timeline]);

  const togglePhase = (phase: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Timeline des emails
        </CardTitle>
        <CardDescription className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-primary" />
            {stats.sent} envoyé{stats.sent > 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-amber-500" />
            {stats.pending} programmé{stats.pending > 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Ghost className="h-3 w-3 text-muted-foreground" />
            {stats.predicted} prévu{stats.predicted > 1 ? "s" : ""}
          </span>
          {stats.error > 0 && (
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-destructive" />
              {stats.error} erreur{stats.error > 1 ? "s" : ""}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun email prévu pour cette formation. Ajoutez des participants ou définissez les dates.
          </p>
        ) : (
          <TooltipProvider delayDuration={200}>
            {sortedPhases.map((phase) => {
              const phaseInfo = PHASE_LABELS[phase] || { label: phase, icon: "📧", order: 99 };
              const phaseItems = groupedByPhase[phase];
              const phaseSent = phaseItems.filter((i) => i.status === "sent").length;
              const phasePending = phaseItems.filter((i) => i.status === "pending").length;
              const phasePredicted = phaseItems.filter((i) => i.status === "predicted").length;
              const isExpanded = expandedPhases.has(phase);

              // Group by email type within phase
              const byType: Record<string, TimelineEmail[]> = {};
              phaseItems.forEach((item) => {
                if (!byType[item.emailType]) byType[item.emailType] = [];
                byType[item.emailType].push(item);
              });

              return (
                <Collapsible key={phase} open={isExpanded} onOpenChange={() => togglePhase(phase)}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between h-auto py-2.5 px-3 hover:bg-muted/50">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <span>{phaseInfo.icon}</span>
                        {phaseInfo.label}
                        <span className="flex gap-1 ml-1">
                          {phaseSent > 0 && <Badge variant="default" className="text-[10px] h-5 px-1.5 bg-primary/80">{phaseSent} ✓</Badge>}
                          {phasePending > 0 && <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{phasePending}</Badge>}
                          {phasePredicted > 0 && <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-dashed">{phasePredicted}</Badge>}
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-3 mt-1 space-y-1 border-l-2 border-muted pl-3">
                      {Object.entries(byType).map(([type, typeItems]) => {
                        const allSame = typeItems.length > 1 && typeItems.every((i) => i.recipientType === "participant");
                        const firstItem = typeItems[0];

                        if (allSame && typeItems.length > 3) {
                          // Collapsed view for many participants
                          const sentCount = typeItems.filter((i) => i.status === "sent").length;
                          const pendingCount = typeItems.filter((i) => i.status === "pending").length;
                          const predictedCount = typeItems.filter((i) => i.status === "predicted").length;

                          return (
                            <TimelineRow
                              key={type}
                              label={EMAIL_TYPE_LABELS[type] || type}
                              date={firstItem.scheduledDate}
                              status={sentCount === typeItems.length ? "sent" : pendingCount > 0 ? "pending" : "predicted"}
                              recipientLabel={`${typeItems.length} participants`}
                              recipientType="all"
                              condition={firstItem.condition}
                              breakdown={
                                <span className="text-[10px] text-muted-foreground">
                                  {sentCount > 0 && <span className="text-primary">{sentCount}✓ </span>}
                                  {pendingCount > 0 && <span className="text-amber-600">{pendingCount}⏳ </span>}
                                  {predictedCount > 0 && <span>{predictedCount}🔮</span>}
                                </span>
                              }
                            />
                          );
                        }

                        return typeItems.map((item) => (
                          <TimelineRow
                            key={item.id}
                            label={item.label}
                            date={item.scheduledDate}
                            status={item.status}
                            recipientLabel={item.recipientLabel}
                            recipientType={item.recipientType}
                            condition={item.condition}
                          />
                        ));
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </TooltipProvider>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 pt-3 border-t text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" /> Envoyé
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Programmé en DB
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full border border-dashed border-muted-foreground" /> Prévu (pas encore créé)
          </span>
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" /> Participant
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" /> Formateur
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Helper: phase for email type ───────────────────────────────────────
function getPhaseForType(type: string): TimelineEmail["phase"] {
  if (["welcome", "needs_survey", "needs_survey_reminder", "elearning_access"].includes(type)) return "inscription";
  if (["reminder", "trainer_summary", "participant_list_reminder", "live_reminder"].includes(type)) return "avant";
  if (["attendance", "trainer_notification"].includes(type)) return "pendant";
  if (["coaching_first_invite", "coaching_periodic_reminder", "coaching_final_reminder", "booking_reminder"].includes(type)) return "coaching";
  if (["next_inter_session_reminder"].includes(type)) return "inter";
  return "fin";
}

// ─── TimelineRow sub-component ──────────────────────────────────────────
function TimelineRow({
  label,
  date,
  status,
  recipientLabel,
  recipientType,
  condition,
  breakdown,
}: {
  label: string;
  date: Date;
  status: "sent" | "pending" | "predicted" | "error";
  recipientLabel: string;
  recipientType: TimelineEmail["recipientType"];
  condition?: string;
  breakdown?: React.ReactNode;
}) {
  const Icon = RECIPIENT_ICONS[recipientType] || User;

  const statusDot =
    status === "sent"
      ? "bg-primary"
      : status === "pending"
        ? "bg-amber-500"
        : status === "error"
          ? "bg-destructive"
          : "border border-dashed border-muted-foreground";

  const rowOpacity = status === "predicted" ? "opacity-60" : "";

  return (
    <div className={`flex items-start gap-2 py-1.5 text-xs ${rowOpacity}`}>
      {/* Timeline dot */}
      <div className="flex flex-col items-center mt-1">
        <div className={`w-2 h-2 rounded-full ${statusDot} flex-shrink-0`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-foreground">{label}</span>
          {breakdown}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
          <span className="whitespace-nowrap">
            {format(date, "d MMM yyyy", { locale: fr })}
          </span>
          <span className="text-muted-foreground/60">•</span>
          <Icon className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{recipientLabel}</span>
        </div>
        {condition && (
          <p className="text-[10px] text-muted-foreground/70 italic mt-0.5">
            💡 {condition}
          </p>
        )}
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0">
        {status === "sent" && (
          <Badge variant="default" className="text-[10px] h-5 px-1.5 bg-primary/80">
            <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
            Envoyé
          </Badge>
        )}
        {status === "pending" && (
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <Clock className="h-2.5 w-2.5 mr-0.5" />
            Programmé
          </Badge>
        )}
        {status === "error" && (
          <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
            <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
            Erreur
          </Badge>
        )}
        {status === "predicted" && (
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-dashed text-muted-foreground">
            <Ghost className="h-2.5 w-2.5 mr-0.5" />
            Prévu
          </Badge>
        )}
      </div>
    </div>
  );
}

export default EmailTimelineComputed;
