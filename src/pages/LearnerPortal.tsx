import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  GraduationCap, FileText, ClipboardCheck, Calendar,
  Download, ExternalLink, BookOpen, CheckCircle2, Clock,
  AlertCircle, MessageSquare, Video, Play, RotateCcw,
  Lock, ChevronRight, ChevronDown, LayoutDashboard,
  Palette, HelpCircle, LogOut, Bell, BarChart2, ArrowRight,
  CalendarPlus, Users, Sparkles, Menu, X,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import SupertiltLogo from "@/components/SupertiltLogo";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import LearnerMessaging from "@/components/learner/LearnerMessaging";
import LearnerLmsMessaging from "@/components/learner/LearnerLmsMessaging";
import CoachingBooking from "@/components/learner/CoachingBooking";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface NextEvent {
  id: string;
  title: string;
  scheduled_at: string;
  meeting_url: string | null;
  meeting_type: string;
}

interface Training {
  training_id: string;
  training_name: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  format: string | null;
  participant_id: string;
  first_name: string;
  last_name: string;
  needs_survey_status: string | null;
  evaluation_status: string | null;
  program_file_url?: string | null;
  supports_url?: string | null;
  lms_course_id?: string | null;
  lms_course_title?: string | null;
  lms_completion?: number | null;
  last_lesson_id?: string | null;
  next_event?: NextEvent | null;
  is_coached?: boolean;
  is_permanent?: boolean;
}

interface Questionnaire {
  token: string;
  training_id: string;
  etat: string;
}

interface LearnerData {
  email: string;
  trainings: Training[];
  questionnaires: Questionnaire[];
  evaluations: Questionnaire[];
}

type NavSection = "dashboard" | "formations" | "aide";

// ── Helpers ───────────────────────────────────────────────────────────────────

const eventTypeLabel: Record<string, string> = {
  launch: "Lancement",
  live: "Live",
  closing: "Séance de clôture",
};

function statusBadge(status: string | null) {
  switch (status) {
    case "complete":
    case "soumis":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: "#dcfce7", color: "#15803d" }}>
          <CheckCircle2 size={10} /> Complété
        </span>
      );
    case "en_cours":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: "#f1f5f9", color: "#475569" }}>
          <Clock size={10} /> En cours
        </span>
      );
    case "non_envoye":
    case "envoye":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: "#fef9c3", color: "#854d0e" }}>
          <AlertCircle size={10} /> À compléter
        </span>
      );
    default:
      return null;
  }
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function progressMessage(pct: number) {
  if (pct === 0) return "C'est parti ! Commencez votre premier module.";
  if (pct < 30) return "Bon début ! Continuez à ce rythme.";
  if (pct < 60) return "Belle progression ! Vous êtes sur la bonne voie.";
  if (pct < 90) return "Excellent travail ! La fin approche.";
  return "Félicitations ! Formation presque terminée.";
}

// ── Progress circle ───────────────────────────────────────────────────────────

