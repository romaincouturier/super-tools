import { useMemo, useState, useRef, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/hooks/useConfirm";
import {
  useCourse,
  useCourseModules,
  useCourseLessons,
  useLearnerProgress,
  useCourseForums,
  useForumPosts,
  useCreateForumPost,
} from "@/hooks/useLms";
import SupertiltLogo from "@/components/SupertiltLogo";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Calendar,
  Target,
  FileText,
  Users,
  User,
  Mail,
  Phone,
  Clock,
  Play,
  ExternalLink,
  CalendarPlus,
  MessageSquare,
  Menu,
  X,
  Send,
  Sparkles,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Progress circle (SVG) ─────────────────────────────────────────────────────

function ProgressCircle({ pct }: { pct: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(pct, 100) / 100;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: 96, height: 96 }}>
      <svg width={96} height={96} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={48} cy={48} r={r} fill="none" stroke="#EDEDED" strokeWidth={8} />
        <circle
          cx={48} cy={48} r={r} fill="none"
          stroke="#FFD100" strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold leading-none" style={{ color: "var(--st-ink)" }}>
          {Math.round(pct)}%
        </span>
        <span className="text-[10px] mt-0.5" style={{ color: "var(--st-ink-muted)" }}>terminé</span>
      </div>
    </div>
  );
}

// ── Module status icon ────────────────────────────────────────────────────────

type ModuleStatus = "completed" | "in_progress" | "not_started";

function ModuleStatusIcon({ status, num }: { status: ModuleStatus; num: number }) {
  if (status === "completed") {
    return <CheckCircle2 size={18} style={{ color: "#69C3C4", flexShrink: 0 }} />;
  }
  const borderColor = status === "in_progress" ? "#FFD100" : "#CCCCCC";
  const bg = status === "in_progress" ? "#FFD100" : "transparent";
  const textColor = status === "in_progress" ? "#101820" : "#AAAAAA";
  return (
    <div
      className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0"
      style={{ borderColor, background: bg }}
    >
      <span style={{ fontSize: 6, fontWeight: 700, color: textColor, lineHeight: 1, letterSpacing: 0 }}>
        M{num}
      </span>
    </div>
  );
}

// ── Community sidebar preview ─────────────────────────────────────────────────

