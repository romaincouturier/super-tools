import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  GraduationCap, FileText, ClipboardCheck, Calendar,
  Download, ExternalLink, BookOpen, CheckCircle2, Clock,
  AlertCircle, MessageSquare, Video, Play, RotateCcw,
  Lock, ChevronRight, ChevronDown, LayoutDashboard,
  Palette, HelpCircle, LogOut, Bell, ArrowRight,
  CalendarPlus, Sparkles, Menu, X, Pencil, Camera,
  FileImage, Award, RefreshCw, BookmarkCheck,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import SupertiltLogo from "@/components/SupertiltLogo";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import LearnerMessaging from "@/components/learner/LearnerMessaging";
import LearnerLmsMessaging from "@/components/learner/LearnerLmsMessaging";
import { cn } from "@/lib/utils";
import {
  useLearnerProfile,
  useUpsertLearnerProfile,
  uploadLearnerPhoto,
  type LearnerProfile,
} from "@/hooks/useLearnerProfile";
import {
  useLearnerWorkDeposits,
  usePracticeDeposits,
  useLearnerReceivedComments,
  useCoursePageViews,
} from "@/hooks/useLearnerPortalData";

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
  coaching_sessions_completed?: number;
  coaching_sessions_total?: number;
  trainer_booking_url?: string | null;
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

