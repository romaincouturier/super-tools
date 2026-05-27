import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  GraduationCap, FileText, Calendar,
  BookOpen, CheckCircle2,
  AlertCircle, MessageSquare, Play, RotateCcw,
  ChevronRight, ChevronDown,
  Palette, HelpCircle, LogOut, Bell,
  Sparkles, Menu, Camera,
  FileImage, BookmarkCheck, User2,
  ThumbsUp, Send, Trash2,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import EmojiInsert from "@/components/ui/emoji-insert";
import PostComposer from "@/components/learner/community/PostComposer";
import PollDisplay from "@/components/learner/community/PollDisplay";
import PopularTopics from "@/components/learner/community/PopularTopics";
import ReturnToFormationCard from "@/components/learner/community/ReturnToFormationCard";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import AddToCalendarButton from "@/components/learner/AddToCalendarButton";
import {
  useLearnerProfile,
  useUpsertLearnerProfile,
  uploadLearnerPhoto,
  type LearnerProfile,
} from "@/hooks/useLearnerProfile";
import {
  useLearnerWorkDeposits,
  useCreatePortfolioDeposit,
  usePracticeDeposits,
  useLearnerReceivedComments,
  useCoursePageViews,
  useToggleDepositReaction,
} from "@/hooks/useLearnerPortalData";
import { useDepositComments, useCreateDepositComment, useDeleteDeposit } from "@/hooks/useLmsWorkDeposit";
import { useFaqItems } from "@/hooks/useFaq";
import { useCreateSupportTicket } from "@/hooks/useSupport";
import { useConfirm } from "@/hooks/useConfirm";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import {
  usePracticePosts, useCreatePracticePost, useTogglePracticeReaction,
  usePracticeComments, useCreatePracticeComment, useDeletePracticePost,
  useDeletePracticeComment, useVotePracticePoll, usePracticePopularHashtags,
  useMyPracticeComments, useLessonTitle, useCourseTitle,
  type PracticePost, type NewPoll,
} from "@/hooks/usePracticeFeed";

// ── Extracted components ──────────────────────────────────────────────────────
import {
  type Training, type LearnerData, type NavSection,
  SECTION_SLUGS, SLUG_TO_SECTION, PRATIQUE_SECTIONS, eventTypeLabel,
} from "@/types/learner-portal";
import { LearnerGreetingDropdown } from "@/components/learner/portal/LearnerGreetingDropdown";
import { LearnerEditProfileModal } from "@/components/learner/portal/LearnerEditProfileModal";
import { LearnerSidebar } from "@/components/learner/portal/LearnerSidebar";
import {
  progressMessage, ProgressCircle,
  FormationItem,
} from "@/components/learner/portal/LearnerTrainingCard";
import { TravauxView } from "@/components/learner/portal/TravauxView";
import { DashCard } from "@/components/learner/portal/DashCard";

const ADMIN_PREVIEW_EMAILS = new Set(["romain@supertilt.fr", "emmanuelle@supertilt.fr"]);

