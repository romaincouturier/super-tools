import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { getInitials } from "@/lib/stringUtils";
import {
  GraduationCap, FileText, ClipboardCheck, Calendar,
  Download, ExternalLink, BookOpen, CheckCircle2, Clock,
  AlertCircle, MessageSquare, Video, Play, RotateCcw,
  Lock, ChevronRight, ChevronDown, LayoutDashboard,
  Palette, HelpCircle, LogOut, Bell, ArrowRight,
  CalendarPlus, Sparkles, Menu, X, Pencil, Camera,
  FileImage, Award, RefreshCw, BookmarkCheck, User2, Upload,
  ThumbsUp, Send, Trash2,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import SupertiltLogo from "@/components/SupertiltLogo";
import EmojiInsert from "@/components/ui/emoji-insert";
import PostComposer from "@/components/learner/community/PostComposer";
import PollDisplay from "@/components/learner/community/PollDisplay";
import PopularTopics from "@/components/learner/community/PopularTopics";
import ReturnToFormationCard from "@/components/learner/community/ReturnToFormationCard";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import LearnerMessaging from "@/components/learner/LearnerMessaging";
import LearnerLmsMessaging from "@/components/learner/LearnerLmsMessaging";
import AddToCalendarButton from "@/components/learner/AddToCalendarButton";
import { cn } from "@/lib/utils";
import { resolveContentType } from "@/lib/file-utils";
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
import { PEDAGOGICAL_STATUS_LABELS } from "@/types/lms-work-deposit";
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

// ── Types ────────────────────────────────────────────────────────────────────

interface NextEvent {
  id: string;
  title: string;
  scheduled_at: string;
  meeting_url: string | null;
  meeting_type: string;
  duration_minutes?: number | null;
  description?: string | null;
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
  coaching_sessions_completed?: number;
  coaching_sessions_total?: number;
  trainer_booking_url?: string | null;
  objectives?: string[];
  prerequisites?: string[];
  reglement_interieur_url?: string | null;
  trainer_name?: string | null;
  trainer_photo_url?: string | null;
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

type NavSection =
  | "dashboard" | "formations" | "recommandees" | "travaux"
  | "pratique" | "pratique_publications" | "pratique_commentaires" | "pratique_likes"
  | "aide" | "compte";

const SECTION_SLUGS: Record<NavSection, string | null> = {
  dashboard:    "tableau-de-bord",
  formations:   "mes-formations",
  recommandees: "formations-recommandees",
  travaux:      "mes-travaux",
  pratique:     "communaute",
  pratique_publications:  "communaute-mes-publications",
  pratique_commentaires:  "communaute-mes-commentaires",
  pratique_likes:         "communaute-mes-likes",
  aide:         "aide",
  compte:       null,
};

const SLUG_TO_SECTION: Record<string, NavSection> = {
  "tableau-de-bord":        "dashboard",
  "mes-formations":         "formations",
  "formations-recommandees": "recommandees",
  "mes-travaux":            "travaux",
  "communaute":             "pratique",
  "communaute-mes-publications": "pratique_publications",
  "communaute-mes-commentaires": "pratique_commentaires",
  "communaute-mes-likes":        "pratique_likes",
  "aide":                   "aide",
};

const PRATIQUE_SECTIONS: NavSection[] = ["pratique", "pratique_publications", "pratique_commentaires", "pratique_likes"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const eventTypeLabel: Record<string, string> = {
  launch: "Lancement",
  live: "Live",
  closing: "Dernière séance",
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


// ── Learner greeting dropdown ─────────────────────────────────────────────────

function LearnerGreetingDropdown({
  firstName,
  lastName,
  photoUrl,
  onNav,
  onLogout,
}: {
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  onNav: (s: NavSection) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    const confirmed = await confirm({
      title: "Se déconnecter",
      description: "Êtes-vous sûr de vouloir vous déconnecter ?",
      variant: "destructive",
    });
    if (confirmed) onLogout();
  };

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Apprenant";
  const initials = getInitials(firstName, lastName);

  const items: { label: string; icon: React.ElementType; section: NavSection }[] = [
    { label: "Mon compte", icon: User2, section: "compte" },
    { label: "Mes formations", icon: GraduationCap, section: "formations" },
    { label: "Mes formations recommandées", icon: Sparkles, section: "recommandees" },
    { label: "Aide", icon: HelpCircle, section: "aide" },
  ];

  return (
    <>
      <ConfirmDialog />
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all hover:bg-black/5"
          style={{ fontFamily: "inherit" }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: photoUrl ? "transparent" : "var(--st-yellow)", color: "#101820", overflow: "hidden" }}
          >
            {photoUrl ? <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" /> : initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>Bonjour</p>
            <p className="text-sm font-semibold leading-none" style={{ color: "var(--st-ink)" }}>{displayName}</p>
          </div>
          <ChevronDown size={13} className="hidden sm:block shrink-0 opacity-50" style={{ color: "var(--st-ink-muted)" }} />
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl border shadow-lg overflow-hidden z-50"
            style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.1)" }}
          >
            {items.map(({ label, icon: Icon, section }) => (
              <button
                key={section + label}
                onClick={() => { onNav(section); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-black/5"
                style={{ color: "var(--st-ink)", fontFamily: "inherit" }}
              >
                <Icon size={15} style={{ color: "var(--st-ink-muted)" }} />
                {label}
              </button>
            ))}
            <div style={{ borderTop: "1px solid rgba(16,24,32,0.08)" }}>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-red-50"
                style={{ color: "#ef4444", fontFamily: "inherit" }}
              >
                <LogOut size={15} />
                Se déconnecter
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
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

// ── Coaching circles ──────────────────────────────────────────────────────────

function CoachingCircles({ completed, total }: { completed: number; total: number }) {
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

// ── Edit profile modal ────────────────────────────────────────────────────────

function EditProfileModal({
  open,
  onClose,
  email,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  profile: LearnerProfile | null | undefined;
}) {
  const { toast } = useToast();
  const upsert = useUpsertLearnerProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [fonction, setFonction] = useState(profile?.fonction ?? "");
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url ?? "");
  const [uploading, setUploading] = useState(false);

  // Reset fields when profile loads or modal re-opens
  useEffect(() => {
    if (open) {
      setFirstName(profile?.first_name ?? "");
      setLastName(profile?.last_name ?? "");
      setFonction(profile?.fonction ?? "");
      setPhotoUrl(profile?.photo_url ?? "");
    }
  }, [open, profile]);

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

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        email,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        fonction: fonction.trim() || null,
        photo_url: photoUrl || null,
      });
      toast({ title: "Profil mis à jour" });
      onClose();
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur lors de la sauvegarde");
    }
  };

  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm w-full" style={{ fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif" }}>
        <DialogHeader>
          <DialogTitle>Mon profil</DialogTitle>
        </DialogHeader>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
            <div
              className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold select-none"
              style={{ background: photoUrl ? "transparent" : "#FFD100", color: "#101820" }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(16,24,32,0.45)" }}
            >
              {uploading ? (
                <Spinner className="text-white h-5 w-5" />
              ) : (
                <Camera size={20} className="text-white" />
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhotoFile(f);
              e.target.value = "";
            }}
          />
          <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
            Cliquez pour changer la photo
          </p>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ep-firstname">Prénom</Label>
              <Input
                id="ep-firstname"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prénom"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-lastname">Nom</Label>
              <Input
                id="ep-lastname"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-fonction">Fonction</Label>
            <Input
              id="ep-fonction"
              value={fonction}
              onChange={(e) => setFonction(e.target.value)}
              placeholder="Ex: Directeur artistique, Manager…"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={upsert.isPending || uploading}
          >
            {upsert.isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  active,
  onNav,
  firstName,
  lastName,
  fonction,
  photoUrl,
  email,
  onLogout,
  onEditProfile,
  mobile,
  onClose,
}: {
  active: NavSection;
  onNav: (s: NavSection) => void;
  firstName: string;
  lastName: string;
  fonction?: string | null;
  photoUrl?: string | null;
  email: string;
  onLogout: () => void;
  onEditProfile: () => void;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const navItems: Array<{ id: NavSection; label: string; icon: React.ElementType; subItems?: Array<{ id: NavSection; label: string; icon: React.ElementType }> }> = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "formations", label: "Mes formations", icon: BookOpen },
    { id: "recommandees", label: "Mes formations recommandées", icon: Sparkles },
    { id: "travaux", label: "Mes travaux", icon: FileText },
    {
      id: "pratique", label: "Communauté", icon: Palette,
      subItems: [
        { id: "pratique_publications", label: "Mes publications", icon: FileText },
        { id: "pratique_commentaires", label: "Mes commentaires", icon: MessageSquare },
        { id: "pratique_likes", label: "Mes likes", icon: ThumbsUp },
      ],
    },
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
        <SupertiltLogo className="h-9" />
        {mobile && onClose && (
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5">
            <X size={16} style={{ color: "var(--st-ink)" }} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon, subItems }) => {
          const subExpanded = subItems && PRATIQUE_SECTIONS.includes(active);
          return (
            <div key={id}>
              <button
                onClick={() => { onNav(id); onClose?.(); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                  active === id ? "text-[#101820]" : "hover:bg-black/5",
                )}
                style={active === id ? { background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" } : { fontFamily: "inherit", color: "var(--st-ink-muted)" }}
              >
                <Icon size={17} />
                {label}
              </button>
              {subExpanded && (
                <div className="mt-0.5 ml-4 pl-3 space-y-0.5 border-l" style={{ borderColor: "rgba(16,24,32,0.1)" }}>
                  {subItems!.map(({ id: sid, label: slabel, icon: SIcon }) => (
                    <button
                      key={sid}
                      onClick={() => { onNav(sid); onClose?.(); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left",
                        active === sid ? "font-semibold" : "hover:bg-black/5",
                      )}
                      style={active === sid ? { color: "#101820", background: "rgba(255,209,0,0.18)", fontFamily: "inherit" } : { fontFamily: "inherit", color: "var(--st-ink-muted)" }}
                    >
                      <SIcon size={15} />
                      {slabel}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User block */}
      <div className="px-3 pb-5 pt-3 border-t" style={{ borderColor: "rgba(16,24,32,0.08)" }}>
        <button
          onClick={onEditProfile}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all hover:bg-black/5 text-left"
          style={{ fontFamily: "inherit" }}
          title="Mon compte"
        >
          <div
            className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: photoUrl ? "transparent" : "var(--st-yellow)", color: "#101820" }}
          >
            {photoUrl ? (
              <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              getInitials(firstName, lastName)
            )}
          </div>
        </button>
      </div>
    </aside>
  );
}

// ── Training detail (documents / coaching) ────────────────────────────────────

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

  const coachingCompleted = training.coaching_sessions_completed ?? 0;
  const coachingTotal = training.coaching_sessions_total ?? 0;
  const remainingSessions = coachingTotal - coachingCompleted;

  return (
    <Tabs defaultValue="details" className="mt-4">
      <TabsList className="mb-3 bg-transparent gap-1 p-0 h-auto">
        {[
          { value: "details", label: "Formation", icon: GraduationCap },
          { value: "documents", label: "Documents", icon: FileText },
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

      <TabsContent value="coaching">
        {training.is_coached ? (
          <div className="space-y-4">
            {coachingTotal > 0 && (
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
            )}
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
            {training.is_coached && (training.coaching_sessions_total ?? 0) > 0 && (
              <CoachingCircles
                completed={training.coaching_sessions_completed ?? 0}
                total={training.coaching_sessions_total ?? 0}
              />
            )}
          </div>
        </div>

        {/* Actions */}
        {hasElearning && continueUrl && (
          <div className="flex flex-wrap gap-2 mt-4">
            {completion === 100 ? (
              <>
                <a
                  href="#"
                  className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2 rounded-full transition-all hover:-translate-y-0.5"
                  style={{ background: "var(--st-yellow)", color: "#101820" }}
                >
                  <Award size={13} /> Télécharger mon certificat
                </a>
                <Link to={continueUrl}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full border transition-all hover:bg-black/5"
                  style={{ borderColor: "rgba(16,24,32,0.15)", color: "var(--st-ink)" }}>
                  <RefreshCw size={13} /> Refaire la formation
                </Link>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Expand docs/coaching */}
      <div className="border-t" style={{ borderColor: "rgba(16,24,32,0.08)" }}>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 px-5 py-3 text-sm transition-all hover:bg-black/5 text-left"
          style={{ color: "var(--st-ink-muted)", fontFamily: "inherit" }}
        >
          <span className="flex-1">Formation · Documents · Coaching</span>
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

// ── Travaux view ──────────────────────────────────────────────────────────────

function pedagogicalStatusBadge(status: string) {
  let bg = "#f1f5f9";
  let color = "#475569";
  if (status === "feedback_received") { bg = "#dcfce7"; color = "#15803d"; }
  else if (status === "needs_completion") { bg = "#fef3c7"; color = "#92400e"; }
  else if (status === "validated") { bg = "#dbeafe"; color = "#1d4ed8"; }
  const label = PEDAGOGICAL_STATUS_LABELS[status as keyof typeof PEDAGOGICAL_STATUS_LABELS] ?? status;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: bg, color }}>
      {label}
    </span>
  );
}

function TravauxView({ email, trainings }: { email: string; trainings: Training[] }) {
  const { data: deposits = [], isLoading } = useLearnerWorkDeposits(email);
  const createDeposit = useCreatePortfolioDeposit();
  const deleteDeposit = useDeleteDeposit("", email);
  const { confirm, ConfirmDialog } = useConfirm();
  const { toast } = useToast();

  const handleDeleteDeposit = async (id: string) => {
    const ok = await confirm({
      title: "Supprimer ce travail ?",
      description: "Cette action est irréversible.",
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteDeposit.mutateAsync(id);
      toast({ title: "Travail supprimé" });
    } catch {
      toastError(toast, "Impossible de supprimer ce travail.");
    }
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [filterCourseId, setFilterCourseId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only trainings with an LMS course
  const lmsTrainings = trainings.filter((t) => !!t.lms_course_id);

  // Stats
  const totalDeposits = deposits.length;
  const retours = deposits.filter(
    (d: any) => d.pedagogical_status === "feedback_received" || d.pedagogical_status === "validated",
  ).length;
  const aCompleter = deposits.filter((d: any) => d.pedagogical_status === "needs_completion").length;

  // Filtered feed
  const filteredDeposits = filterCourseId
    ? deposits.filter((d: any) => d.course_id === filterCourseId)
    : deposits;

  // Learner initials from email
  const learnerInitials = email
    .split("@")[0]
    .split(/[._-]/)
    .map((w: string) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && resolveContentType(file).startsWith("image/")) handleFileSelect(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast({ title: "Veuillez sélectionner une image", variant: "destructive" });
      return;
    }
    try {
      await createDeposit.mutateAsync({
        file: selectedFile,
        caption,
        courseId: selectedCourseId || null,
        learnerEmail: email,
      });
      toast({ title: "Travail publié !" });
      setDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption("");
      setSelectedCourseId("");
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur lors du dépôt");
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      {/* CTA banner */}
      <div className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
        style={{ background: "var(--st-yellow-soft, #FFFBEA)", border: "1.5px solid var(--st-yellow, #FFD100)" }}>
        <div className="flex-1 space-y-1">
          <p className="font-bold text-base" style={{ color: "var(--st-ink)", fontFamily: "inherit" }}>
            Et si votre travail aidait quelqu'un d'autre ?
          </p>
          <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
            Par votre travail, vous aidez tous les autres participants. Voir les travaux des autres aide à oser et à se lancer. En partageant un travail même imparfait, nous progressons tous ensemble.
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="shrink-0 px-4 py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80"
          style={{ background: "var(--st-yellow, #FFD100)", color: "var(--st-ink)", fontFamily: "inherit" }}>
          Déposer un nouveau travail
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Stats sidebar */}
        <div className="lg:w-48 shrink-0 space-y-3">
          <div className="rounded-2xl border p-4 text-center"
            style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}>
            <p className="text-2xl font-bold" style={{ color: "var(--st-ink)" }}>{totalDeposits}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--st-ink-muted)" }}>déposés</p>
          </div>
          <div className="rounded-2xl border p-4 text-center"
            style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}>
            <p className="text-2xl font-bold" style={{ color: "var(--st-ink)" }}>{retours}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--st-ink-muted)" }}>retours</p>
          </div>
          <div className="rounded-2xl border p-4 text-center"
            style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}>
            <p className="text-2xl font-bold" style={{ color: "var(--st-ink)" }}>{aCompleter}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--st-ink-muted)" }}>à compléter</p>
          </div>
        </div>

        {/* Main feed */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Formation filter */}
          {lmsTrainings.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={filterCourseId}
                  onChange={(e) => setFilterCourseId(e.target.value)}
                  className="appearance-none rounded-xl border pl-3 pr-8 py-2 text-sm font-medium focus:outline-none"
                  style={{
                    background: "var(--st-white)",
                    borderColor: "rgba(16,24,32,0.12)",
                    color: "var(--st-ink)",
                    fontFamily: "inherit",
                  }}>
                  <option value="">Toutes les formations</option>
                  {lmsTrainings.map((t) => (
                    <option key={t.lms_course_id} value={t.lms_course_id!}>
                      {t.lms_course_title ?? t.training_name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--st-ink-muted)" }} />
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : filteredDeposits.length === 0 ? (
            <div className="rounded-2xl border p-10 text-center space-y-3"
              style={{ borderColor: "rgba(16,24,32,0.08)" }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
                style={{ background: "var(--st-surface, #F2F4F4)" }}>
                <FileText size={22} style={{ color: "var(--st-ink-muted)" }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--st-ink)" }}>Aucun travail déposé</p>
              <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
                Cliquez sur "Déposer un nouveau travail" pour partager votre premier travail.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDeposits.map((d: any) => {
                const courseTitle = d.lms_courses?.title ?? null;
                const lessonTitle = d.lms_lessons?.title ?? null;
                const lessonLink = d.lesson_id && d.course_id
                  ? `/lms/${d.course_id}/player?email=${encodeURIComponent(email)}&lesson=${d.lesson_id}`
                  : null;
                return (
                  <div key={d.id} className="rounded-2xl border overflow-hidden"
                    style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}>
                    {/* Post header */}
                    <div className="flex items-center gap-3 px-5 pt-4 pb-2">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                        style={{ background: "var(--st-yellow, #FFD100)", color: "var(--st-ink)" }}>
                        {learnerInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--st-ink)" }}>Mon travail</p>
                        <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
                          {format(new Date(d.created_at), "d MMM yyyy", { locale: fr })}
                        </p>
                      </div>
                      {pedagogicalStatusBadge(d.pedagogical_status)}
                      <button
                        onClick={() => handleDeleteDeposit(d.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors shrink-0"
                        style={{ color: "var(--st-ink-muted)" }}
                        title="Supprimer ce travail"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Image */}
                    {d.file_url && d.file_mime?.startsWith("image/") && (
                      <img src={d.file_url} alt={d.file_name ?? "travail"} className="w-full object-cover" style={{ maxHeight: 420 }} />
                    )}
                    {d.file_url && !d.file_mime?.startsWith("image/") && (
                      <div className="mx-5 mb-3 rounded-xl flex items-center gap-3 p-3"
                        style={{ background: "var(--st-surface, #F2F4F4)" }}>
                        <FileImage size={20} style={{ color: "var(--st-ink-muted)" }} />
                        <span className="text-sm truncate" style={{ color: "var(--st-ink)" }}>{d.file_name}</span>
                      </div>
                    )}

                    {/* Caption */}
                    {d.comment && (
                      <p className="px-5 py-2 text-sm" style={{ color: "var(--st-ink)" }}>{d.comment}</p>
                    )}

                    {/* Metadata */}
                    {(courseTitle || lessonTitle || lessonLink) && (
                      <div className="px-5 pb-4 pt-1 flex flex-wrap items-center gap-2">
                        {courseTitle && (
                          <span className="text-xs px-2 py-0.5 rounded-lg"
                            style={{ background: "var(--st-surface, #F2F4F4)", color: "var(--st-ink-muted)" }}>
                            {courseTitle}
                          </span>
                        )}
                        {lessonTitle && (
                          <span className="text-xs px-2 py-0.5 rounded-lg"
                            style={{ background: "var(--st-surface, #F2F4F4)", color: "var(--st-ink-muted)" }}>
                            {lessonTitle}
                          </span>
                        )}
                        {lessonLink && (
                          <a href={lessonLink} target="_blank" rel="noopener noreferrer"
                            className="text-xs font-medium ml-auto flex items-center gap-1 hover:opacity-70 transition-opacity"
                            style={{ color: "var(--st-ink)" }}>
                            Voir la leçon <ArrowRight size={12} />
                          </a>
                        )}
                      </div>
                    )}
                    {!courseTitle && !lessonTitle && !lessonLink && <div className="pb-4" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Deposit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg w-full">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "inherit" }}>Déposer un travail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Image upload area */}
            <div
              className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors hover:border-yellow-400"
              style={{
                borderColor: previewUrl ? "var(--st-yellow, #FFD100)" : "rgba(16,24,32,0.15)",
                background: "var(--st-surface, #F2F4F4)",
                minHeight: 180,
              }}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}>
              {previewUrl ? (
                <img src={previewUrl} alt="aperçu" className="w-full rounded-xl object-cover" style={{ maxHeight: 240 }} />
              ) : (
                <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                  <Upload size={28} style={{ color: "var(--st-ink-muted)" }} />
                  <p className="text-sm font-medium" style={{ color: "var(--st-ink)" }}>
                    Cliquez ou glissez une image
                  </p>
                  <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>PNG, JPG</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />

            {/* Caption */}
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Ajoutez un commentaire sur ce travail…"
              rows={3}
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2"
              style={{
                borderColor: "rgba(16,24,32,0.12)",
                fontFamily: "inherit",
                color: "var(--st-ink)",
                background: "var(--st-white)",
              }}
            />

            {/* Formation selector */}
            {lmsTrainings.length > 0 && (
              <div className="relative">
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full appearance-none rounded-xl border pl-3 pr-8 py-2.5 text-sm focus:outline-none"
                  style={{
                    borderColor: "rgba(16,24,32,0.12)",
                    fontFamily: "inherit",
                    color: "var(--st-ink)",
                    background: "var(--st-white)",
                  }}>
                  <option value="">Formation (optionnel)</option>
                  {lmsTrainings.map((t) => (
                    <option key={t.lms_course_id} value={t.lms_course_id!}>
                      {t.lms_course_title ?? t.training_name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--st-ink-muted)" }} />
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={createDeposit.isPending || !selectedFile}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: "var(--st-yellow, #FFD100)", color: "var(--st-ink)", fontFamily: "inherit" }}>
              {createDeposit.isPending ? "Publication…" : "Publier"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Pratique view ─────────────────────────────────────────────────────────────

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
  const { data: comments = [] } = usePracticeComments(showComments ? post.id : null, currentEmail);
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

function PratiqueView({ mode, email, courseIds, firstName, lastName, photoUrl, onNav }: {
  mode: "feed" | "mine" | "comments" | "likes";
  email: string;
  courseIds: string[];
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  onNav: (s: NavSection) => void;
}) {
  const { isAdmin } = useModuleAccess();
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
    if (selectedTag) return { tag: selectedTag };
    if (mode === "mine") return { authorEmail: email };
    if (mode === "likes") return { likedBy: email };
    return undefined;
  }, [mode, selectedTag, email]);

  const showDeposits = isFeed && !selectedTag;
  const { data: posts = [], isLoading } = usePracticePosts(email, 50, postsFilter);
  const { data: deposits = [], isLoading: depositsLoading } = usePracticeDeposits(showDeposits ? courseIds : [], email);
  const { data: popularTopics = [] } = usePracticePopularHashtags(email, 5);
  const { data: allTopics = [] } = usePracticePopularHashtags(email, 200);
  const { data: myComments = [] } = useMyPracticeComments(mode === "comments" ? email : null);

  const createPost = useCreatePracticePost(email);
  const toggleReaction = useTogglePracticeReaction(email);
  const toggleDepositReaction = useToggleDepositReaction(email);
  const deletePost = useDeletePracticePost(email, isAdmin);
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
  const { section: sectionSlug } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const sectionFromUrl: NavSection = (sectionSlug ? SLUG_TO_SECTION[sectionSlug] : undefined) ?? "dashboard";

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

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // Any authenticated user (learner OR staff/admin) can access the learner portal using their email.
      if (session?.user?.email) {
        if (!sectionSlug || !SLUG_TO_SECTION[sectionSlug]) {
          navigate("/espace-apprenant/tableau-de-bord", { replace: true });
        }
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

  const handleNav = (s: NavSection) => {
    const slug = SECTION_SLUGS[s];
    if (slug) {
      navigate(`/espace-apprenant/${slug}`);
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
        <Sidebar
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
            <Sidebar
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

      <EditProfileModal
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