type NavSection = "dashboard" | "formations" | "travaux" | "pratique" | "aide";

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
  const navItems: Array<{ id: NavSection; label: string; icon: React.ElementType }> = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "formations", label: "Mes formations", icon: BookOpen },
    { id: "travaux", label: "Mes travaux", icon: FileText },
    { id: "pratique", label: "Espace de pratique", icon: Palette },
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
        <button
          onClick={onEditProfile}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all hover:bg-black/5 group text-left"
          style={{ fontFamily: "inherit" }}
          title="Modifier mon profil"
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
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug truncate" style={{ color: "var(--st-ink)" }}>
              {firstName} {lastName}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--st-ink-muted)" }}>
              {fonction || "Apprenant·e"}
            </p>
          </div>
          <Pencil size={13} className="shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: "var(--st-ink-muted)" }} />
        </button>
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
    <Tabs defaultValue="documents" className="mt-4">
      <TabsList className="mb-3 bg-transparent gap-1 p-0 h-auto">
        {[
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
          <span className="flex-1">Documents · Coaching</span>
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

  const courseIds = useMemo(
    () => data.trainings.filter((t) => t.lms_course_id).map((t) => t.lms_course_id!),
    [data.trainings]
  );

  // Hooks for dashboard blocks
  const { data: workDeposits = [] } = useLearnerWorkDeposits(data.email);
  const { data: receivedComments = [] } = useLearnerReceivedComments(data.email, courseIds);
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
            <button
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-all hover:-translate-y-px"
              style={{ background: isClosing ? "#e11d48" : "var(--st-yellow)", color: isClosing ? "#fff" : "#101820", fontFamily: "inherit" }}>
              <CalendarPlus size={14} />
              Ajouter au calendrier
            </button>
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

        {/* Osez partager */}
        <div className="rounded-2xl p-5" style={{ background: "var(--st-yellow-soft, #FFFBEA)", border: "1px solid rgba(255,209,0,0.25)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} style={{ color: "#101820" }} />
            <p className="text-sm font-semibold" style={{ color: "#101820" }}>Osez partager vos réalisations</p>
          </div>
          <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(16,24,32,0.7)" }}>
            Partagez vos travaux avec la communauté pour recevoir des retours et progresser plus vite.
          </p>
          <button
            onClick={() => onNav("pratique")}
            className="w-full text-sm font-semibold py-2.5 rounded-xl transition-all hover:-translate-y-px"
            style={{ background: "#101820", color: "#fff", fontFamily: "inherit" }}>
            Aller à l'espace de pratique →
          </button>
        </div>

        {/* Aide rapide */}
        <DashCard title="Aide rapide" icon={HelpCircle}>
          <ul className="space-y-0.5">
            {[
              { label: "Accéder à l'aide", icon: HelpCircle, onClick: () => onNav("aide") },
              { label: "Voir mes notifications", icon: Bell, onClick: () => {} },
              { label: "Contacter SuperTilt", icon: MessageSquare, onClick: () => onNav("aide") },
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

function TravauxView({ email }: { email: string }) {
  const { data: deposits = [], isLoading } = useLearnerWorkDeposits(email);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--st-ink)" }}>Mes travaux</h2>
        <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
          Tous vos travaux déposés
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : deposits.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center space-y-3"
          style={{ borderColor: "rgba(16,24,32,0.08)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: "var(--st-surface, #F2F4F4)" }}>
            <FileText size={22} style={{ color: "var(--st-ink-muted)" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--st-ink)" }}>Aucun travail déposé</p>
          <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
            Vos travaux déposés dans vos cours apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {deposits.map((d: any) => (
            <div key={d.id} className="rounded-2xl border overflow-hidden transition-shadow hover:shadow-sm"
              style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}>
              {d.file_mime?.startsWith("image/") ? (
                <img src={d.file_url} alt={d.file_name} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 flex items-center justify-center"
                  style={{ background: "var(--st-surface, #F2F4F4)" }}>
                  <FileImage size={32} style={{ color: "var(--st-ink-muted)" }} />
                </div>
              )}
              <div className="p-4 space-y-2">
                <p className="text-sm font-medium truncate" style={{ color: "var(--st-ink)" }}>{d.file_name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: d.publication_status === "published" ? "#dcfce7" : "#f1f5f9",
                      color: d.publication_status === "published" ? "#15803d" : "#475569",
                    }}>
                    {d.publication_status === "published" ? "Partagé" : "Privé"}
                  </span>
                  <span className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
                    {format(new Date(d.created_at), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>
                {d.comment && (
                  <p className="text-xs line-clamp-2" style={{ color: "var(--st-ink-muted)" }}>{d.comment}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pratique view ─────────────────────────────────────────────────────────────

function PratiqueView({ email, courseIds }: { email: string; courseIds: string[] }) {
  const { data: deposits = [], isLoading } = usePracticeDeposits(courseIds);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--st-ink)" }}>Espace de pratique</h2>
        <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
          Travaux partagés par les autres apprenants
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : deposits.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center space-y-3"
          style={{ borderColor: "rgba(16,24,32,0.08)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: "var(--st-yellow-soft, #FFFBEA)" }}>
            <Palette size={22} style={{ color: "#101820" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--st-ink)" }}>Aucun travail partagé</p>
          <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
            Les travaux partagés par les autres apprenants apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {deposits.map((d: any) => {
            const authorInitials = (d.learner_email || "?")
              .split("@")[0]
              .split(/[._-]/)
              .map((w: string) => w[0] ?? "")
              .join("")
              .toUpperCase()
              .slice(0, 2);
            return (
              <div key={d.id} className="rounded-2xl border overflow-hidden transition-shadow hover:shadow-sm"
                style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}>
                {d.file_mime?.startsWith("image/") ? (
                  <img src={d.file_url} alt={d.file_name} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 flex items-center justify-center"
                    style={{ background: "var(--st-surface, #F2F4F4)" }}>
                    <FileImage size={32} style={{ color: "var(--st-ink-muted)" }} />
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--st-ink)" }}>{d.file_name}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: "var(--st-yellow)", color: "#101820" }}>
                      {authorInitials}
                    </div>
                    <span className="text-xs truncate" style={{ color: "var(--st-ink-muted)" }}>
                      {d.learner_email !== email ? d.learner_email?.split("@")[0] : "Vous"}
                    </span>
                    <span className="text-xs ml-auto shrink-0" style={{ color: "var(--st-ink-muted)" }}>
                      {format(new Date(d.created_at), "d MMM", { locale: fr })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Aide view ────────────────────────────────────────────────────────────────

function AideView({
  email,
  mainTraining,
}: {
  email: string;
  mainTraining: Training | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--st-ink)" }}>Aide</h2>
        <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>Besoin d'un coup de main ?</p>
      </div>

      {/* Contact / messaging section */}
      <div className="rounded-2xl border p-6 space-y-4"
        style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-white)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--st-yellow-soft, #FFFBEA)" }}>
            <MessageSquare size={18} style={{ color: "#101820" }} />
          </div>
          <div>
            <p className="text-base font-semibold" style={{ color: "var(--st-ink)" }}>Nous contacter</p>
            <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
              Notre équipe est disponible pour répondre à vos questions.
            </p>
          </div>
        </div>
        <div className="mt-2">
          {mainTraining?.lms_course_id ? (
            <LearnerLmsMessaging courseId={mainTraining.lms_course_id} learnerEmail={email} />
          ) : mainTraining ? (
            <LearnerMessaging trainingId={mainTraining.training_id} participantId={mainTraining.participant_id} learnerEmail={email} />
          ) : (
            <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
              Aucune formation active. Contactez-nous à{" "}
              <a href="mailto:contact@supertilt.fr" className="underline" style={{ color: "var(--st-ink)" }}>
                contact@supertilt.fr
              </a>
            </p>
          )}
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
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LearnerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestingCoach, setRequestingCoach] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const email = data?.email ?? null;
  const { data: learnerProfile } = useLearnerProfile(email);

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

  const firstName = learnerProfile?.first_name || data.trainings[0]?.first_name || "";
  const lastName = learnerProfile?.last_name || data.trainings[0]?.last_name || "";
  const fonction = learnerProfile?.fonction || null;
  const photoUrl = learnerProfile?.photo_url || null;

  const lmsTrainings = data.trainings.filter((t) => t.lms_course_id);
  const mainTraining = lmsTrainings[0] ?? data.trainings[0] ?? null;

  const sectionTitle: Record<NavSection, string> = {
    dashboard: "Tableau de bord",
    formations: "Mes formations",
    travaux: "Mes travaux",
    pratique: "Espace de pratique",
    aide: "Aide",
  };
  const sectionSubtitle: Record<NavSection, string> = {
    dashboard: "Retrouvez vos formations, votre progression et vos prochains rendez-vous.",
    formations: "Toutes vos formations, documents et coaching.",
    travaux: "Tous vos travaux déposés dans vos cours.",
    pratique: "Découvrez les travaux partagés par la communauté.",
    aide: "Ressources et contact.",
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
          onNav={setActiveSection}
          firstName={firstName}
          lastName={lastName}
          fonction={fonction}
          photoUrl={photoUrl}
          email={data.email}
          onLogout={handleLogout}
          onEditProfile={() => setProfileModalOpen(true)}
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
              fonction={fonction}
              photoUrl={photoUrl}
              email={data.email}
              onLogout={handleLogout}
              onEditProfile={() => { setSidebarOpen(false); setProfileModalOpen(true); }}
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
            {activeSection === "travaux" && (
              <TravauxView email={data.email} />
            )}
            {activeSection === "pratique" && (
              <PratiqueView
                email={data.email}
                courseIds={courseIds}
              />
            )}
            {activeSection === "aide" && (
              <AideView email={data.email} mainTraining={mainTraining} />
            )}
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