function ProgressCircle({ pct, size = 80 }: { pct: number; size?: number }) {
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(pct, 100) / 100;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDEDED" strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FFD100" strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold leading-none" style={{ fontSize: size * 0.22, color: "var(--st-ink)" }}>
          {Math.round(pct)}%
        </span>
        <span style={{ fontSize: size * 0.11, color: "var(--st-ink-muted)" }}>terminé</span>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  active,
  onNav,
  firstName,
  lastName,
  email,
  onLogout,
  mobile,
  onClose,
}: {
  active: NavSection;
  onNav: (s: NavSection) => void;
  firstName: string;
  lastName: string;
  email: string;
  onLogout: () => void;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const navItems: Array<{ id: NavSection; label: string; icon: React.ElementType }> = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "formations", label: "Mes formations", icon: BookOpen },
    { id: "aide", label: "Aide", icon: HelpCircle },
  ];

  return (
    <aside
      className="flex flex-col h-full"
      style={{ background: "var(--st-white)", borderRight: "1px solid rgba(16,24,32,0.08)" }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16 border-b shrink-0"
        style={{ borderColor: "rgba(16,24,32,0.08)" }}>
        <SupertiltLogo className="h-7" />
        {mobile && onClose && (
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5">
            <X size={16} style={{ color: "var(--st-ink)" }} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { onNav(id); onClose?.(); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
              active === id
                ? "text-[#101820]"
                : "hover:bg-black/5",
            )}
            style={active === id ? { background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" } : { fontFamily: "inherit", color: "var(--st-ink-muted)" }}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      {/* User block */}
      <div className="px-3 pb-5 pt-3 border-t space-y-3" style={{ borderColor: "rgba(16,24,32,0.08)" }}>
        <div className="flex items-center gap-3 px-3 py-2">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: "var(--st-yellow)", color: "#101820" }}
          >
            {getInitials(firstName, lastName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug truncate" style={{ color: "var(--st-ink)" }}>
              {firstName} {lastName}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--st-ink-muted)" }}>Apprenant·e</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:bg-black/5 text-left"
          style={{ color: "var(--st-ink-muted)", fontFamily: "inherit" }}
        >
          <LogOut size={15} />
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}

// ── Training detail (documents / messages / coaching) ─────────────────────────

function TrainingDetail({
  training,
  email,
  questionnaire,
  evaluation,
  onRequestCoach,
  requestingCoach,
}: {
  training: Training;
  email: string;
  questionnaire: Questionnaire | undefined;
  evaluation: Questionnaire | undefined;
  onRequestCoach: (t: Training) => void;
  requestingCoach: string | null;
}) {
  const hasDocuments = !!(
    training.program_file_url || training.supports_url || questionnaire || evaluation
  );

  return (
    <Tabs defaultValue="documents" className="mt-4">
      <TabsList className="mb-3 bg-transparent gap-1 p-0 h-auto">
        {[
          { value: "documents", label: "Documents", icon: FileText },
          { value: "messages", label: "Messages", icon: MessageSquare },
          { value: "coaching", label: "Coaching", icon: Video },
        ].map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg data-[state=active]:shadow-none data-[state=active]:font-semibold"
            style={{ fontFamily: "inherit" }}
          >
            <Icon size={12} />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="documents">
        {!hasDocuments ? (
          <p className="text-sm py-3" style={{ color: "var(--st-ink-muted)" }}>Aucun document disponible.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {training.program_file_url && (
              <a href={training.program_file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-xl border text-sm transition-all hover:bg-black/5"
                style={{ borderColor: "rgba(16,24,32,0.1)", color: "var(--st-ink)" }}>
                <Download size={14} style={{ color: "#FFD100", flexShrink: 0 }} />
                Programme de formation
                <ExternalLink size={11} className="ml-auto shrink-0" style={{ color: "var(--st-ink-muted)" }} />
              </a>
            )}
            {training.supports_url && (
              <a href={training.supports_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-xl border text-sm transition-all hover:bg-black/5"
                style={{ borderColor: "rgba(16,24,32,0.1)", color: "var(--st-ink)" }}>
                <FileText size={14} style={{ color: "#FFD100", flexShrink: 0 }} />
                Supports de formation
                <ExternalLink size={11} className="ml-auto shrink-0" style={{ color: "var(--st-ink-muted)" }} />
              </a>
            )}
            {questionnaire && (
              <Link to={`/questionnaire/${questionnaire.token}`}
                className="flex items-center gap-2 p-3 rounded-xl border text-sm transition-all hover:bg-black/5"
                style={{ borderColor: "rgba(16,24,32,0.1)", color: "var(--st-ink)" }}>
                <ClipboardCheck size={14} style={{ color: "#FFD100", flexShrink: 0 }} />
                Questionnaire des besoins
                <span className="ml-auto">{statusBadge(questionnaire.etat)}</span>
              </Link>
            )}
            {evaluation && (
              <Link to={`/evaluation/${evaluation.token}`}
                className="flex items-center gap-2 p-3 rounded-xl border text-sm transition-all hover:bg-black/5"
                style={{ borderColor: "rgba(16,24,32,0.1)", color: "var(--st-ink)" }}>
                <ClipboardCheck size={14} style={{ color: "#FFD100", flexShrink: 0 }} />
                Évaluation à chaud
                <span className="ml-auto">{statusBadge(evaluation.etat)}</span>
              </Link>
            )}
          </div>
        )}
      </TabsContent>

      <TabsContent value="messages">
        {training.lms_course_id ? (
          <LearnerLmsMessaging courseId={training.lms_course_id} learnerEmail={email} />
        ) : (
          <LearnerMessaging trainingId={training.training_id} participantId={training.participant_id} learnerEmail={email} />
        )}
      </TabsContent>

      <TabsContent value="coaching">
        {training.is_coached ? (
          <CoachingBooking trainingId={training.training_id} participantId={training.participant_id} learnerEmail={email} />
        ) : (
          <div className="rounded-2xl border border-dashed p-6 text-center space-y-4"
            style={{ borderColor: "rgba(16,24,32,0.12)", background: "rgba(16,24,32,0.02)" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto"
              style={{ background: "#EDEDED" }}>
              <Lock size={16} style={{ color: "var(--st-ink-muted)" }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--st-ink)" }}>Coaching individuel non inclus</p>
              <p className="text-xs mt-1" style={{ color: "var(--st-ink-muted)" }}>
                Votre formule actuelle ne comprend pas de sessions de coaching.
              </p>
            </div>
            <button
              disabled={requestingCoach === training.training_id}
              onClick={() => onRequestCoach(training)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full border transition-all hover:bg-black/5"
              style={{ borderColor: "rgba(16,24,32,0.2)", color: "var(--st-ink)", fontFamily: "inherit" }}
            >
              {requestingCoach === training.training_id ? (
                <Spinner className="mr-1" />
              ) : (
                <Video size={13} />
              )}
              Demander une formule coachée
            </button>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

// ── Formation card item ───────────────────────────────────────────────────────

function FormationItem({
  training,
  email,
  questionnaire,
  evaluation,
  onRequestCoach,
  requestingCoach,
  primary,
}: {
  training: Training;
  email: string;
  questionnaire: Questionnaire | undefined;
  evaluation: Questionnaire | undefined;
  onRequestCoach: (t: Training) => void;
  requestingCoach: string | null;
  primary: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const completion = training.lms_completion ?? 0;
  const hasStarted = !!training.last_lesson_id || completion > 0;
  const hasElearning = !!training.lms_course_id;

  const continueUrl = hasElearning
    ? `/lms/${training.lms_course_id}/home?email=${encodeURIComponent(email)}${training.last_lesson_id ? `&lesson=${training.last_lesson_id}` : ""}`
    : null;

  if (!primary) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:bg-black/5"
        style={{ borderColor: "rgba(16,24,32,0.08)" }}
      >
        <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
          style={{ background: "var(--st-surface, #F2F4F4)" }}>
          <GraduationCap size={14} style={{ color: "var(--st-ink-muted)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--st-ink)" }}>
            {training.lms_course_title || training.training_name}
          </p>
          {hasElearning && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#EDEDED" }}>
                <div className="h-full rounded-full" style={{ width: `${completion}%`, background: "#FFD100" }} />
              </div>
              <span className="text-xs font-medium shrink-0" style={{ color: "var(--st-ink-muted)" }}>{Math.round(completion)}%</span>
            </div>
          )}
        </div>
        {continueUrl && (
          <Link to={continueUrl}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:-translate-y-px"
            style={{ background: "var(--st-ink)", color: "#fff" }}>
            Continuer
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(16,24,32,0.08)" }}>
      {/* Main info */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center"
            style={{ background: "var(--st-yellow-soft, #FFFBEA)" }}>
            <BookOpen size={20} style={{ color: "#101820" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 justify-between">
              <p className="text-sm font-bold leading-snug" style={{ color: "var(--st-ink)" }}>
                {training.lms_course_title || training.training_name}
              </p>
              <span className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium"
                style={{ background: completion === 100 ? "#dcfce7" : "#fffbea", color: completion === 100 ? "#15803d" : "#854d0e" }}>
                {completion === 100 ? "Terminée" : hasStarted ? "En cours" : "Non commencée"}
              </span>
            </div>
            {hasElearning && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs" style={{ color: "var(--st-ink-muted)" }}>
                  <span>Progression</span>
                  <span className="font-semibold" style={{ color: "var(--st-ink)" }}>{Math.round(completion)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#EDEDED" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${completion}%`, background: "#FFD100" }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {hasElearning && continueUrl && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Link to={continueUrl}
              className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2 rounded-full transition-all hover:-translate-y-0.5"
              style={{ background: "var(--st-yellow)", color: "#101820" }}>
              {hasStarted ? <><RotateCcw size={13} /> Reprendre</> : <><Play size={13} /> Commencer</>}
            </Link>
            <Link to={`/lms/${training.lms_course_id}/home?email=${encodeURIComponent(email)}`}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full border transition-all hover:bg-black/5"
              style={{ borderColor: "rgba(16,24,32,0.15)", color: "var(--st-ink)" }}>
              Accueil du cours
            </Link>
          </div>
        )}
      </div>

      {/* Expand docs/messages/coaching */}
      <div className="border-t" style={{ borderColor: "rgba(16,24,32,0.08)" }}>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 px-5 py-3 text-sm transition-all hover:bg-black/5 text-left"
          style={{ color: "var(--st-ink-muted)", fontFamily: "inherit" }}
        >
          <span className="flex-1">Documents · Messages · Coaching</span>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {expanded && (
          <div className="px-5 pb-5">
            <TrainingDetail
              training={training}
              email={email}
              questionnaire={questionnaire}
              evaluation={evaluation}
              onRequestCoach={onRequestCoach}
              requestingCoach={requestingCoach}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard view ────────────────────────────────────────────────────────────

function DashboardView({
  data,
  onRequestCoach,
  requestingCoach,
  onNav,
}: {
  data: LearnerData;
  onRequestCoach: (t: Training) => void;
  requestingCoach: string | null;
  onNav: (s: NavSection) => void;
}) {
  const firstName = data.trainings[0]?.first_name || "";
  const lastName = data.trainings[0]?.last_name || "";

  const lmsTrainings = data.trainings.filter((t) => t.lms_course_id);
  const mainTraining = lmsTrainings[0] ?? data.trainings[0];
  const globalPct = useMemo(() => {
    if (lmsTrainings.length === 0) return 0;
    return lmsTrainings.reduce((s, t) => s + (t.lms_completion ?? 0), 0) / lmsTrainings.length;
  }, [lmsTrainings]);

  const nextEvent = useMemo(() => {
    const now = new Date();
    return data.trainings
      .filter((t) => t.next_event && !t.is_permanent && new Date(t.next_event.scheduled_at) > now)
      .sort((a, b) =>
        new Date(a.next_event!.scheduled_at).getTime() - new Date(b.next_event!.scheduled_at).getTime()
      )[0]?.next_event ?? null;
  }, [data.trainings]);

  const hasStarted = !!mainTraining?.last_lesson_id || (mainTraining?.lms_completion ?? 0) > 0;
  const resumeUrl = mainTraining?.lms_course_id
    ? `/lms/${mainTraining.lms_course_id}/home?email=${encodeURIComponent(data.email)}${mainTraining.last_lesson_id ? `&lesson=${mainTraining.last_lesson_id}` : ""}`
    : null;

  const nextActions = useMemo(() => {
    const actions: string[] = [];
    if (mainTraining?.lms_course_id) {
      actions.push("Reprendre votre progression");
      if ((mainTraining.lms_completion ?? 0) < 50) actions.push("Consulter le programme de formation");
      if (nextEvent) actions.push(`Rejoindre le prochain live — ${format(new Date(nextEvent.scheduled_at), "d MMM", { locale: fr })}`);
    }
    const pending = data.questionnaires?.filter((q) => q.etat !== "complete" && q.etat !== "soumis");
    if (pending?.length) actions.push("Compléter votre questionnaire des besoins");
    const pendingEval = data.evaluations?.filter((q) => q.etat !== "complete" && q.etat !== "soumis");
    if (pendingEval?.length) actions.push("Remplir votre évaluation à chaud");
    return actions.slice(0, 4);
  }, [mainTraining, nextEvent, data.questionnaires, data.evaluations]);

  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <div
        className="rounded-2xl grid md:grid-cols-5 gap-6 p-6 overflow-hidden relative"
        style={{ background: "var(--st-white)", border: "1px solid rgba(16,24,32,0.08)", boxShadow: "0 2px 20px rgba(16,24,32,0.06)" }}
      >
        {/* Left */}
        <div className="md:col-span-3 flex flex-col justify-between gap-5">
          <div>
            <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--st-ink)", letterSpacing: "-0.02em" }}>
              Bonjour {firstName} 👋
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--st-ink-muted)" }}>
              {progressMessage(globalPct)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {resumeUrl && (
              <Link to={resumeUrl}
                className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={{ background: "var(--st-yellow)", color: "#101820", boxShadow: "0 4px 16px rgba(255,209,0,0.35)" }}>
                {hasStarted ? <><RotateCcw size={14} /> Reprendre ma formation</> : <><Play size={14} /> Commencer ma formation</>}
              </Link>
            )}
            <button onClick={() => onNav("formations")}
              className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium border transition-all hover:bg-black/5"
              style={{ borderColor: "rgba(16,24,32,0.18)", color: "var(--st-ink)", fontFamily: "inherit" }}>
              Voir mes formations
            </button>
          </div>
        </div>

        {/* Right — progress */}
        <div className="md:col-span-2 flex items-center justify-center md:justify-end gap-6">
          <ProgressCircle pct={globalPct} size={100} />
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--st-ink-muted)" }}>
                Dernière activité
              </p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--st-ink)" }}>
                {mainTraining?.lms_course_title || mainTraining?.training_name || "—"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: hasStarted ? "#16a34a" : "#d1d5db" }} />
              <span className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
                {hasStarted ? "En cours" : "Non commencée"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live banner */}
      {nextEvent && (
        <div className="rounded-2xl flex flex-wrap items-center gap-4 px-6 py-5"
          style={{ background: "#101820" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--st-yellow)" }}>
              <Calendar size={18} style={{ color: "#101820" }} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--st-yellow)" }}>
                {eventTypeLabel[nextEvent.meeting_type] ?? "Prochain évènement"}
              </p>
              <p className="text-sm font-bold text-white">
                {nextEvent.title || "Live"} — {format(new Date(nextEvent.scheduled_at), "EEEE d MMM yyyy 'à' HH:mm", { locale: fr })}
              </p>
            </div>
          </div>
          <p className="text-sm flex-1 min-w-[160px]" style={{ color: "rgba(255,255,255,0.6)" }}>
            Rencontre en direct avec votre formateur
          </p>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {nextEvent.meeting_url && (
              <a href={nextEvent.meeting_url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium px-4 py-2 rounded-full border transition-all hover:bg-white/10"
                style={{ borderColor: "rgba(255,255,255,0.2)", color: "#fff" }}>
                Rejoindre
              </a>
            )}
            <button
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-all hover:-translate-y-px"
              style={{ background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" }}>
              <CalendarPlus size={14} />
              Ajouter au calendrier
            </button>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left col (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mes formations */}
          <DashCard title="Mes formations" icon={GraduationCap} action={{ label: "Voir toutes", onClick: () => onNav("formations") }}>
            {data.trainings.length === 0 ? (
              <div className="py-6 text-center">
                <GraduationCap size={32} className="mx-auto mb-2" style={{ color: "var(--st-ink-muted)" }} />
                <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>Aucune formation trouvée.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.trainings.slice(0, 1).map((t) => (
                  <FormationItem
                    key={t.training_id + t.participant_id}
                    training={t}
                    email={data.email}
                    questionnaire={data.questionnaires?.find((q) => q.training_id === t.training_id)}
                    evaluation={data.evaluations?.find((e) => e.training_id === t.training_id)}
                    onRequestCoach={onRequestCoach}
                    requestingCoach={requestingCoach}
                    primary
                  />
                ))}
                {data.trainings.slice(1).map((t) => (
                  <FormationItem
                    key={t.training_id + t.participant_id}
                    training={t}
                    email={data.email}
                    questionnaire={data.questionnaires?.find((q) => q.training_id === t.training_id)}
                    evaluation={data.evaluations?.find((e) => e.training_id === t.training_id)}
                    onRequestCoach={onRequestCoach}
                    requestingCoach={requestingCoach}
                    primary={false}
                  />
                ))}
              </div>
            )}
          </DashCard>

          {/* À faire ensuite */}
          {nextActions.length > 0 && (
            <DashCard title="À faire ensuite" icon={ArrowRight}>
              <ul className="space-y-1">
                {nextActions.map((action, i) => (
                  <li key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all hover:bg-black/5 group"
                    style={{ color: "var(--st-ink)" }}>
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: "var(--st-yellow)", color: "#101820" }}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm">{action}</span>
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
                  </li>
                ))}
              </ul>
            </DashCard>
          )}
        </div>

        {/* Right col (1/3) */}
        <div className="space-y-4">
          {/* Retours SuperTilt */}
          <DashCard title="Retours SuperTilt" icon={MessageSquare}>
            <div className="py-4 text-center">
              <div className="w-10 h-10 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: "var(--st-surface, #F2F4F4)" }}>
                <MessageSquare size={18} style={{ color: "var(--st-ink-muted)" }} />
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: "var(--st-ink)" }}>Aucun retour pour l'instant</p>
              <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
                Vos commentaires de formateur apparaîtront ici.
              </p>
            </div>
          </DashCard>

          {/* Partager */}
          <div className="rounded-2xl p-5" style={{ background: "var(--st-yellow-soft, #FFFBEA)", border: "1px solid rgba(255,209,0,0.25)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} style={{ color: "#101820" }} />
              <p className="text-sm font-semibold" style={{ color: "#101820" }}>Osez partager vos réalisations</p>
            </div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(16,24,32,0.7)" }}>
              Partagez vos travaux avec la communauté pour recevoir des retours et progresser plus vite. Vos travaux restent privés par défaut.
            </p>
            <button
              className="w-full text-sm font-semibold py-2.5 rounded-xl transition-all hover:-translate-y-px"
              style={{ background: "#101820", color: "#fff", fontFamily: "inherit" }}>
              Espace de pratique →
            </button>
          </div>

          {/* Aide rapide */}
          <DashCard title="Aide rapide" icon={HelpCircle}>
            <ul className="space-y-0.5">
              {[
                { label: "Accéder à l'aide", icon: HelpCircle },
                { label: "Voir mes notifications", icon: Bell },
                { label: "Contacter SuperTilt", icon: MessageSquare },
              ].map(({ label, icon: Icon }) => (
                <li key={label}>
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all hover:bg-black/5 text-left group"
                    style={{ color: "var(--st-ink)", fontFamily: "inherit" }}>
                    <Icon size={15} style={{ color: "var(--st-ink-muted)", flexShrink: 0 }} />
                    <span className="flex-1">{label}</span>
                    <ChevronRight size={13} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </DashCard>
        </div>
      </div>
    </div>
  );
}

// ── Formations view ───────────────────────────────────────────────────────────

function FormationsView({
  data,
  onRequestCoach,
  requestingCoach,
}: {
  data: LearnerData;
  onRequestCoach: (t: Training) => void;
  requestingCoach: string | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--st-ink)" }}>Mes formations</h2>
        <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
          {data.trainings.length} formation{data.trainings.length !== 1 ? "s" : ""} trouvée{data.trainings.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="space-y-4">
        {data.trainings.map((t) => (
          <FormationItem
            key={t.training_id + t.participant_id}
            training={t}
            email={data.email}
            questionnaire={data.questionnaires?.find((q) => q.training_id === t.training_id)}
            evaluation={data.evaluations?.find((e) => e.training_id === t.training_id)}
            onRequestCoach={onRequestCoach}
            requestingCoach={requestingCoach}
            primary
          />
        ))}
      </div>
    </div>
  );
}

// ── Aide view ────────────────────────────────────────────────────────────────

function AideView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--st-ink)" }}>Aide</h2>
        <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>Besoin d'un coup de main ?</p>
      </div>
      <div className="rounded-2xl border p-8 text-center space-y-4"
        style={{ borderColor: "rgba(16,24,32,0.08)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: "var(--st-yellow-soft, #FFFBEA)" }}>
          <MessageSquare size={20} style={{ color: "#101820" }} />
        </div>
        <div>
          <p className="text-base font-semibold mb-1" style={{ color: "var(--st-ink)" }}>Contacter SuperTilt</p>
          <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
            Notre équipe est disponible pour répondre à vos questions.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5"
          style={{ background: "var(--st-ink)", color: "#fff", fontFamily: "inherit" }}>
          Nous contacter
        </button>
      </div>
    </div>
  );
}

// ── Generic card shell ────────────────────────────────────────────────────────

function DashCard({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.ElementType;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border p-5 transition-shadow hover:shadow-sm"
      style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "var(--st-surface, #F2F4F4)" }}>
          <Icon size={14} style={{ color: "var(--st-ink-muted)" }} />
        </div>
        <p className="text-sm font-semibold flex-1" style={{ color: "var(--st-ink)" }}>{title}</p>
        {action && (
          <button onClick={action.onClick}
            className="text-xs font-medium transition-colors hover:opacity-70"
            style={{ color: "var(--st-ink-muted)", fontFamily: "inherit" }}>
            {action.label} →
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LearnerPortal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LearnerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestingCoach, setRequestingCoach] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.user_metadata?.role === "learner" && session.user.email) {
        window.history.replaceState({}, "", "/espace-apprenant");
        loadData(session.user.email);
        return;
      }
      if (token) {
        navigate(`/apprenant/connexion?token=${encodeURIComponent(token)}`, { replace: true });
        return;
      }
      const savedEmail = sessionStorage.getItem("learner_email");
      if (savedEmail) {
        loadData(savedEmail);
        return;
      }
      navigate("/apprenant");
    };

    init();
  }, [searchParams, navigate]);

  const loadData = async (email: string) => {
    try {
      const { data: result, error } = await supabase.rpc("get_learner_portal_data", { p_email: email });
      if (error) throw error;
      setData(result as unknown as LearnerData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? "Erreur inconnue";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("learner_email");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.user_metadata?.role === "learner") {
      await supabase.auth.signOut();
    }
    navigate("/apprenant");
  };

  const handleRequestCoach = async (training: Training) => {
    if (!data || !training.lms_course_id) return;
    setRequestingCoach(training.training_id);
    try {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "sender_email")
        .single();
      const adminEmail = (settings?.setting_value as string) || "contact@supertilt.fr";

      await supabase.functions.invoke("request-coached-formula", {
        body: {
          learnerEmail: data.email,
          trainingName: training.training_name,
          courseTitle: training.lms_course_title ?? "",
          adminEmail,
        },
      });
      toast({ title: "Demande envoyée", description: "Votre formateur a été notifié et reviendra vers vous rapidement." });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Impossible d'envoyer la demande.");
    } finally {
      setRequestingCoach(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--st-surface, #F2F4F4)" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--st-surface, #F2F4F4)" }}>
        <div className="w-full max-w-sm rounded-2xl border p-8 text-center space-y-4"
          style={{ background: "var(--st-white)", border: "1px solid rgba(16,24,32,0.08)" }}>
          <AlertCircle size={40} className="mx-auto" style={{ color: "#dc2626" }} />
          <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>{error}</p>
          <Link to="/apprenant"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
            style={{ background: "var(--st-ink)", color: "#fff" }}>
            Demander un nouveau lien
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const firstName = data.trainings[0]?.first_name || "";
  const lastName = data.trainings[0]?.last_name || "";

  const sectionTitle: Record<NavSection, string> = {
    dashboard: "Tableau de bord",
    formations: "Mes formations",
    aide: "Aide",
  };
  const sectionSubtitle: Record<NavSection, string> = {
    dashboard: "Retrouvez vos formations, votre progression et vos prochains rendez-vous.",
    formations: "Toutes vos formations, documents, messages et coaching.",
    aide: "Ressources et contact.",
  };

  return (
    <div className="flex h-screen overflow-hidden"
      style={{ fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif", background: "var(--st-surface, #F2F4F4)" }}>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col shrink-0" style={{ width: 240 }}>
        <Sidebar
          active={activeSection}
          onNav={setActiveSection}
          firstName={firstName}
          lastName={lastName}
          email={data.email}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div className="lg:hidden fixed left-0 top-0 bottom-0 z-50" style={{ width: 260 }}>
            <Sidebar
              active={activeSection}
              onNav={setActiveSection}
              firstName={firstName}
              lastName={lastName}
              email={data.email}
              onLogout={handleLogout}
              mobile
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header
          className="sticky top-0 z-20 flex items-center gap-4 px-5 h-16 border-b shrink-0"
          style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}
        >
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5">
            <Menu size={18} style={{ color: "var(--st-ink)" }} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-none" style={{ color: "var(--st-ink)" }}>
              {sectionTitle[activeSection]}
            </h1>
            <p className="text-xs mt-0.5 truncate hidden sm:block" style={{ color: "var(--st-ink-muted)" }}>
              {sectionSubtitle[activeSection]}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button className="hidden sm:flex flex-col items-end cursor-pointer hover:opacity-70 transition-opacity">
              <span className="text-xs font-medium" style={{ color: "var(--st-ink)" }}>Mon compte</span>
              <span className="text-xs" style={{ color: "var(--st-ink-muted)" }}>Espace apprenant</span>
            </button>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: "var(--st-yellow)", color: "#101820" }}>
              {getInitials(firstName, lastName)}
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            {activeSection === "dashboard" && (
              <DashboardView
                data={data}
                onRequestCoach={handleRequestCoach}
                requestingCoach={requestingCoach}
                onNav={setActiveSection}
              />
            )}
            {activeSection === "formations" && (
              <FormationsView
                data={data}
                onRequestCoach={handleRequestCoach}
                requestingCoach={requestingCoach}
              />
            )}
            {activeSection === "aide" && <AideView />}
          </div>
        </div>
      </div>

      {/* Floating help button */}
      <button
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-3 rounded-full text-sm font-semibold shadow-lg transition-all hover:-translate-y-px hover:shadow-xl"
        style={{ background: "#101820", color: "#fff", fontFamily: "inherit" }}
        onClick={() => setActiveSection("aide")}
      >
        <MessageSquare size={15} />
        Une question ?
      </button>
    </div>
  );
}
