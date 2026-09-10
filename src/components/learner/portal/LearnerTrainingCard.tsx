import { useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, FileText, ClipboardCheck, Download, ExternalLink, BookOpen,
  CheckCircle2, Clock, AlertCircle, Video, Play, RotateCcw, Lock,
  ChevronRight, ChevronDown, CalendarPlus, Award, RefreshCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import AddToCalendarButton from "@/components/learner/AddToCalendarButton";
import type { Training, Questionnaire } from "@/types/learner-portal";

export function statusBadge(status: string | null) {
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

export function progressMessage(pct: number) {
  if (pct === 0) return "C'est parti ! Commencez votre premier module.";
  if (pct < 30) return "Bon début ! Continuez à ce rythme.";
  if (pct < 60) return "Belle progression ! Vous êtes sur la bonne voie.";
  if (pct < 90) return "Excellent travail ! La fin approche.";
  return "Félicitations ! Formation presque terminée.";
}

export function ProgressCircle({ pct, size = 80 }: { pct: number; size?: number }) {
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

export function CoachingCircles({ completed, total }: { completed: number; total: number }) {
  if (total <= 0) return null;
  return (
    <div className="flex items-center gap-1.5 mt-2">
      {Array.from({ length: total }).map((_, i) => {
        const isDone = i < completed;
        return (
          <div
            key={i}
            className="h-5 w-5 rounded-full border-2 flex items-center justify-center"
            style={{
              background: isDone ? "#FFD100" : "transparent",
              borderColor: isDone ? "#FFD100" : "rgba(16,24,32,0.25)",
            }}
          >
            {isDone && <CheckCircle2 size={10} style={{ color: "#101820" }} />}
          </div>
        );
      })}
      <span className="text-xs ml-1" style={{ color: "var(--st-ink-muted)" }}>
        {completed}/{total} séances
      </span>
    </div>
  );
}

/**
 * Un onglet n'est visible que s'il a au moins un élément à afficher.
 * Le périmètre "Documents" doit donc être identique au contenu rendu.
 */
export function hasLearnerDocuments(
  training: Training,
  questionnaire?: Questionnaire,
  evaluation?: Questionnaire,
): boolean {
  return (
    (training.documents?.length ?? 0) > 0 ||
    !!training.program_file_url ||
    !!training.supports_url ||
    !!questionnaire ||
    !!evaluation
  );
}

export function hasLearnerCoaching(training: Training): boolean {
  return (training.coaching_sessions_total ?? 0) > 0;
}

export function TrainingDetail({
  training,
  questionnaire,
  evaluation,
}: {
  training: Training;
  questionnaire: Questionnaire | undefined;
  evaluation: Questionnaire | undefined;
}) {
  const documents = training.documents ?? [];
  const hasDocuments = hasLearnerDocuments(training, questionnaire, evaluation);

  const coachingCompleted = training.coaching_sessions_completed ?? 0;
  const coachingTotal = training.coaching_sessions_total ?? 0;
  const remainingSessions = coachingTotal - coachingCompleted;
  const hasCoaching = hasLearnerCoaching(training);

  return (
    <Tabs defaultValue="details" className="mt-4">
      <TabsList className="mb-3 bg-transparent gap-1 p-0 h-auto">
        {[
          { value: "details", label: "Formation", icon: GraduationCap },
          ...(hasDocuments ? [{ value: "documents", label: "Documents", icon: FileText }] : []),
          ...(hasCoaching ? [{ value: "coaching", label: "Coaching", icon: Video }] : []),
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

      <TabsContent value="details">
        <div className="space-y-4">
          {/* Objectifs */}
          {(training.objectives?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--st-ink-muted)" }}>Objectifs</p>
              <ul className="space-y-1">
                {training.objectives!.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--st-ink)" }}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#FFD100" }} />
                    {obj}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prérequis */}
          {(training.prerequisites?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--st-ink-muted)" }}>Prérequis</p>
              <ul className="space-y-1">
                {training.prerequisites!.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--st-ink)" }}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "rgba(16,24,32,0.25)" }} />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Programme + Règlement intérieur */}
          {(training.program_file_url || training.reglement_interieur_url) && (
            <div className="grid sm:grid-cols-2 gap-2">
              {training.program_file_url && (
                <a href={training.program_file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-xl border text-sm transition-all hover:bg-black/5"
                  style={{ borderColor: "rgba(16,24,32,0.1)", color: "var(--st-ink)" }}>
                  <Download size={14} style={{ color: "#FFD100", flexShrink: 0 }} />
                  Programme
                  <ExternalLink size={11} className="ml-auto shrink-0" style={{ color: "var(--st-ink-muted)" }} />
                </a>
              )}
              {training.reglement_interieur_url && (
                <a href={training.reglement_interieur_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-xl border text-sm transition-all hover:bg-black/5"
                  style={{ borderColor: "rgba(16,24,32,0.1)", color: "var(--st-ink)" }}>
                  <FileText size={14} style={{ color: "#FFD100", flexShrink: 0 }} />
                  Règlement intérieur
                  <ExternalLink size={11} className="ml-auto shrink-0" style={{ color: "var(--st-ink-muted)" }} />
                </a>
              )}
            </div>
          )}

          {/* Formateur */}
          {training.trainer_name && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--st-ink-muted)" }}>Votre formateur</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold"
                  style={{ background: training.trainer_photo_url ? "transparent" : "#EDEDED", color: "#101820" }}>
                  {training.trainer_photo_url
                    ? <img src={training.trainer_photo_url} alt={training.trainer_name} className="w-full h-full object-cover" />
                    : training.trainer_name.split(" ").map(n => n[0]).join("").toUpperCase()}
                </div>
                <span className="text-sm font-medium" style={{ color: "var(--st-ink)" }}>{training.trainer_name}</span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {(training.objectives?.length ?? 0) === 0 &&
            (training.prerequisites?.length ?? 0) === 0 &&
            !training.program_file_url &&
            !training.reglement_interieur_url &&
            !training.trainer_name && (
            <p className="text-sm py-3" style={{ color: "var(--st-ink-muted)" }}>Aucun détail disponible.</p>
          )}
        </div>
      </TabsContent>

      {hasDocuments && (
      <TabsContent value="documents">
          <div className="grid sm:grid-cols-2 gap-2">
            {documents.map((doc, i) => (
              <a key={`${doc.file_url}-${i}`} href={doc.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-xl border text-sm transition-all hover:bg-black/5"
                style={{ borderColor: "rgba(16,24,32,0.1)", color: "var(--st-ink)" }}>
                <Download size={14} style={{ color: "#FFD100", flexShrink: 0 }} />
                <span className="truncate">{doc.file_name || "Document"}</span>
                <ExternalLink size={11} className="ml-auto shrink-0" style={{ color: "var(--st-ink-muted)" }} />
              </a>
            ))}
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
      </TabsContent>
      )}

      {hasCoaching && (
      <TabsContent value="coaching">
          <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: "var(--st-ink)" }}>
                  Séances de coaching
                </p>
                <CoachingCircles completed={coachingCompleted} total={coachingTotal} />
                <p className="text-xs mt-2" style={{ color: "var(--st-ink-muted)" }}>
                  {remainingSessions > 0
                    ? `${remainingSessions} séance${remainingSessions > 1 ? "s" : ""} restante${remainingSessions > 1 ? "s" : ""}`
                    : "Toutes les séances ont été réalisées"}
                </p>
              </div>
            {remainingSessions > 0 && training.trainer_booking_url ? (
              <a
                href={training.trainer_booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:-translate-y-0.5"
                style={{ background: "var(--st-yellow)", color: "#101820" }}
              >
                <CalendarPlus size={14} />
                Prendre rendez-vous →
              </a>
            ) : remainingSessions > 0 ? (
              <p className="text-sm p-3 rounded-xl" style={{ background: "var(--st-surface, #F2F4F4)", color: "var(--st-ink-muted)" }}>
                Contactez votre formateur pour planifier votre séance.
              </p>
            ) : null}
          </div>
      </TabsContent>
      )}
    </Tabs>
  );
}

export function FormationItem({
  training,
  email,
  questionnaire,
  evaluation,
}: {
  training: Training;
  email: string;
  questionnaire: Questionnaire | undefined;
  evaluation: Questionnaire | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const completion = training.lms_completion ?? 0;
  const isDone = completion >= 100;
  const hasStarted = !!training.last_lesson_id || completion > 0;
  const hasElearning = !!training.lms_course_id;

  const continueUrl = hasElearning
    ? `/lms/${training.lms_course_id}/home?email=${encodeURIComponent(email)}${training.last_lesson_id ? `&lesson=${training.last_lesson_id}` : ""}`
    : null;

  const hasDocuments = hasLearnerDocuments(training, questionnaire, evaluation);
  const hasCoaching = hasLearnerCoaching(training);
  const showTabs = hasDocuments || hasCoaching;

  const tabsLabel = ["Formation", hasDocuments ? "Documents" : null, hasCoaching ? "Coaching" : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        borderColor: "rgba(16,24,32,0.08)",
        background: "var(--st-white)",
        boxShadow: "0 2px 20px rgba(16,24,32,0.06)",
      }}
    >
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
                style={{ background: isDone ? "#dcfce7" : "#fffbea", color: isDone ? "#15803d" : "#854d0e" }}>
                {isDone ? "Terminée" : hasStarted ? "En cours" : "Non commencée"}
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
                    style={{ width: `${Math.min(completion, 100)}%`, background: "#FFD100" }} />
                </div>
              </div>
            )}
            {hasCoaching && (
              <CoachingCircles
                completed={training.coaching_sessions_completed ?? 0}
                total={training.coaching_sessions_total ?? 0}
              />
            )}
          </div>
        </div>

        {/* Actions — un seul style de bouton principal */}
        {hasElearning && continueUrl && (
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Link to={continueUrl}
              className="flex items-center justify-center gap-1.5 text-sm font-semibold px-5 py-2 rounded-full transition-all hover:-translate-y-0.5 w-full sm:w-auto"
              style={{ background: "var(--st-yellow)", color: "#101820" }}>
              {isDone
                ? <><RefreshCw size={13} /> Revoir</>
                : hasStarted
                  ? <><RotateCcw size={13} /> Reprendre</>
                  : <><Play size={13} /> Commencer</>}
            </Link>
            <Link to={`/lms/${training.lms_course_id}/home?email=${encodeURIComponent(email)}`}
              className="flex items-center justify-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full border transition-all hover:bg-black/5 w-full sm:w-auto"
              style={{ borderColor: "rgba(16,24,32,0.15)", color: "var(--st-ink)" }}>
              Accueil du cours
            </Link>
          </div>
        )}
      </div>

      {/* Onglets — uniquement s'il y a quelque chose à afficher */}
      {showTabs && (
        <div className="border-t" style={{ borderColor: "rgba(16,24,32,0.08)" }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center gap-2 px-5 py-3 text-sm transition-all hover:bg-black/5 text-left"
            style={{ color: "var(--st-ink-muted)", fontFamily: "inherit" }}
          >
            <span className="flex-1">{tabsLabel}</span>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {expanded && (
            <div className="px-5 pb-5">
              <TrainingDetail
                training={training}
                questionnaire={questionnaire}
                evaluation={evaluation}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tri : dernière activité (plus récent d'abord), puis non commencées,
 * puis terminées.
 */
export function sortLearnerTrainings(trainings: Training[]): Training[] {
  const rank = (t: Training) => {
    const pct = t.lms_completion ?? 0;
    if (pct >= 100) return 2;
    if (pct > 0 || t.last_activity_at || t.last_lesson_id) return 0;
    return 1;
  };
  return [...trainings].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    const ta = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
    const tb = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
    return tb - ta;
  });
}