async function resolveCoursePreviewEmail(courseId: string, fallbackEmail?: string | null): Promise<string> {
  const { data: latestPost } = await (supabase as any)
    .from("practice_posts")
    .select("author_email")
    .eq("course_id", courseId)
    .not("author_email", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestPost?.author_email) return latestPost.author_email;

  const { data: participant } = await (supabase as any)
    .from("training_participants")
    .select("email, trainings!inner(supports_lms_course_id)")
    .eq("trainings.supports_lms_course_id", courseId)
    .not("email", "is", null)
    .order("added_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return participant?.email ?? fallbackEmail ?? "admin-preview@supertilt.fr";
}

// ── Practice feed helpers ─────────────────────────────────────────────────────

function authorDisplayName(email: string, firstName?: string | null, lastName?: string | null): string {
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  return email.split("@")[0];
}

function authorInitialsFromPost(email: string, firstName?: string | null, lastName?: string | null): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
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

  const lmsTrainings = data.trainings.filter((t) => t.lms_course_id);
  const mainTraining = lmsTrainings[0] ?? data.trainings[0];
  const globalPct = useMemo(() => {
    if (lmsTrainings.length === 0) return 0;
    return lmsTrainings.reduce((s, t) => s + (t.lms_completion ?? 0), 0) / lmsTrainings.length;
  }, [lmsTrainings]);

  const nextEventCtx = useMemo(() => {
    const now = new Date();
    const t = data.trainings
      .filter((t) => t.next_event && !t.is_permanent && new Date(t.next_event.scheduled_at) > now)
      .sort((a, b) =>
        new Date(a.next_event!.scheduled_at).getTime() - new Date(b.next_event!.scheduled_at).getTime()
      )[0];
    return t ? { event: t.next_event!, trainingName: t.training_name } : null;
  }, [data.trainings]);
  const nextEvent = nextEventCtx?.event ?? null;


  const courseIds = useMemo(
    () => data.trainings.filter((t) => t.lms_course_id).map((t) => t.lms_course_id!),
    [data.trainings]
  );

  // Hooks for dashboard blocks
  const { data: workDeposits = [] } = useLearnerWorkDeposits(data.email);
  const { data: receivedComments = [] } = useLearnerReceivedComments(data.email, courseIds);
  const { data: recentPosts = [] } = usePracticePosts(data.email, 3);
  const { data: viewedLessons = [] } = useCoursePageViews(
    mainTraining?.lms_course_id ?? null,
    data.email
  );

  const isClosing = nextEvent?.meeting_type === "closing";

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
            {mainTraining?.lms_course_id && globalPct < 100 && (
              <Link
                to={`/lms/${mainTraining.lms_course_id}/home?email=${encodeURIComponent(data.email)}${mainTraining.last_lesson_id ? `&lesson=${mainTraining.last_lesson_id}` : ""}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2 rounded-full transition-all hover:-translate-y-0.5"
                style={{ background: "var(--st-yellow)", color: "#101820" }}
              >
                {(!!mainTraining.last_lesson_id || globalPct > 0)
                  ? <><RotateCcw size={13} /> Reprendre</>
                  : <><Play size={13} /> Commencer</>}
              </Link>
            )}
          </div>
        </div>

        {/* Right — progress */}
        <div className="md:col-span-2 flex items-center justify-center md:justify-end gap-6">
          <div className="text-center">
            <ProgressCircle pct={globalPct} size={100} />
            <p className="text-xs mt-2 font-medium" style={{ color: "var(--st-ink-muted)" }}>
              Votre progression globale
            </p>
          </div>
        </div>
      </div>

      {/* Live banner */}
      {nextEvent && (
        <div className="rounded-2xl flex flex-wrap items-center gap-4 px-6 py-5"
          style={{ background: "#101820" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: isClosing ? "#e11d48" : "var(--st-yellow)" }}>
              <Calendar size={18} style={{ color: isClosing ? "#fff" : "#101820" }} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider"
                style={{ color: isClosing ? "#fda4af" : "var(--st-yellow)" }}>
                {eventTypeLabel[nextEvent.meeting_type] ?? "Prochain évènement"}
              </p>
              <p className="text-sm font-bold text-white">
                {nextEvent.title || "Live"} — {format(new Date(nextEvent.scheduled_at), "EEEE d MMM yyyy 'à' HH:mm", { locale: fr })}
              </p>
            </div>
          </div>
          <p className="text-sm flex-1 min-w-[160px]" style={{ color: "rgba(255,255,255,0.6)" }}>
            {isClosing ? "Votre dernière séance en direct avec votre formateur." : "Rencontre en direct avec votre formateur"}
          </p>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {nextEvent.meeting_url && (
              <a href={nextEvent.meeting_url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium px-4 py-2 rounded-full border transition-all hover:bg-white/10"
                style={{ borderColor: "rgba(255,255,255,0.2)", color: "#fff" }}>
                Rejoindre
              </a>
            )}
            <AddToCalendarButton
              title={nextEventCtx?.trainingName ? `${nextEventCtx.trainingName} — ${nextEvent.title || "Live"}` : (nextEvent.title || "Live formation")}
              startAt={nextEvent.scheduled_at}
              durationMinutes={nextEvent.duration_minutes || 60}
              description={nextEvent.description || (nextEvent.meeting_url ? `Lien de la réunion : ${nextEvent.meeting_url}` : "")}
              location={nextEvent.meeting_url || undefined}
              url={nextEvent.meeting_url || undefined}
              style={{
                background: isClosing ? "#e11d48" : "var(--st-yellow)",
                color: isClosing ? "#fff" : "#101820",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>
      )}

      {/* Main grid — Row 3: Mes formations (col-span-2) + right col */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left col (2/3) — Mes formations */}
        <div className="lg:col-span-2 space-y-4">
          <DashCard title="Mes formations" icon={GraduationCap} action={{ label: "Voir toutes mes formations", onClick: () => onNav("formations") }}>
            {data.trainings.length === 0 ? (
              <div className="py-6 text-center">
                <GraduationCap size={32} className="mx-auto mb-2" style={{ color: "var(--st-ink-muted)" }} />
                <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>Aucune formation trouvée.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.trainings.slice(0, 3).map((t, idx) => (
                  <FormationItem
                    key={t.training_id + t.participant_id}
                    training={t}
                    email={data.email}
                    questionnaire={data.questionnaires?.find((q) => q.training_id === t.training_id)}
                    evaluation={data.evaluations?.find((e) => e.training_id === t.training_id)}
                    onRequestCoach={onRequestCoach}
                    requestingCoach={requestingCoach}
                    primary={idx === 0}
                  />
                ))}
              </div>
            )}
          </DashCard>

          <DashCard title="Mes formations recommandées" icon={Sparkles}>
            <p className="text-sm py-2" style={{ color: "var(--st-ink-muted)" }}>
              Ici vous retrouverez toutes les formations recommandées pour votre profil.
            </p>
          </DashCard>
        </div>

        {/* Right col (1/3) — À faire ensuite + Mes travaux */}
        <div className="space-y-4">
          {/* À faire ensuite */}
          <DashCard title="À faire ensuite" icon={BookmarkCheck} action={{ label: "Voir toutes mes tâches", onClick: () => onNav("formations") }}>
            <NextLessonsBlock
              mainTraining={mainTraining ?? null}
              viewedLessons={viewedLessons}
              email={data.email}
            />
          </DashCard>

          {/* Mes derniers travaux */}
          <DashCard title="Mes derniers travaux" icon={FileText} action={{ label: "Voir tous mes travaux", onClick: () => onNav("travaux") }}>
            {workDeposits.length === 0 ? (
              <div className="py-3 text-center">
                <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>Aucun travail déposé pour l'instant.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {workDeposits.slice(0, 3).map((d: any) => (
                  <div key={d.id} className="flex items-center gap-3 p-2 rounded-xl transition-all hover:bg-black/5">
                    {d.file_mime?.startsWith("image/") ? (
                      <img src={d.file_url} alt={d.file_name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "var(--st-surface, #F2F4F4)" }}>
                        <FileImage size={16} style={{ color: "var(--st-ink-muted)" }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--st-ink)" }}>{d.file_name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{
                          background: d.publication_status === "published" ? "#dcfce7" : "#f1f5f9",
                          color: d.publication_status === "published" ? "#15803d" : "#475569",
                        }}>
                        {d.publication_status === "published" ? "Partagé" : "Privé"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashCard>
        </div>
      </div>

      {/* Row 4: Derniers retours + Osez partager + Aide rapide */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Derniers retours SuperTilt */}
        <DashCard title="Derniers retours SuperTilt" icon={MessageSquare}>
          {receivedComments.length === 0 ? (
            <div className="py-4 text-center">
              <div className="w-10 h-10 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: "var(--st-surface, #F2F4F4)" }}>
                <MessageSquare size={18} style={{ color: "var(--st-ink-muted)" }} />
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: "var(--st-ink)" }}>Aucun retour pour l'instant</p>
              <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
                Les retours de votre communauté apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {receivedComments.slice(0, 3).map((c: any) => {
                const initials = (c.learner_name || c.learner_email || "?")
                  .split(" ")
                  .map((w: string) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                const daysAgo = formatDistanceToNow(new Date(c.created_at), { locale: fr, addSuffix: true });
                return (
                  <div key={c.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: "var(--st-yellow)", color: "#101820" }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: "var(--st-ink)" }}>{c.content}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--st-ink-muted)" }}>{daysAgo}</p>
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => onNav("pratique")}
                className="text-xs font-medium transition-colors hover:opacity-70 mt-1"
                style={{ color: "var(--st-ink-muted)", fontFamily: "inherit" }}
              >
                Voir les retours →
              </button>
            </div>
          )}
        </DashCard>

        {/* Communauté */}
        <DashCard title="Communauté" icon={Palette} action={{ label: "Voir tous les posts", onClick: () => onNav("pratique") }}>
          {recentPosts.length === 0 ? (
            <div className="py-3 text-center">
              <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>Aucun post pour l'instant.</p>
              <button
                onClick={() => onNav("pratique")}
                className="mt-2 text-xs font-semibold underline"
                style={{ color: "var(--st-ink-muted)", fontFamily: "inherit" }}
              >
                Soyez le premier à publier →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPosts.map((post) => {
                const name = authorDisplayName(post.author_email, post.author_first_name, post.author_last_name);
                const initials = authorInitialsFromPost(post.author_email, post.author_first_name, post.author_last_name);
                return (
                  <div key={post.id} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: post.author_photo_url ? "transparent" : "var(--st-yellow)", color: "#101820" }}>
                      {post.author_photo_url
                        ? <img src={post.author_photo_url} alt={name} className="w-full h-full object-cover" />
                        : initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--st-ink)" }}>{name}</p>
                      {post.content && <p className="text-xs line-clamp-2 mt-0.5" style={{ color: "var(--st-ink-muted)" }}>{post.content}</p>}
                      {!post.content && post.file_url && <p className="text-xs mt-0.5 italic" style={{ color: "var(--st-ink-muted)" }}>A partagé une photo</p>}
                      <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: "var(--st-ink-muted)" }}>
                        <span>{post.reaction_count} j'aime</span>
                        <span>·</span>
                        <span>{post.comment_count} commentaires</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DashCard>

        {/* Aide rapide */}
        <DashCard title="Aide rapide" icon={HelpCircle}>
          <ul className="space-y-0.5">
            {[
              { label: "Accéder à l'aide", icon: HelpCircle, onClick: () => onNav("aide") },
              { label: "Voir mes notifications", icon: Bell, onClick: () => {} },
            ].map(({ label, icon: Icon, onClick }) => (
              <li key={label}>
                <button
                  onClick={onClick}
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
  );
}

// ── Next lessons block ────────────────────────────────────────────────────────

function NextLessonsBlock({
  mainTraining,
  viewedLessons,
  email,
}: {
  mainTraining: Training | null;
  viewedLessons: string[];
  email: string;
}) {
  if (!mainTraining?.lms_course_id) {
    return (
      <div className="py-3 text-center">
        <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>Aucune leçon en cours.</p>
      </div>
    );
  }

  const completedPct = mainTraining.lms_completion ?? 0;

  // Show viewed-but-not-completed lessons first, then not-yet-viewed info
  const inProgressCount = viewedLessons.length;
  const hasProgress = inProgressCount > 0 || completedPct > 0;

  if (!hasProgress) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--st-surface, #F2F4F4)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--st-yellow)" }}>
            <Play size={12} style={{ color: "#101820" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: "var(--st-ink)" }}>Commencer la formation</p>
            <p className="text-xs truncate" style={{ color: "var(--st-ink-muted)" }}>
              {mainTraining.lms_course_title || mainTraining.training_name}
            </p>
          </div>
          <Link
            to={`/lms/${mainTraining.lms_course_id}/home?email=${encodeURIComponent(email)}`}
            className="text-xs font-semibold shrink-0 px-2 py-1 rounded-lg"
            style={{ background: "var(--st-ink)", color: "#fff" }}
          >
            Démarrer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--st-surface, #F2F4F4)" }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--st-yellow)" }}>
          <RotateCcw size={12} style={{ color: "#101820" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium" style={{ color: "var(--st-ink)" }}>Reprendre la formation</p>
          <p className="text-xs truncate" style={{ color: "var(--st-ink-muted)" }}>
            {inProgressCount} leçon{inProgressCount > 1 ? "s" : ""} consultée{inProgressCount > 1 ? "s" : ""} · {Math.round(completedPct)}% terminé
          </p>
        </div>
        <Link
          to={`/lms/${mainTraining.lms_course_id}/home?email=${encodeURIComponent(email)}${mainTraining.last_lesson_id ? `&lesson=${mainTraining.last_lesson_id}` : ""}`}
          className="text-xs font-semibold shrink-0 px-2 py-1 rounded-lg"
          style={{ background: "var(--st-ink)", color: "#fff" }}
        >
          Continuer
        </Link>
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

// ── Post card ─────────────────────────────────────────────────────────────────

function PracticePostCard({
  post,
  currentEmail,
  isAdmin,
  onReact,
  onDelete,
  onVote,
  onSelectTag,
}: {
  post: PracticePost;
  currentEmail: string;
  isAdmin: boolean;
  onReact: (postId: string, iReacted: boolean) => void;
  onDelete: (postId: string) => void;
  onVote: (pollId: string, optionId: string, currentOptionId: string | null) => void;
  onSelectTag: (tag: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const { data: comments = [] } = usePracticeComments(showComments ? post.id : null, currentEmail, isAdmin);
  const createComment = useCreatePracticeComment(currentEmail);
  const deleteComment = useDeletePracticeComment(currentEmail, isAdmin);
  const { toast } = useToast();

  const displayName = authorDisplayName(post.author_email, post.author_first_name, post.author_last_name);
  const initials = authorInitialsFromPost(post.author_email, post.author_first_name, post.author_last_name);
  const isOwn = (post.author_email || "").toLowerCase() === (currentEmail || "").toLowerCase();
  const canDelete = isOwn || isAdmin;

  const handleComment = async () => {
    if (!commentText.trim()) return;
    try {
      await createComment.mutateAsync({ postId: post.id, content: commentText.trim() });
      setCommentText("");
    } catch {
      toastError(toast, "Impossible d'envoyer le commentaire.");
    }
  };

  return (
    <div className="rounded-2xl border space-y-0 overflow-hidden"
      style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: post.author_photo_url ? "transparent" : "var(--st-yellow)", color: "#101820" }}>
          {post.author_photo_url
            ? <img src={post.author_photo_url} alt={displayName} className="w-full h-full object-cover" />
            : initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight" style={{ color: "var(--st-ink)" }}>{displayName}</p>
          <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
            {formatDistanceToNow(new Date(post.created_at), { locale: fr, addSuffix: true })}
          </p>
        </div>
        {canDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors shrink-0"
            style={{ color: "var(--st-ink-muted)" }}
            title={isOwn ? "Supprimer mon message" : "Supprimer (admin)"}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Lesson origin badge */}
      {post.lesson_id && post.course_id && (
        <a
          href={`/lms/${post.course_id}/player?email=${encodeURIComponent(currentEmail)}&lesson=${post.lesson_id}`}
          className="mx-4 mb-3 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full hover:underline w-fit"
          style={{ background: "rgba(255,209,0,0.15)", color: "var(--st-ink)" }}
          title="Voir la leçon d'origine"
        >
          <BookOpen size={12} />
          <span>Depuis la leçon : <strong>{post.lesson_title ?? "voir"}</strong></span>
        </a>
      )}

      {/* Content */}
      {post.content && (
        <p className="px-4 pb-3 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--st-ink)" }}>
          {post.content}
        </p>
      )}

      {/* Media: image / video / file */}
      {post.file_url && (
        post.file_mime?.startsWith("image/") ? (
          <img src={post.file_url} alt={post.file_name ?? ""} className="w-full" style={{ maxHeight: 480, objectFit: "cover" }} />
        ) : post.file_mime?.startsWith("video/") ? (
          <video src={post.file_url} controls className="w-full" style={{ maxHeight: 480 }} />
        ) : (
          <a href={post.file_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 mx-4 mb-3 px-3 py-2.5 rounded-xl border text-sm font-medium hover:bg-black/5"
            style={{ borderColor: "rgba(16,24,32,0.12)", color: "var(--st-ink)" }}>
            <FileText size={16} /> {post.file_name ?? "Voir le fichier"}
          </a>
        )
      )}

      {/* Poll */}
      {post.poll && <PollDisplay poll={post.poll} onVote={onVote} />}

      {/* Hashtags */}
      {post.hashtags.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {post.hashtags.map((tag) => (
            <button
              key={tag}
              onClick={() => onSelectTag(tag)}
              className="text-xs px-2 py-0.5 rounded-full font-medium transition-colors hover:bg-black/5"
              style={{ background: "rgba(16,24,32,0.05)", color: "var(--st-ink-muted)" }}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Reaction bar */}
      {(post.reaction_count > 0 || post.comment_count > 0) && (
        <div className="px-4 py-2 flex items-center gap-3 text-xs border-t" style={{ borderColor: "rgba(16,24,32,0.06)", color: "var(--st-ink-muted)" }}>
          {post.reaction_count > 0 && (
            <span>{post.reaction_count} J'aime</span>
          )}
          {post.comment_count > 0 && (
            <button onClick={() => setShowComments(v => !v)} className="hover:underline ml-auto" style={{ fontFamily: "inherit" }}>
              {post.comment_count} commentaire{post.comment_count > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex border-t" style={{ borderColor: "rgba(16,24,32,0.06)" }}>
        <button
          onClick={() => onReact(post.id, post.i_reacted)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors hover:bg-black/5"
          style={{ color: post.i_reacted ? "var(--st-yellow, #FFD100)" : "var(--st-ink-muted)", fontFamily: "inherit" }}
        >
          <ThumbsUp size={16} fill={post.i_reacted ? "currentColor" : "none"} />
          J'aime
        </button>
        <button
          onClick={() => setShowComments(v => !v)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors hover:bg-black/5 border-l"
          style={{ color: "var(--st-ink-muted)", borderColor: "rgba(16,24,32,0.06)", fontFamily: "inherit" }}
        >
          <MessageSquare size={16} />
          Commenter
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "rgba(16,24,32,0.06)", background: "var(--st-surface, #F2F4F4)" }}>
          {comments.map((c) => {
            const cName = authorDisplayName(c.author_email, c.author_first_name, c.author_last_name);
            const cInitials = authorInitialsFromPost(c.author_email, c.author_first_name, c.author_last_name);
            const cIsOwn = (c.author_email || "").toLowerCase() === (currentEmail || "").toLowerCase();
            const cCanDelete = cIsOwn || isAdmin;
            const handleDeleteComment = async () => {
              if (!window.confirm("Supprimer ce commentaire ?")) return;
              try {
                await deleteComment.mutateAsync({ commentId: c.id, postId: post.id });
              } catch {
                toastError(toast, "Impossible de supprimer le commentaire.");
              }
            };
            return (
              <div key={c.id} className="flex items-start gap-2 group">
                <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: c.author_photo_url ? "transparent" : "var(--st-yellow)", color: "#101820" }}>
                  {c.author_photo_url
                    ? <img src={c.author_photo_url} alt={cName} className="w-full h-full object-cover" />
                    : cInitials}
                </div>
                <div className="flex-1 rounded-xl px-3 py-2" style={{ background: "var(--st-white)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold" style={{ color: "var(--st-ink)" }}>{cName}</p>
                    {cCanDelete && (
                      <button
                        onClick={handleDeleteComment}
                        className="p-1 rounded hover:bg-black/5 shrink-0 opacity-60 hover:opacity-100"
                        style={{ color: "var(--st-ink-muted)" }}
                        title={cIsOwn ? "Supprimer mon commentaire" : "Supprimer (admin)"}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: "var(--st-ink)" }}>{c.content}</p>
                </div>
              </div>
            );
          })}
          {/* Comment input */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-full border px-3 py-1.5"
              style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.12)" }}>
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleComment()}
                placeholder="Ajouter un commentaire..."
                className="flex-1 text-sm bg-transparent outline-none"
                style={{ color: "var(--st-ink)", fontFamily: "inherit" }}
              />
              <EmojiInsert onInsert={(e) => setCommentText((t) => t + e)} />
            </div>
            <button
              onClick={handleComment}
              disabled={!commentText.trim() || createComment.isPending}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
              style={{ background: "var(--st-yellow)", color: "#101820" }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Deposit feed card (shared work deposit surfaced in the community) ──────────
function DepositFeedCard({
  deposit,
  currentEmail,
  onReact,
}: {
  deposit: any;
  currentEmail: string;
  onReact: (depositId: string, iReacted: boolean) => void;
}) {
  const displayName = authorDisplayName(deposit.learner_email);
  const initials = authorInitialsFromPost(deposit.learner_email);
  const isImage = deposit.file_mime?.startsWith("image/");

  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const { data: comments = [] } = useDepositComments(showComments ? deposit.id : undefined, currentEmail);
  const createComment = useCreateDepositComment(deposit.id, currentEmail);
  const { toast } = useToast();

  const reactionCount = deposit.reaction_count ?? 0;
  const iReacted = !!deposit.i_reacted;
  const commentCount = deposit.comment_count ?? 0;

  const handleComment = async () => {
    if (!commentText.trim()) return;
    try {
      await createComment.mutateAsync(commentText.trim());
      setCommentText("");
    } catch {
      toastError(toast, "Impossible d'envoyer le commentaire.");
    }
  };

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}>
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: "var(--st-yellow)", color: "#101820" }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight" style={{ color: "var(--st-ink)" }}>{displayName}</p>
          <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
            A partagé un travail · {formatDistanceToNow(new Date(deposit.created_at), { locale: fr, addSuffix: true })}
          </p>
        </div>
      </div>
      {deposit.comment && (
        <p className="px-4 pb-3 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--st-ink)" }}>
          {deposit.comment}
        </p>
      )}
      {deposit.file_url && (isImage ? (
        <img src={deposit.file_url} alt={deposit.file_name ?? ""} className="w-full" style={{ maxHeight: 480, objectFit: "cover" }} />
      ) : (
        <a href={deposit.file_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-3 border-t text-sm font-medium hover:bg-black/5"
          style={{ borderColor: "rgba(16,24,32,0.06)", color: "var(--st-ink)" }}>
          <FileText size={16} /> {deposit.file_name ?? "Voir le fichier"}
        </a>
      ))}

      {(deposit.lesson_title || deposit.course_title) && deposit.lesson_id && deposit.course_id && (
        <Link
          to={`/lms/${deposit.course_id}/player?email=${encodeURIComponent(currentEmail)}&lesson=${deposit.lesson_id}`}
          className="block px-4 py-2.5 border-t text-xs hover:bg-black/5"
          style={{ borderColor: "rgba(16,24,32,0.06)", color: "var(--st-ink-muted)" }}
        >
          Depuis la leçon · <span className="font-medium" style={{ color: "var(--st-ink)" }}>{deposit.lesson_title ?? deposit.course_title}</span>
        </Link>
      )}

      {(reactionCount > 0 || commentCount > 0) && (
        <div className="px-4 py-2 flex items-center gap-3 text-xs border-t" style={{ borderColor: "rgba(16,24,32,0.06)", color: "var(--st-ink-muted)" }}>
          {reactionCount > 0 && <span>{reactionCount} J'aime</span>}
          {commentCount > 0 && (
            <button onClick={() => setShowComments((v) => !v)} className="hover:underline ml-auto">
              {commentCount} commentaire{commentCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      <div className="flex border-t" style={{ borderColor: "rgba(16,24,32,0.06)" }}>
        <button
          onClick={() => onReact(deposit.id, iReacted)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors hover:bg-black/5"
          style={{ color: iReacted ? "var(--st-yellow, #FFD100)" : "var(--st-ink-muted)", fontFamily: "inherit" }}
        >
          <ThumbsUp size={16} fill={iReacted ? "currentColor" : "none"} />
          J'aime
        </button>
        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors hover:bg-black/5 border-l"
          style={{ color: "var(--st-ink-muted)", borderColor: "rgba(16,24,32,0.06)", fontFamily: "inherit" }}
        >
          <MessageSquare size={16} />
          Commenter
        </button>
      </div>

      {showComments && (
        <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "rgba(16,24,32,0.06)", background: "var(--st-surface, #F2F4F4)" }}>
          {comments.map((c: any) => {
            const cName = authorDisplayName(c.author_email);
            const cInitials = authorInitialsFromPost(c.author_email);
            return (
              <div key={c.id} className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "var(--st-yellow)", color: "#101820" }}>
                  {cInitials}
                </div>
                <div className="flex-1 rounded-xl px-3 py-2" style={{ background: "var(--st-white)" }}>
                  <p className="text-xs font-semibold" style={{ color: "var(--st-ink)" }}>{cName}</p>
                  <p className="text-sm mt-0.5" style={{ color: "var(--st-ink)" }}>{c.content}</p>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-full border px-3 py-1.5"
              style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.12)" }}>
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleComment()}
                placeholder="Ajouter un commentaire..."
                className="flex-1 text-sm bg-transparent outline-none"
                style={{ color: "var(--st-ink)", fontFamily: "inherit" }}
              />
              <EmojiInsert onInsert={(e) => setCommentText((t) => t + e)} />
            </div>
            <button
              onClick={handleComment}
              disabled={!commentText.trim() || createComment.isPending}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
              style={{ background: "var(--st-yellow)", color: "#101820" }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PratiqueView ──────────────────────────────────────────────────────────────

function PratiqueView({ mode, email, courseIds, firstName, lastName, photoUrl, onNav, isAdminPreview }: {
  mode: "feed" | "mine" | "comments" | "likes";
  email: string;
  courseIds: string[];
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  onNav: (s: NavSection) => void;
  isAdminPreview?: boolean;
}) {
  const { isAdmin } = useModuleAccess();
  const canManageCommunity = isAdmin || !!isAdminPreview;
  const [searchParams] = useSearchParams();
  const [selectedTag, setSelectedTag] = useState<string | null>(searchParams.get("tag"));
  const [allTagsOpen, setAllTagsOpen] = useState(false);

  // Return-to-formation card: only when arriving from a formation/lesson link.
  const fromCourse = searchParams.get("fromCourse");
  const fromLesson = searchParams.get("fromLesson");
  const { data: fromLessonTitle } = useLessonTitle(email, fromLesson);
  const { data: fromCourseTitle } = useCourseTitle(email, fromCourse);
  const resumeTitle = fromLessonTitle ?? fromCourseTitle ?? null;
  const resumeHref = fromCourse
    ? (fromLesson
        ? `/lms/${fromCourse}/player?email=${encodeURIComponent(email)}&lesson=${fromLesson}`
        : `/lms/${fromCourse}/home?email=${encodeURIComponent(email)}`)
    : null;

  const isFeed = mode === "feed";

  const postsFilter = useMemo(() => {
    if (selectedTag) return fromCourse ? { tag: selectedTag, courseId: fromCourse } : { tag: selectedTag };
    if (mode === "mine") return fromCourse ? { authorEmail: email, courseId: fromCourse } : { authorEmail: email };
    if (mode === "likes") return fromCourse ? { likedBy: email, courseId: fromCourse } : { likedBy: email };
    if (fromCourse) return { courseId: fromCourse };
    return undefined;
  }, [mode, selectedTag, email, fromCourse]);

  const showDeposits = isFeed && !selectedTag;
  const { data: posts = [], isLoading } = usePracticePosts(email, 50, postsFilter, canManageCommunity);
  const { data: deposits = [], isLoading: depositsLoading } = usePracticeDeposits(showDeposits ? courseIds : [], email);
  const { data: popularTopics = [] } = usePracticePopularHashtags(email, 5);
  const { data: allTopics = [] } = usePracticePopularHashtags(email, 200);
  const { data: myComments = [] } = useMyPracticeComments(mode === "comments" ? email : null);

  const createPost = useCreatePracticePost(email);
  const toggleReaction = useTogglePracticeReaction(email);
  const toggleDepositReaction = useToggleDepositReaction(email);
  const deletePost = useDeletePracticePost(email, canManageCommunity);
  const votePoll = useVotePracticePoll(email);
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const feed = useMemo(() => {
    const items: Array<
      | { kind: "post"; key: string; created_at: string; post: PracticePost }
      | { kind: "deposit"; key: string; created_at: string; deposit: any }
    > = [
      ...posts.map((p) => ({ kind: "post" as const, key: `post_${p.id}`, created_at: p.created_at, post: p })),
      ...(showDeposits ? (deposits as any[]) : []).map((d) => ({ kind: "deposit" as const, key: `deposit_${d.id}`, created_at: d.created_at, deposit: d })),
    ];
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items;
  }, [posts, deposits, showDeposits]);

  const handleCreate = async (content: string, file: File | null, poll: NewPoll | null) => {
    await createPost.mutateAsync({ content, file, poll });
  };

  const handleReact = async (postId: string, iReacted: boolean) => {
    try { await toggleReaction.mutateAsync({ postId, iReacted }); }
    catch { toastError(toast, "Impossible de réagir."); }
  };

  const handleVote = (pollId: string, optionId: string, currentOptionId: string | null) => {
    votePoll.mutateAsync({ pollId, optionId, currentOptionId }).catch(() => toastError(toast, "Impossible de voter."));
  };

  const handleSelectTag = (tag: string) => {
    setAllTagsOpen(false);
    setSelectedTag(tag);
    if (mode !== "feed") onNav("pratique");
  };

  const handleDelete = async (postId: string) => {
    const ok = await confirm({
      title: "Supprimer ce post ?",
      description: "Cette action est irréversible.",
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    try { await deletePost.mutateAsync(postId); }
    catch { toastError(toast, "Impossible de supprimer."); }
  };

  const loading = isLoading || (showDeposits && depositsLoading);

  const emptyState = (label: string) => (
    <div className="rounded-2xl border p-10 text-center space-y-3"
      style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-white)" }}>
      <Palette size={32} className="mx-auto" style={{ color: "var(--st-ink-muted)" }} />
      <p className="text-sm font-medium" style={{ color: "var(--st-ink)" }}>{label}</p>
    </div>
  );

  const renderPostList = (emptyLabel: string) => (
    loading ? (
      <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
    ) : feed.length === 0 ? (
      emptyState(emptyLabel)
    ) : (
      <div className="space-y-4">
        {feed.map((item) =>
          item.kind === "post" ? (
            <PracticePostCard
              key={item.key}
              post={item.post}
              currentEmail={email}
              isAdmin={isAdmin}
              onReact={handleReact}
              onDelete={handleDelete}
              onVote={handleVote}
              onSelectTag={handleSelectTag}
            />
          ) : (
            <DepositFeedCard
              key={item.key}
              deposit={item.deposit}
              currentEmail={email}
              onReact={(depositId, iReacted) =>
                toggleDepositReaction.mutateAsync({ depositId, iReacted }).catch(() =>
                  toastError(toast, "Impossible de réagir."),
                )
              }
            />
          )
        )}
      </div>
    )
  );

  // ── Left column ──────────────────────────────────────────────────────────
  let leftContent: React.ReactNode;
  if (allTagsOpen) {
    leftContent = (
      <div className="space-y-3">
        <button onClick={() => setAllTagsOpen(false)} className="text-sm hover:underline" style={{ color: "var(--st-ink-muted)" }}>
          ← Retour au fil
        </button>
        <h2 className="text-lg font-bold" style={{ color: "var(--st-ink)" }}>Tous les sujets</h2>
        {allTopics.length === 0 ? emptyState("Aucun sujet pour l'instant.") : (
          <div className="rounded-2xl border divide-y" style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-white)" }}>
            {allTopics.map((t) => (
              <button key={t.tag} onClick={() => handleSelectTag(t.tag)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-black/5 text-left">
                <span className="text-sm font-medium" style={{ color: "var(--st-ink)" }}>#{t.tag}</span>
                <span className="text-xs" style={{ color: "var(--st-ink-muted)" }}>{t.post_count} publication{t.post_count > 1 ? "s" : ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  } else if (selectedTag) {
    leftContent = (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedTag(null)} className="text-sm hover:underline" style={{ color: "var(--st-ink-muted)" }}>
            ← Retour au fil
          </button>
          <h2 className="text-lg font-bold" style={{ color: "var(--st-ink)" }}>#{selectedTag}</h2>
        </div>
        {renderPostList("Aucune publication avec ce sujet.")}
      </div>
    );
  } else if (mode === "comments") {
    leftContent = myComments.length === 0 ? emptyState("Vous n'avez pas encore commenté.") : (
      <div className="space-y-3">
        {myComments.map((cm) => (
          <div key={cm.id} className="rounded-2xl border p-4 space-y-2" style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-white)" }}>
            <p className="text-sm" style={{ color: "var(--st-ink)" }}>{cm.content}</p>
            <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
              {formatDistanceToNow(new Date(cm.created_at), { locale: fr, addSuffix: true })}
              {cm.post_excerpt ? ` · sur « ${cm.post_excerpt.slice(0, 80)}${cm.post_excerpt.length > 80 ? "…" : ""} »` : ""}
            </p>
          </div>
        ))}
      </div>
    );
  } else if (mode === "mine") {
    leftContent = renderPostList("Vous n'avez encore rien publié.");
  } else if (mode === "likes") {
    leftContent = renderPostList("Vous n'avez encore aimé aucune publication.");
  } else {
    leftContent = (
      <>
        <PostComposer email={email} firstName={firstName} lastName={lastName} photoUrl={photoUrl} onCreate={handleCreate} />
        {renderPostList("Aucun post pour l'instant. Soyez le premier à partager !")}
      </>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <ConfirmDialog />
      <div className="min-w-0 space-y-4">{leftContent}</div>
      <div className="hidden lg:block">
        <div className="space-y-4 sticky top-4">
          {resumeHref && resumeTitle && (
            <ReturnToFormationCard lessonTitle={resumeTitle} resumeHref={resumeHref} />
          )}
          <PopularTopics
            topics={popularTopics}
            activeTag={selectedTag}
            onSelectTag={handleSelectTag}
            onSeeAll={() => { setSelectedTag(null); setAllTagsOpen(true); }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Compte view ───────────────────────────────────────────────────────────────

const NOTIF_PREFS: { key: keyof LearnerProfile & `email_notif_${string}`; label: string }[] = [
  { key: "email_notif_work_reply", label: "Me prévenir quand SuperTilt répond à un de mes travaux" },
  { key: "email_notif_work_comment", label: "Me prévenir quand quelqu'un commente un travail partagé" },
  { key: "email_notif_live", label: "Me prévenir avant les lives de mes formations" },
  { key: "email_notif_important", label: "Recevoir les informations importantes" },
];

function CompteView({
  email,
  profile,
  onNav,
  onLogout,
}: {
  email: string;
  profile: LearnerProfile | null | undefined;
  onNav: (s: NavSection) => void;
  onLogout: () => void;
}) {
  const { toast } = useToast();
  const upsert = useUpsertLearnerProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url ?? "");
  const [uploading, setUploading] = useState(false);

  const [notifs, setNotifs] = useState({
    email_notif_work_reply: profile?.email_notif_work_reply ?? true,
    email_notif_work_comment: profile?.email_notif_work_comment ?? true,
    email_notif_live: profile?.email_notif_live ?? true,
    email_notif_important: profile?.email_notif_important ?? true,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    setFirstName(profile?.first_name ?? "");
    setLastName(profile?.last_name ?? "");
    setPhotoUrl(profile?.photo_url ?? "");
    setNotifs({
      email_notif_work_reply: profile?.email_notif_work_reply ?? true,
      email_notif_work_comment: profile?.email_notif_work_comment ?? true,
      email_notif_live: profile?.email_notif_live ?? true,
      email_notif_important: profile?.email_notif_important ?? true,
    });
  }, [profile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.last_sign_in_at) {
        setLastSignIn(session.user.last_sign_in_at);
      }
    });
  }, []);

  const handlePhotoFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadLearnerPhoto(file, email);
      setPhotoUrl(url);
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur lors de l'upload de la photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await upsert.mutateAsync({
        email,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        photo_url: photoUrl || null,
      });
      toast({ title: "Informations enregistrées" });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur lors de la sauvegarde");
    }
  };

  const handleSaveNotifs = async () => {
    setSavingNotifs(true);
    try {
      await upsert.mutateAsync({ email, ...notifs });
      toast({ title: "Préférences enregistrées" });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur lors de la sauvegarde");
    } finally {
      setSavingNotifs(false);
    }
  };

  const handlePasswordReset = async () => {
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/apprenant/reset-password`,
      });
      if (error) throw error;
      toast({ title: "E-mail envoyé", description: "Vérifiez votre boîte mail pour réinitialiser votre mot de passe." });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur lors de l'envoi");
    } finally {
      setSendingReset(false);
    }
  };

  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || email[0].toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--st-ink)" }}>Mon compte</h2>
        <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
          Gérez vos informations personnelles, vos accès aux formations et vos préférences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left column */}
        <div className="space-y-5">
          {/* Informations personnelles */}
          <div className="rounded-2xl border p-6 space-y-5"
            style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-white)" }}>
            <div>
              <h3 className="text-base font-bold" style={{ color: "var(--st-ink)" }}>Informations personnelles</h3>
              <p className="text-sm mt-0.5" style={{ color: "var(--st-ink-muted)" }}>
                Ces informations sont utilisées dans votre espace de formation et dans les échanges avec SuperTilt.
              </p>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative group cursor-pointer shrink-0" onClick={() => fileRef.current?.click()}>
                <div
                  className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold select-none"
                  style={{ background: photoUrl ? "transparent" : "var(--st-yellow)", color: "#101820" }}
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : initials}
                </div>
                <div
                  className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(16,24,32,0.45)" }}
                >
                  {uploading ? <Spinner className="text-white h-4 w-4" /> : <Camera size={16} className="text-white" />}
                </div>
              </div>
              <input
                ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); e.target.value = ""; }}
              />
              <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>Cliquez sur la photo pour la modifier</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--st-ink-muted)" }}>Prénom</label>
                <input
                  type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Prénom"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: "rgba(16,24,32,0.12)", background: "var(--st-white)", color: "var(--st-ink)", fontFamily: "inherit" }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--st-ink-muted)" }}>Nom</label>
                <input
                  type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  placeholder="Nom"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: "rgba(16,24,32,0.12)", background: "var(--st-white)", color: "var(--st-ink)", fontFamily: "inherit" }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--st-ink-muted)" }}>Adresse e-mail</label>
              <div className="flex gap-2 items-center">
                <input
                  type="email" value={email} readOnly
                  className="flex-1 rounded-xl border px-3 py-2 text-sm cursor-not-allowed"
                  style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-surface, #F2F4F4)", color: "var(--st-ink-muted)", fontFamily: "inherit" }}
                />
                <p className="text-xs shrink-0" style={{ color: "var(--st-ink-muted)" }}>
                  Pour modifier, contactez SuperTilt.
                </p>
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={upsert.isPending || uploading}
              className="px-5 py-2 rounded-xl text-sm font-semibold transition-all hover:-translate-y-px disabled:opacity-50"
              style={{ background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" }}
            >
              {upsert.isPending ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>

          {/* Sécurité */}
          <div className="rounded-2xl border p-6 space-y-4"
            style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-white)" }}>
            <div>
              <h3 className="text-base font-bold" style={{ color: "var(--st-ink)" }}>Sécurité</h3>
              {lastSignIn && (
                <p className="text-sm mt-0.5" style={{ color: "var(--st-ink-muted)" }}>
                  Dernière connexion : {format(new Date(lastSignIn), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </p>
              )}
            </div>
            <button
              onClick={handlePasswordReset}
              disabled={sendingReset}
              className="px-5 py-2 rounded-xl text-sm font-semibold transition-all hover:-translate-y-px disabled:opacity-50"
              style={{ background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" }}
            >
              {sendingReset ? "Envoi en cours..." : "Modifier mon mot de passe"}
            </button>
          </div>

          {/* Besoin d'aide */}
          <div className="rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ background: "var(--st-yellow-soft, #FFFBEA)", border: "1px solid rgba(255,209,0,0.25)" }}>
            <div className="flex-1">
              <p className="text-base font-bold" style={{ color: "var(--st-ink)" }}>Besoin d'aide ?</p>
              <p className="text-sm mt-0.5" style={{ color: "rgba(16,24,32,0.65)" }}>
                Si vous avez un problème d'accès, de connexion ou une question sur votre formation, vous pouvez nous contacter.
              </p>
            </div>
            <button
              onClick={() => onNav("aide")}
              className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-px"
              style={{ background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" }}
            >
              Contacter SuperTilt
            </button>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Notifications */}
          <div className="rounded-2xl border p-5 space-y-4"
            style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-white)" }}>
            <div>
              <h3 className="text-base font-bold" style={{ color: "var(--st-ink)" }}>Notifications par e-mail</h3>
              <p className="text-sm mt-0.5" style={{ color: "var(--st-ink-muted)" }}>
                Choisissez les informations que vous souhaitez recevoir.
              </p>
            </div>
            <ul className="space-y-3">
              {NOTIF_PREFS.map(({ key, label }) => (
                <li key={key} className="flex items-start gap-3">
                  <button
                    role="checkbox"
                    aria-checked={notifs[key]}
                    onClick={() => setNotifs((p) => ({ ...p, [key]: !p[key] }))}
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors border"
                    style={{
                      background: notifs[key] ? "var(--st-yellow)" : "transparent",
                      borderColor: notifs[key] ? "var(--st-yellow)" : "rgba(16,24,32,0.2)",
                    }}
                  >
                    {notifs[key] && (
                      <CheckCircle2 size={12} style={{ color: "#101820" }} />
                    )}
                  </button>
                  <span className="text-sm leading-snug" style={{ color: "var(--st-ink)" }}>{label}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={handleSaveNotifs}
              disabled={savingNotifs}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-px disabled:opacity-50"
              style={{ background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" }}
            >
              {savingNotifs ? "Enregistrement..." : "Enregistrer mes préférences"}
            </button>
          </div>
        </div>
      </div>

      {/* Déconnexion */}
      <div className="rounded-2xl border p-5 flex items-center justify-between gap-4"
        style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-white)" }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--st-ink)" }}>Se déconnecter</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--st-ink-muted)" }}>Vous serez redirigé vers la page de connexion.</p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all hover:bg-red-50 hover:border-red-200 hover:text-red-600 shrink-0"
          style={{ borderColor: "rgba(16,24,32,0.15)", color: "var(--st-ink-muted)", fontFamily: "inherit" }}
        >
          <LogOut size={14} />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

// ── Aide view ────────────────────────────────────────────────────────────────

const LEARNER_CATEGORIES = [
  { value: "acces_connexion", label: "Accès / Connexion" },
  { value: "technique", label: "Problème technique" },
  { value: "pedagogique", label: "Question pédagogique" },
  { value: "administratif", label: "Administratif" },
];

const USEFUL_LINKS: { label: string; icon: React.ElementType; section: NavSection }[] = [
  { label: "Mon compte", icon: User2, section: "dashboard" },
  { label: "Mes formations", icon: GraduationCap, section: "formations" },
  { label: "Mes travaux", icon: FileText, section: "travaux" },
];

function AideView({
  email,
  mainTraining,
  onNav,
}: {
  email: string;
  mainTraining: Training | null;
  onNav: (section: NavSection) => void;
}) {
  const { data: faqItems = [] } = useFaqItems(true);
  const createTicket = useCreateSupportTicket();
  const { toast } = useToast();

  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    try {
      await createTicket.mutateAsync({
        type: "evolution",
        priority: "low",
        title: subject.trim(),
        description: message.trim(),
        page_url: null,
        learner_category: category || null,
      });
      toast({ title: "Demande envoyée", description: "Nous vous répondrons dans les plus brefs délais." });
      setCategory("");
      setSubject("");
      setMessage("");
    } catch {
      toastError(toast, "Impossible d'envoyer la demande.");
    } finally {
      setSending(false);
    }
  };

  const hasLive = !!mainTraining?.next_event;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--st-ink)" }}>Aide</h2>
        <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
          Retrouvez ici les réponses aux questions les plus fréquentes.<br />
          Si vous ne trouvez pas la réponse, vous pouvez nous envoyer un message.
        </p>
      </div>

      {/* Banner */}
      <div className="rounded-2xl p-5 flex items-center gap-5"
        style={{ background: "var(--st-yellow-soft, #FFFBEA)", border: "1px solid rgba(16,24,32,0.06)" }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--st-yellow)", color: "#101820" }}>
          <HelpCircle size={26} />
        </div>
        <div>
          <p className="text-base font-bold" style={{ color: "var(--st-ink)" }}>Comment pouvons-nous vous aider ?</p>
          <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
            Choisissez une question fréquente ou envoyez-nous un message ci-dessous.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Left: FAQ */}
        <div className="rounded-2xl border p-6 space-y-1"
          style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-white)" }}>
          <p className="text-base font-bold mb-4" style={{ color: "var(--st-ink)" }}>Questions fréquentes</p>
          {faqItems.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
              Aucune question pour le moment.
            </p>
          ) : (
            faqItems.map((item) => (
              <div key={item.id} className="border-b last:border-0"
                style={{ borderColor: "rgba(16,24,32,0.06)" }}>
                <button
                  className="w-full flex items-center justify-between py-3 text-sm font-medium text-left gap-3"
                  style={{ color: "var(--st-ink)", fontFamily: "inherit" }}
                  onClick={() => setOpenFaq(openFaq === item.id ? null : item.id)}
                >
                  <span>{item.question}</span>
                  {openFaq === item.id
                    ? <ChevronDown size={16} style={{ color: "var(--st-ink-muted)", flexShrink: 0 }} />
                    : <ChevronRight size={16} style={{ color: "var(--st-ink-muted)", flexShrink: 0 }} />
                  }
                </button>
                {openFaq === item.id && (
                  <p className="text-sm pb-3 leading-relaxed" style={{ color: "var(--st-ink-muted)" }}>
                    {item.answer}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Contact form */}
          <div className="rounded-2xl border p-5 space-y-4"
            style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-white)" }}>
            <p className="text-base font-bold" style={{ color: "var(--st-ink)" }}>Besoin d'une aide plus précise ?</p>
            <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
              Envoyez-nous un message, notre équipe vous répondra dans les plus brefs délais.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--st-ink-muted)" }}>
                  Type de demande
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{
                    borderColor: "rgba(16,24,32,0.12)",
                    background: "var(--st-white)",
                    color: category ? "var(--st-ink)" : "var(--st-ink-muted)",
                    fontFamily: "inherit",
                  }}
                >
                  <option value="">Sélectionnez un type</option>
                  {LEARNER_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--st-ink-muted)" }}>Sujet</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex : Problème d'accès à ma formation"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{
                    borderColor: "rgba(16,24,32,0.12)",
                    background: "var(--st-white)",
                    color: "var(--st-ink)",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--st-ink-muted)" }}>Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Décrivez votre question ou votre problème en détail..."
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2 text-sm resize-none"
                  style={{
                    borderColor: "rgba(16,24,32,0.12)",
                    background: "var(--st-white)",
                    color: "var(--st-ink)",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <button
                onClick={handleSend}
                disabled={!subject.trim() || !message.trim() || sending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-px disabled:opacity-50"
                style={{ background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" }}
              >
                {sending ? "Envoi en cours..." : "Envoyer ma demande"}
              </button>
            </div>
          </div>

          {/* Useful links */}
          <div className="rounded-2xl border p-5"
            style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-white)" }}>
            <p className="text-base font-bold mb-3" style={{ color: "var(--st-ink)" }}>Liens utiles</p>
            <ul className="space-y-0.5">
              {USEFUL_LINKS.map(({ label, icon: Icon, section }) => (
                <li key={section}>
                  <button
                    onClick={() => onNav(section)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm transition-all hover:bg-black/5 text-left"
                    style={{ color: "var(--st-ink)", fontFamily: "inherit" }}
                  >
                    <Icon size={15} style={{ color: "var(--st-ink-muted)", flexShrink: 0 }} />
                    <span className="flex-1">{label}</span>
                    <ChevronRight size={14} style={{ color: "var(--st-ink-muted)" }} />
                  </button>
                </li>
              ))}
              {hasLive && (
                <li>
                  <button
                    onClick={() => onNav("formations")}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm transition-all hover:bg-black/5 text-left"
                    style={{ color: "var(--st-ink)", fontFamily: "inherit" }}
                  >
                    <Calendar size={15} style={{ color: "var(--st-ink-muted)", flexShrink: 0 }} />
                    <span className="flex-1">Voir les dates des lives</span>
                    <ChevronRight size={14} style={{ color: "var(--st-ink-muted)" }} />
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LearnerPortal() {
  const [searchParams] = useSearchParams();
  const { section: sectionSlug } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const sectionFromUrl: NavSection = (sectionSlug ? SLUG_TO_SECTION[sectionSlug] : undefined) ?? "dashboard";
  const isAdminCoursePreview = !!searchParams.get("fromCourse") && (
    searchParams.get("preview") === "admin" ||
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.startsWith("id-preview--")
  );

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LearnerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestingCoach, setRequestingCoach] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>(sectionFromUrl);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Sync URL → state when navigating via browser back/forward
  useEffect(() => {
    setActiveSection(sectionFromUrl);
  }, [sectionFromUrl]);

  const email = data?.email ?? null;
  const { data: learnerProfile } = useLearnerProfile(email);

  useEffect(() => {
    const token = searchParams.get("token");
    const previewEmail = searchParams.get("preview_email");
    const fromCourse = searchParams.get("fromCourse");
    const isLovablePreviewHost = window.location.hostname.includes("lovableproject.com") || window.location.hostname.startsWith("id-preview--");
    const isAdminPreview = isLovablePreviewHost && (searchParams.get("preview") === "admin" || !!fromCourse);

    let cancelled = false;

    const isStaff = async (userId: string, email?: string | null) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, is_admin")
        .eq("user_id", userId)
        .maybeSingle();
      return !!profile || ADMIN_PREVIEW_EMAILS.has((email ?? "").toLowerCase());
    };

    const proceedWithSession = async (
      session: { user: { id: string; email?: string | null } } | null
    ): Promise<boolean> => {
      if (!session?.user?.email) return false;
      const staff = await isStaff(session.user.id, session.user.email);
      // Staff/admin can preview as any learner via ?preview_email=
      const emailToLoad = staff && fromCourse
        ? await resolveCoursePreviewEmail(fromCourse, previewEmail)
        : (staff && previewEmail ? previewEmail : session.user.email);
      if (cancelled) return true;
      if (staff) sessionStorage.setItem("learner_email", emailToLoad);
      if (!sectionSlug || !SLUG_TO_SECTION[sectionSlug]) {
        const qs = previewEmail ? `?preview_email=${encodeURIComponent(previewEmail)}` : (isAdminPreview ? "?preview=admin" : "");
        navigate(`/espace-apprenant/tableau-de-bord${qs}`, { replace: true });
      }
      if (staff && fromCourse) {
        loadAdminPreviewData(emailToLoad, fromCourse);
      } else {
        loadData(emailToLoad);
      }
      return true;
    };

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (await proceedWithSession(session)) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (await proceedWithSession(user ? { user } : null)) return;

      if (isAdminPreview && fromCourse) {
        const emailToLoad = await resolveCoursePreviewEmail(fromCourse, previewEmail);
        sessionStorage.setItem("learner_email", emailToLoad);
        loadAdminPreviewData(emailToLoad, fromCourse);
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

      // No session yet: give Supabase a brief window to hydrate (e.g. new tab
      // opened from "Aperçu" where getSession races storage). If a session
      // arrives, treat staff/admin as a valid viewer instead of bouncing to /apprenant.
      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
        if (cancelled) return;
        if (s?.user) {
          await proceedWithSession(s);
        }
      });

      setTimeout(() => {
        if (cancelled) return;
        sub.subscription.unsubscribe();
        supabase.auth.getSession().then(async ({ data: { session: s2 } }) => {
          if (cancelled) return;
          let ok = await proceedWithSession(s2);
          if (!ok) {
            const { data: { user: u2 } } = await supabase.auth.getUser();
            ok = await proceedWithSession(u2 ? { user: u2 } : null);
          }
          if (!ok && isAdminPreview && fromCourse) {
            const emailToLoad = await resolveCoursePreviewEmail(fromCourse, previewEmail);
            sessionStorage.setItem("learner_email", emailToLoad);
            loadAdminPreviewData(emailToLoad, fromCourse);
            return;
          }
          if (!ok) navigate("/apprenant");
        });
      }, 2500);
    };

    init();

    return () => { cancelled = true; };
  }, [searchParams, navigate, sectionSlug]);

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

  const loadAdminPreviewData = async (email: string, courseId: string) => {
    try {
      const { data: course } = await supabase
        .from("lms_courses")
        .select("title")
        .eq("id", courseId)
        .maybeSingle();
      setData({
        email,
        trainings: [{
          training_id: courseId,
          training_name: (course as { title?: string } | null)?.title ?? "Formation en aperçu",
          start_date: null,
          end_date: null,
          location: null,
          format: "E-learning",
          participant_id: "admin-preview",
          first_name: "Admin",
          last_name: "",
          needs_survey_status: null,
          evaluation_status: null,
          lms_course_id: courseId,
          lms_course_title: (course as { title?: string } | null)?.title ?? "Formation en aperçu",
        }],
        questionnaires: [],
        evaluations: [],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? "Erreur inconnue";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleNav = (s: NavSection) => {
    const slug = SECTION_SLUGS[s];
    if (slug) {
      const previewEmail = searchParams.get("preview_email");
      const fromCourse = searchParams.get("fromCourse");
      const params = new URLSearchParams();
      if (previewEmail) params.set("preview_email", previewEmail);
      if (fromCourse) params.set("fromCourse", fromCourse);
      const qs = params.toString() ? `?${params.toString()}` : "";
      navigate(`/espace-apprenant/${slug}${qs}`);
    } else {
      setActiveSection(s);
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("learner_email");
    await supabase.auth.signOut();
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

  const firstName = learnerProfile?.first_name || data.trainings[0]?.first_name || "";
  const lastName = learnerProfile?.last_name || data.trainings[0]?.last_name || "";
  const fonction = learnerProfile?.fonction || null;
  const photoUrl = learnerProfile?.photo_url || null;

  const lmsTrainings = data.trainings.filter((t) => t.lms_course_id);
  const mainTraining = lmsTrainings[0] ?? data.trainings[0] ?? null;

  const sectionTitle: Record<NavSection, string> = {
    dashboard: "Tableau de bord",
    formations: "Mes formations",
    recommandees: "Mes formations recommandées",
    travaux: "Mes travaux",
    pratique: "Communauté",
    pratique_publications: "Mes publications",
    pratique_commentaires: "Mes commentaires",
    pratique_likes: "Mes likes",
    aide: "Aide",
    compte: "Mon compte",
  };
  const sectionSubtitle: Record<NavSection, string> = {
    dashboard: "Retrouvez vos formations, votre progression et vos prochains rendez-vous.",
    formations: "Toutes vos formations, documents et coaching.",
    recommandees: "Formations sélectionnées pour votre profil.",
    travaux: "Tous vos travaux déposés dans vos cours.",
    pratique: "Découvrez les travaux partagés par la communauté.",
    pratique_publications: "Vos messages publiés dans la communauté.",
    pratique_commentaires: "Tous les commentaires que vous avez laissés.",
    pratique_likes: "Les publications que vous avez aimées.",
    aide: "Ressources et contact.",
    compte: "Gérez vos informations personnelles et vos préférences.",
  };

  const courseIds = data.trainings
    .filter((t) => t.lms_course_id)
    .map((t) => t.lms_course_id!);

  return (
    <div className="flex h-screen overflow-hidden"
      style={{ fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif", background: "var(--st-surface, #F2F4F4)" }}>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col shrink-0" style={{ width: 240 }}>
        <LearnerSidebar
          active={activeSection}
          onNav={handleNav}
          firstName={firstName}
          lastName={lastName}
          fonction={fonction}
          photoUrl={photoUrl}
          email={data.email}
          onLogout={handleLogout}
          onEditProfile={() => setActiveSection("compte")}
        />
      </div>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div className="lg:hidden fixed left-0 top-0 bottom-0 z-50" style={{ width: 260 }}>
            <LearnerSidebar
              active={activeSection}
              onNav={(s) => { setSidebarOpen(false); handleNav(s); }}
              firstName={firstName}
              lastName={lastName}
              fonction={fonction}
              photoUrl={photoUrl}
              email={data.email}
              onLogout={handleLogout}
              onEditProfile={() => { setSidebarOpen(false); setActiveSection("compte"); }}
              mobile
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </>
      )}

      <LearnerEditProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        email={data.email}
        profile={learnerProfile}
      />

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

          <button
            type="button"
            title="Vous n'avez pas eu de retour sur vos travaux"
            aria-label="Notifications"
            className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full transition-colors hover:bg-black/5 shrink-0"
          >
            <Bell size={18} style={{ color: "var(--st-ink)" }} />
          </button>

          <LearnerGreetingDropdown
            firstName={firstName}
            lastName={lastName}
            photoUrl={photoUrl}
            onNav={handleNav}
            onLogout={handleLogout}
          />

        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            {activeSection === "dashboard" && (
              <DashboardView
                data={data}
                onRequestCoach={handleRequestCoach}
                requestingCoach={requestingCoach}
                onNav={handleNav}
              />
            )}
            {activeSection === "formations" && (
              <FormationsView
                data={data}
                onRequestCoach={handleRequestCoach}
                requestingCoach={requestingCoach}
              />
            )}
            {activeSection === "recommandees" && (
              <div className="py-4">
                <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
                  Ici vous retrouverez toutes les formations recommandées pour votre profil.
                </p>
              </div>
            )}
            {activeSection === "travaux" && (
              <TravauxView email={data.email} trainings={data.trainings} />
            )}
            {PRATIQUE_SECTIONS.includes(activeSection) && (
              <PratiqueView
                mode={
                  activeSection === "pratique_publications" ? "mine"
                  : activeSection === "pratique_commentaires" ? "comments"
                  : activeSection === "pratique_likes" ? "likes"
                  : "feed"
                }
                email={data.email}
                courseIds={courseIds}
                firstName={firstName}
                lastName={lastName}
                photoUrl={photoUrl}
                onNav={handleNav}
                isAdminPreview={isAdminCoursePreview}
              />
            )}
            {activeSection === "aide" && (
              <AideView email={data.email} mainTraining={mainTraining} onNav={handleNav} />
            )}
            {activeSection === "compte" && (
              <CompteView email={data.email} profile={learnerProfile} onNav={handleNav} onLogout={handleLogout} />
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