function CommunitySidebarPreview({
  courseId,
  email,
  previewCount,
}: {
  courseId: string;
  email: string;
  previewCount: number;
}) {
  const [content, setContent] = useState("");
  const { data: forums = [] } = useCourseForums(courseId);
  const mainForum = forums[0] ?? null;
  const { data: allPosts = [] } = useForumPosts(mainForum?.id);
  const createPost = useCreateForumPost();

  // Posts ordered ASC in the hook — take the last N (most recent)
  const recentPosts = [...allPosts].reverse().slice(0, previewCount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !mainForum || !email) return;
    await createPost.mutateAsync({
      forum_id: mainForum.id,
      author_email: email,
      content_html: `<p>${content.trim()}</p>`,
    });
    setContent("");
  };

  return (
    <div className="p-5 border-t" style={{ borderColor: "rgba(16,24,32,0.08)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--st-ink-muted)" }}>
        Communauté
      </p>

      {/* Mini post form */}
      <form onSubmit={handleSubmit} className="mb-3">
        <p className="text-xs mb-1.5" style={{ color: "var(--st-ink-muted)" }}>Une question ?</p>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Écrire un message…"
            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border outline-none min-w-0"
            style={{ borderColor: "rgba(16,24,32,0.15)", fontFamily: "inherit", color: "var(--st-ink)", background: "transparent" }}
          />
          <button
            type="submit"
            disabled={!content.trim() || createPost.isPending}
            className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 transition-all disabled:opacity-40"
            style={{ background: "var(--st-yellow)", color: "#101820" }}
          >
            <Send size={12} />
          </button>
        </div>
      </form>

      {/* Recent posts */}
      {recentPosts.length > 0 ? (
        <ul className="space-y-2.5">
          {recentPosts.map((post) => {
            const initials = post.author_email.split("@")[0].slice(0, 2).toUpperCase();
            const date = new Date(post.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
            return (
              <li key={post.id} className="flex gap-2 items-start">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5"
                  style={{ background: "var(--st-yellow)", color: "#101820" }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-xs leading-snug line-clamp-2 [&>*]:inline"
                    style={{ color: "var(--st-ink)" }}
                    dangerouslySetInnerHTML={{ __html: post.content_html }}
                  />
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--st-ink-muted)" }}>{date}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>Pas encore de message. Soyez le premier !</p>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  courseId: string;
  email: string;
  isPreview: boolean;
  completionPct: number;
  lastLessonTitle: string | null;
  lastActivityDate: string | null;
  modules: Array<{ id: string; title: string; position: number }>;
  moduleStatuses: Record<string, ModuleStatus>;
  lessonCountByModule: Record<string, number>;
  activeLessonId: string | null;
  communityPreviewCount: number;
  onModuleClick: (moduleId: string) => void;
}

function Sidebar({
  courseId,
  email,
  isPreview,
  completionPct,
  lastLessonTitle,
  lastActivityDate,
  modules,
  moduleStatuses,
  lessonCountByModule,
  activeLessonId,
  communityPreviewCount,
  onModuleClick,
}: SidebarProps) {
  const navigate = useNavigate();
  const playerUrl = isPreview
    ? `/lms/${courseId}/player?preview=admin`
    : `/lms/${courseId}/player?email=${encodeURIComponent(email)}`;

  return (
    <aside
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: "var(--st-white)" }}
    >
      {/* Module list */}
      <div className="p-5 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--st-ink-muted)" }}>
          Modules
        </p>
        <ul className="space-y-1">
          {modules.map((m, idx) => {
            const status = moduleStatuses[m.id] ?? "not_started";
            const count = lessonCountByModule[m.id] ?? 0;
            return (
              <li key={m.id}>
                <button
                  onClick={() => onModuleClick(m.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-black/5 group"
                  style={{ fontFamily: "inherit" }}
                >
                  <ModuleStatusIcon status={status} num={idx + 1} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug truncate" style={{ color: "var(--st-ink)" }}>
                      {m.title}
                    </p>
                    <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
                      {count} séquence{count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronRight size={14} className="shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {!isPreview && (
        <CommunitySidebarPreview
          courseId={courseId}
          email={email}
          previewCount={communityPreviewCount}
        />
      )}
    </aside>
  );
}

// ── Hero section ──────────────────────────────────────────────────────────────

function heroVideoEmbed(url: string) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return null;
}

function HeroSection({
  course,
  completionPct,
  onContinue,
}: {
  course: { cover_image_url: string | null; welcome_video_url?: string | null; welcome_text?: string | null };
  completionPct: number;
  onContinue: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const videoUrl = course.welcome_video_url ?? null;
  const embedUrl = videoUrl ? heroVideoEmbed(videoUrl) : null;

  return (
    <section className="grid lg:grid-cols-2 gap-8 items-center">
      {/* Video / cover */}
      <div
        className="relative rounded-2xl overflow-hidden aspect-video bg-black flex items-center justify-center"
        style={{ boxShadow: "0 8px 32px rgba(16,24,32,0.12)" }}
      >
        {playing && videoUrl ? (
          embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : (
            <video src={videoUrl} className="w-full h-full" autoPlay controls />
          )
        ) : videoUrl || course.cover_image_url ? (
          <>
            {course.cover_image_url && (
              <img src={course.cover_image_url} alt="" className="w-full h-full object-cover" />
            )}
            {videoUrl && (
              <button
                onClick={() => setPlaying(true)}
                className="absolute inset-0 flex items-center justify-center group"
                aria-label="Lancer la vidéo"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: "rgba(255,209,0,0.95)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
                >
                  <Play size={22} style={{ color: "#101820", marginLeft: 3 }} />
                </div>
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 opacity-40">
            <Play size={40} style={{ color: "#fff" }} />
            <p className="text-white text-sm">Vidéo d'accueil</p>
          </div>
        )}
      </div>

      {/* Welcome text */}
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold leading-tight mb-3" style={{ letterSpacing: "-0.02em" }}>
            <span style={{ color: "var(--st-ink)" }}>Bienvenue dans </span>
            <span style={{ color: "var(--st-yellow)" }}>votre formation</span>
          </h1>
          {course.welcome_text && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--st-ink-muted)" }}>
              {course.welcome_text}
            </p>
          )}
        </div>

        {/* Reminders */}
        <div className="space-y-2">
          {[
            { icon: BookOpen, text: "Commencez par le Module 1 pour poser les bases." },
            { icon: Calendar, text: "Prochain live : retrouvez-nous pour un échange en direct sur le Module 1." },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                style={{ background: "var(--st-yellow)" }}>
                <Icon size={10} style={{ color: "#101820" }} />
              </div>
              <p className="text-sm leading-snug" style={{ color: "var(--st-ink)" }}>{text}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onContinue}
            className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={{ background: "var(--st-yellow)", color: "var(--st-ink)", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(255,209,0,0.35)" }}
          >
            {completionPct > 0 ? "Continuer la formation" : "Commencer la formation"}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Live banner ───────────────────────────────────────────────────────────────

function LiveBanner() {
  return (
    <section
      className="rounded-2xl flex flex-wrap items-center gap-4 px-6 py-5"
      style={{ background: "#101820" }}
    >
      {/* Label + title */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--st-yellow)" }}
        >
          <Calendar size={18} style={{ color: "#101820" }} />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--st-yellow)" }}>
            Prochain live
          </p>
          <p className="text-base font-bold text-white">Live #1</p>
        </div>
      </div>

      {/* Date */}
      <div className="flex items-center gap-2 shrink-0">
        <Clock size={14} style={{ color: "rgba(255,255,255,0.5)" }} />
        <span className="text-sm text-white font-medium">Mercredi 3 juin 2026 à 12h30</span>
      </div>

      {/* Description */}
      <p className="text-sm flex-1 min-w-0" style={{ color: "rgba(255,255,255,0.65)" }}>
        Rencontre en direct + questions sur le Module 1
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <button
          className="text-sm font-medium px-4 py-2 rounded-full border transition-all hover:bg-white/10"
          style={{ borderColor: "rgba(255,255,255,0.2)", color: "#fff", fontFamily: "inherit" }}
        >
          Voir toutes les dates
        </button>
        <button
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-all hover:-translate-y-px"
          style={{ background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" }}
        >
          <CalendarPlus size={14} />
          Ajouter au calendrier
        </button>
      </div>
    </section>
  );
}

// ── Info cards ────────────────────────────────────────────────────────────────

function InfoCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-shadow hover:shadow-md"
      style={{ background: "var(--st-white)", border: "1px solid rgba(16,24,32,0.08)" }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--st-yellow-soft, #FFFBEA)" }}>
          <Icon size={15} style={{ color: "var(--st-ink)" }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: "var(--st-ink)" }}>{title}</p>
      </div>
      <div className="text-sm leading-relaxed" style={{ color: "var(--st-ink-muted)" }}>
        {children}
      </div>
    </div>
  );
}

function InfoCardsGrid() {
  return (
    <section>
      <h2 className="text-base font-semibold mb-4" style={{ color: "var(--st-ink)" }}>Infos pratiques</h2>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Période */}
        <InfoCard icon={Calendar} title="Période de formation">
          <p className="font-semibold text-base mb-1" style={{ color: "var(--st-ink)" }}>
            Du 27 mai 2026<br />au 1 juillet 2026
          </p>
          <p>Formation en e-learning accessible à votre rythme pendant cette période.</p>
        </InfoCard>

        {/* Objectifs */}
        <InfoCard icon={Target} title="Objectifs de la formation">
          <ul className="space-y-1.5">
            {[
              "Comprendre les principes de la facilitation graphique.",
              "Développer votre vocabulaire visuel et vos techniques de dessin.",
              "Structurer et clarifier vos idées visuellement.",
              "Animer avec le visuel et favoriser l'intelligence collective.",
              "Gagner en confiance et en impact dans vos communications.",
            ].map((obj) => (
              <li key={obj} className="flex items-start gap-1.5">
                <span style={{ color: "var(--st-yellow)", fontWeight: 700, marginTop: 1 }}>✓</span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </InfoCard>

        {/* Prérequis */}
        <InfoCard icon={BookOpen} title="Prérequis">
          <p>Il n'est pas nécessaire de savoir dessiner pour suivre la formation.</p>
        </InfoCard>

        {/* Documents */}
        <InfoCard icon={FileText} title="Documents utiles">
          <div className="space-y-2">
            {[
              { label: "Consulter le programme", icon: ExternalLink },
              { label: "Règlement intérieur", icon: FileText },
            ].map(({ label, icon: Icon }) => (
              <button
                key={label}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all hover:bg-black/5 text-left"
                style={{ borderColor: "rgba(16,24,32,0.12)", color: "var(--st-ink)", fontFamily: "inherit" }}
              >
                <Icon size={13} style={{ color: "var(--st-ink-muted)" }} />
                {label}
              </button>
            ))}
          </div>
        </InfoCard>

        {/* Formateur */}
        <InfoCard icon={User} title="Votre formateur">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
              style={{ background: "var(--st-yellow)", color: "#101820" }}
            >
              RC
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--st-ink)" }}>Romain Couturier</p>
              <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>Votre formateur</p>
            </div>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--st-ink-muted)" }}>
            En cas de besoin, n'hésitez pas à le contacter directement.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Email", icon: Mail },
              { label: "Téléphone", icon: Phone },
              { label: "CV", icon: FileText },
            ].map(({ label, icon: Icon }) => (
              <button
                key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:bg-black/5"
                style={{ borderColor: "rgba(16,24,32,0.12)", color: "var(--st-ink)", fontFamily: "inherit" }}
              >
                <Icon size={11} />
                {label}
              </button>
            ))}
          </div>
        </InfoCard>
      </div>
    </section>
  );
}

// ── Community section ─────────────────────────────────────────────────────────

const COMMUNITY_THUMBNAILS = [
  { bg: "#F2F4F4", emoji: "✏️" },
  { bg: "#FFFBEA", emoji: "🎨" },
  { bg: "#F0FDF4", emoji: "💡" },
  { bg: "#FFF7ED", emoji: "🖊️" },
];

function CommunitySection() {
  return (
    <section
      className="rounded-2xl flex flex-wrap items-center gap-6 px-6 py-5"
      style={{ background: "var(--st-surface, #F2F4F4)", border: "1px solid rgba(16,24,32,0.06)" }}
    >
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "var(--st-yellow-soft, #FFFBEA)" }}>
          <Users size={18} style={{ color: "var(--st-ink)" }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--st-ink)" }}>Espace de partage entre apprenants</p>
        </div>
      </div>

      <p className="flex-1 min-w-[200px] text-sm leading-relaxed" style={{ color: "var(--st-ink-muted)" }}>
        Échangez avec les autres apprenants, posez vos questions, partagez vos réalisations et découvrez celles de la communauté.
      </p>

      <div className="flex items-center gap-4 shrink-0 flex-wrap">
        {/* Thumbnails */}
        <div className="flex -space-x-1">
          {COMMUNITY_THUMBNAILS.map((t, i) => (
            <div
              key={i}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg border-2 border-white"
              style={{ background: t.bg }}
            >
              {t.emoji}
            </div>
          ))}
        </div>
        <button
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-px"
          style={{ background: "var(--st-ink)", color: "#fff", fontFamily: "inherit" }}
        >
          Accéder à l'espace de partage
          <ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function CourseHomeHeader({
  courseTitle,
  learnerName,
  onMobileMenu,
}: {
  courseTitle: string;
  learnerName: string;
  onMobileMenu: () => void;
}) {
  const navigate = useNavigate();
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
    if (confirmed) {
      sessionStorage.removeItem("learner_email");
      await supabase.auth.signOut();
      navigate("/apprenant/connexion");
    }
  };

  const initial = learnerName ? learnerName[0].toUpperCase() : "?";

  const portalItems = [
    { label: "Mon compte", icon: User, section: "compte" },
    { label: "Mes formations", icon: BookOpen, section: "formations" },
    { label: "Mes formations recommandées", icon: Sparkles, section: "dashboard" },
    { label: "Aide", icon: HelpCircle, section: "aide" },
  ];

  return (
    <>
      <ConfirmDialog />
      <header
        className="sticky top-0 z-30 flex items-center gap-4 px-5 h-16 border-b"
        style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}
      >
        {/* Mobile menu */}
        <button
          onClick={onMobileMenu}
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-black/5"
          aria-label="Menu"
        >
          <Menu size={18} style={{ color: "var(--st-ink)" }} />
        </button>

        {/* Logo */}
        <div className="shrink-0">
          <SupertiltLogo className="h-9" />
        </div>

        {/* Course title */}
        <div className="hidden sm:block h-5 w-px shrink-0" style={{ background: "rgba(16,24,32,0.1)" }} />
        <p className="hidden sm:block flex-1 text-sm font-medium truncate min-w-0" style={{ color: "var(--st-ink)" }}>
          {courseTitle}
        </p>

        {/* Greeting dropdown */}
        <div ref={ref} className="ml-auto relative shrink-0">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all hover:bg-black/5"
            style={{ fontFamily: "inherit" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: "var(--st-yellow)", color: "#101820" }}
            >
              {initial}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>Bonjour</p>
              <p className="text-sm font-semibold leading-none" style={{ color: "var(--st-ink)" }}>
                {learnerName || "Apprenant"}
              </p>
            </div>
            <ChevronDown size={13} className="hidden sm:block shrink-0 opacity-50" style={{ color: "var(--st-ink-muted)" }} />
          </button>

          {open && (
            <div
              className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl border shadow-lg overflow-hidden z-50"
              style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.1)" }}
            >
              {portalItems.map(({ label, icon: Icon, section }) => (
                <button
                  key={section}
                  onClick={() => { navigate(`/espace-apprenant?section=${section}`); setOpen(false); }}
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
      </header>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LmsCourseHomePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const email = searchParams.get("email") || "";
  const isPreview = searchParams.get("preview") === "admin";
  const initialLessonId = searchParams.get("lesson");

  const { data: course, isLoading: courseLoading } = useCourse(courseId);
  const { data: modules = [] } = useCourseModules(courseId);
  const { data: allLessons = [] } = useCourseLessons(courseId);
  const { data: progress = [] } = useLearnerProgress(courseId, email || undefined);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Completed lesson IDs
  const completedIds = useMemo(
    () => new Set(progress.filter((p) => p.status === "completed").map((p) => p.lesson_id)),
    [progress],
  );

  // Overall completion %
  const completionPct = useMemo(
    () => (allLessons.length === 0 ? 0 : (completedIds.size / allLessons.length) * 100),
    [completedIds, allLessons],
  );

  // Last lesson consulted
  const lastProgress = useMemo(() => {
    const sorted = [...progress].filter((p) => p.completed_at).sort(
      (a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime(),
    );
    return sorted[0] ?? null;
  }, [progress]);

  const lastLesson = useMemo(
    () => (lastProgress ? allLessons.find((l) => l.id === lastProgress.lesson_id) ?? null : null),
    [lastProgress, allLessons],
  );

  // Module completion status
  const lessonsByModule = useMemo(() => {
    const m: Record<string, typeof allLessons> = {};
    for (const l of allLessons) {
      if (!m[l.module_id]) m[l.module_id] = [];
      m[l.module_id].push(l);
    }
    return m;
  }, [allLessons]);

  const moduleStatuses = useMemo((): Record<string, ModuleStatus> => {
    const statuses: Record<string, ModuleStatus> = {};
    for (const m of modules) {
      const lessons = lessonsByModule[m.id] ?? [];
      const doneCount = lessons.filter((l) => completedIds.has(l.id)).length;
      if (lessons.length === 0 || doneCount === 0) statuses[m.id] = "not_started";
      else if (doneCount === lessons.length) statuses[m.id] = "completed";
      else statuses[m.id] = "in_progress";
    }
    return statuses;
  }, [modules, lessonsByModule, completedIds]);

  const lessonCountByModule = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of modules) counts[m.id] = (lessonsByModule[m.id] ?? []).length;
    return counts;
  }, [modules, lessonsByModule]);

  // Learner display name from email
  const learnerName = useMemo(() => {
    if (isPreview) return "Admin";
    if (!email) return "";
    const local = email.split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }, [email, isPreview]);

  // Navigate to player at first incomplete lesson (or initial lesson)
  const handleContinue = () => {
    const firstIncomplete = allLessons.find((l) => !completedIds.has(l.id));
    const targetLesson = initialLessonId || firstIncomplete?.id || allLessons[0]?.id || "";
    const base = isPreview
      ? `/lms/${courseId}/player?preview=admin`
      : `/lms/${courseId}/player?email=${encodeURIComponent(email)}`;
    navigate(targetLesson ? `${base}&lesson=${targetLesson}` : base);
  };

  const handleModuleClick = (moduleId: string) => {
    const firstLessonInModule = allLessons.find((l) => l.module_id === moduleId);
    const base = isPreview
      ? `/lms/${courseId}/player?preview=admin`
      : `/lms/${courseId}/player?email=${encodeURIComponent(email)}`;
    navigate(firstLessonInModule ? `${base}&lesson=${firstLessonInModule.id}` : base);
  };

  if (courseLoading || !course) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "var(--st-white)", fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif" }}>
        <p style={{ color: "var(--st-ink-muted)", fontSize: 14 }}>Chargement…</p>
      </div>
    );
  }

  const sortedModules = [...modules].sort((a, b) => a.position - b.position);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif", background: "var(--st-white)" }}
    >
      <CourseHomeHeader
        courseTitle={course.formation_configs?.formation_name || course.title}
        learnerName={learnerName}
        onMobileMenu={() => setSidebarOpen((v) => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <div
          className="hidden lg:flex flex-col shrink-0 border-r overflow-hidden"
          style={{ width: 300, borderColor: "rgba(16,24,32,0.08)" }}
        >
          <Sidebar
            courseId={courseId!}
            email={email}
            isPreview={isPreview}
            completionPct={completionPct}
            lastLessonTitle={lastLesson?.title ?? null}
            lastActivityDate={lastProgress?.completed_at ?? null}
            modules={sortedModules}
            moduleStatuses={moduleStatuses}
            lessonCountByModule={lessonCountByModule}
            activeLessonId={null}
            communityPreviewCount={course.community_preview_count ?? 2}
            onModuleClick={handleModuleClick}
          />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 z-40 bg-black/30"
              onClick={() => setSidebarOpen(false)}
            />
            <div
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 border-r shadow-xl"
              style={{ width: 300, background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}
            >
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(16,24,32,0.08)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--st-ink)" }}>Navigation</p>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5"
                >
                  <X size={16} style={{ color: "var(--st-ink)" }} />
                </button>
              </div>
              <div className="overflow-y-auto h-full">
                <Sidebar
                  courseId={courseId!}
                  email={email}
                  isPreview={isPreview}
                  completionPct={completionPct}
                  lastLessonTitle={lastLesson?.title ?? null}
                  lastActivityDate={lastProgress?.completed_at ?? null}
                  modules={sortedModules}
                  moduleStatuses={moduleStatuses}
                  lessonCountByModule={lessonCountByModule}
                  activeLessonId={null}
                  communityPreviewCount={course.community_preview_count ?? 2}
                  onModuleClick={(id) => { handleModuleClick(id); setSidebarOpen(false); }}
                />
              </div>
            </div>
          </>
        )}

        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto">
          {/* Mobile progress bar */}
          <div
            className="lg:hidden flex items-center gap-3 px-4 py-3 border-b"
            style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-white)" }}
          >
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#EDEDED" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${completionPct}%`, background: "var(--st-yellow)" }}
              />
            </div>
            <span className="text-xs font-semibold shrink-0" style={{ color: "var(--st-ink)" }}>
              {Math.round(completionPct)}%
            </span>
            <button
              onClick={handleContinue}
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full transition-all"
              style={{ background: "var(--st-yellow)", color: "var(--st-ink)", fontFamily: "inherit" }}
            >
              Continuer
            </button>
          </div>

          <div className="px-5 py-6 flex flex-col gap-8">
            <HeroSection
              course={course}
              completionPct={completionPct}
              onContinue={handleContinue}
            />

            <LiveBanner />

            <InfoCardsGrid />

            <CommunitySection />
          </div>
        </main>
      </div>
    </div>
  );
}
