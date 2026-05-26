import { useMemo, useState, useRef, useEffect } from "react";
import DOMPurify from "dompurify";
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
  useCourseLiveMeetings,
  uploadForumAttachment,
} from "@/hooks/useLms";
import type { CourseLiveMeeting, CourseLiveData, CourseHomeConfig } from "@/hooks/useLmsQueries";
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
  Video,
  ArrowLeft,
  Flag,
  Paperclip,
  AlertCircle,
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
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: forums = [] } = useCourseForums(courseId);
  const mainForum = forums[0] ?? null;
  const { data: allPosts = [] } = useForumPosts(mainForum?.id);
  const createPost = useCreateForumPost();

  const recentPosts = [...allPosts].reverse().slice(0, previewCount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && !attachment) || !mainForum || !email) return;
    setError(null);
    setUploading(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      if (attachment) {
        const uploaded = await uploadForumAttachment(attachment, courseId, email);
        fileUrl = uploaded.url;
        fileName = uploaded.name;
      }
      await createPost.mutateAsync({
        forum_id: mainForum.id,
        author_email: email,
        content_html: content.trim() ? `<p>${content.trim()}</p>` : "",
        file_url: fileUrl,
        file_name: fileName,
      });
      setContent("");
      setAttachment(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError("Impossible d'envoyer le message. Réessayez.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-5 border-b" style={{ borderColor: "rgba(16,24,32,0.08)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--st-ink-muted)" }}>
        Communauté
      </p>

      {/* Mini post form */}
      <form onSubmit={handleSubmit} className="mb-3 space-y-1.5">
        <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>Une question ?</p>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Écrire un message…"
            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border outline-none min-w-0"
            style={{ borderColor: "rgba(16,24,32,0.15)", fontFamily: "inherit", color: "var(--st-ink)", background: "transparent" }}
          />
          {/* Attachment button */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 transition-all hover:bg-black/5"
            style={{ color: attachment ? "var(--st-yellow)" : "var(--st-ink-muted)" }}
            title="Joindre un fichier"
          >
            <Paperclip size={12} />
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} />
          {/* Send button */}
          <button
            type="submit"
            disabled={(!content.trim() && !attachment) || uploading || createPost.isPending}
            className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 transition-all disabled:opacity-40"
            style={{ background: "var(--st-yellow)", color: "#101820" }}
          >
            <Send size={12} />
          </button>
        </div>
        {attachment && (
          <p className="text-[10px] truncate" style={{ color: "var(--st-ink-muted)" }}>
            📎 {attachment.name}
          </p>
        )}
        {error && (
          <p className="text-[10px] flex items-center gap-1" style={{ color: "#ef4444" }}>
            <AlertCircle size={10} /> {error}
          </p>
        )}
      </form>

      {/* Recent posts */}
      {recentPosts.length > 0 ? (
        <ul className="space-y-2.5">
          {recentPosts.map((post) => {
            const initials = post.author_email.split("@")[0].slice(0, 2).toUpperCase();
            const date = new Date(post.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
            return (
              <li key={post.id} className="flex gap-2 items-start">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5"
                  style={{ background: "var(--st-yellow)", color: "#101820" }}>
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  {post.content_html && (
                    <div className="text-xs leading-snug line-clamp-2 [&>*]:inline" style={{ color: "var(--st-ink)" }}
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content_html) }} />
                  )}
                  {post.file_url && (
                    <a href={post.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] flex items-center gap-1 mt-0.5 hover:underline truncate"
                      style={{ color: "var(--st-ink-muted)" }}>
                      <Paperclip size={9} /> {post.file_name ?? "Fichier joint"}
                    </a>
                  )}
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

// ── Live helpers ──────────────────────────────────────────────────────────────

function fmtLive(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtLiveTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function googleCalendarUrl(m: CourseLiveMeeting): string {
  const start = new Date(m.scheduled_at);
  const end = new Date(start.getTime() + m.duration_minutes * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: m.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: m.description ?? m.meeting_url ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function meetingTypeLabel(type: string) {
  if (type === "launch") return "Lancement";
  if (type === "closing") return "Séance de clôture";
  return "Live";
}

function videoEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return null;
}

// ── Calendar view ─────────────────────────────────────────────────────────────

function CalendarView({
  liveData,
  onReplay,
}: {
  liveData: CourseLiveData;
  onReplay: (id: string) => void;
}) {
  const { training, meetings } = liveData;

  type CalItem =
    | { kind: "date"; label: string; date: string }
    | { kind: "meeting"; meeting: CourseLiveMeeting };

  const items: CalItem[] = [];
  if (training?.start_date)
    items.push({ kind: "date", label: "Début de la formation", date: training.start_date });
  for (const m of meetings)
    items.push({ kind: "meeting", meeting: m });
  if (training?.end_date)
    items.push({ kind: "date", label: "Fin de la formation", date: training.end_date });

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold" style={{ color: "var(--st-ink)" }}>Calendrier des lives</h2>

      <ol className="relative space-y-0 border-l-2" style={{ borderColor: "rgba(16,24,32,0.1)", marginLeft: 8 }}>
        {items.map((item, i) => {
          if (item.kind === "date") {
            return (
              <li key={i} className="pl-6 pb-8 relative">
                <span
                  className="absolute -left-[9px] w-4 h-4 rounded-full border-2 flex items-center justify-center"
                  style={{ top: 2, background: "var(--st-white)", borderColor: "rgba(16,24,32,0.2)" }}
                >
                  <Flag size={7} style={{ color: "var(--st-ink-muted)" }} />
                </span>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--st-ink-muted)" }}>
                  {item.label}
                </p>
                <p className="text-sm font-medium mt-0.5" style={{ color: "var(--st-ink)" }}>
                  {new Date(item.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </li>
            );
          }
          const m = item.meeting;
          const hasReplay = !!m.replay_url;
          return (
            <li key={m.id} className="pl-6 pb-8 relative">
              <span
                className="absolute -left-[9px] w-4 h-4 rounded-full flex items-center justify-center"
                style={{ top: 2, background: "var(--st-yellow)" }}
              >
                <Video size={7} style={{ color: "#101820" }} />
              </span>
              <div
                className="rounded-2xl border p-4 space-y-3"
                style={{ borderColor: "rgba(16,24,32,0.08)", background: "var(--st-white)" }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--st-yellow)" }}>
                      {meetingTypeLabel(m.meeting_type)}
                    </p>
                    <p className="text-sm font-bold" style={{ color: "var(--st-ink)" }}>{m.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--st-ink-muted)" }}>
                      {fmtLive(m.scheduled_at)} à {fmtLiveTime(m.scheduled_at)}
                      {" · "}{m.duration_minutes} min
                    </p>
                    {m.description && (
                      <p className="text-xs mt-1" style={{ color: "var(--st-ink-muted)" }}>{m.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={googleCalendarUrl(m)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all hover:bg-black/5"
                    style={{ borderColor: "rgba(16,24,32,0.15)", color: "var(--st-ink)" }}
                  >
                    <CalendarPlus size={12} />
                    Ajouter au calendrier
                  </a>
                  {hasReplay ? (
                    <button
                      onClick={() => onReplay(m.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:-translate-y-px"
                      style={{ background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" }}
                    >
                      <Play size={11} />
                      Voir le replay
                    </button>
                  ) : (
                    <span
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                      style={{ color: "var(--st-ink-muted)", background: "rgba(16,24,32,0.04)" }}
                    >
                      <Play size={11} />
                      Replay à venir
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ── Replay view ───────────────────────────────────────────────────────────────

function ReplayView({ meeting }: { meeting: CourseLiveMeeting }) {
  const [playing, setPlaying] = useState(false);
  const embed = meeting.replay_url ? videoEmbed(meeting.replay_url) : null;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--st-ink-muted)" }}>
          {meetingTypeLabel(meeting.meeting_type)} · {fmtLive(meeting.scheduled_at)}
        </p>
        <h2 className="text-xl font-bold" style={{ color: "var(--st-ink)" }}>{meeting.title}</h2>
        {meeting.description && (
          <p className="text-sm mt-1" style={{ color: "var(--st-ink-muted)" }}>{meeting.description}</p>
        )}
      </div>

      {meeting.replay_url ? (
        <div
          className="relative rounded-2xl overflow-hidden aspect-video bg-black"
          style={{ boxShadow: "0 8px 32px rgba(16,24,32,0.12)" }}
        >
          {playing ? (
            embed ? (
              <iframe src={embed} className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
            ) : (
              <video src={meeting.replay_url} className="w-full h-full" autoPlay controls />
            )
          ) : (
            <button
              onClick={() => setPlaying(true)}
              className="absolute inset-0 flex items-center justify-center group w-full h-full"
              aria-label="Lancer le replay"
            >
              <div className="absolute inset-0 bg-black/30" />
              <div
                className="relative w-20 h-20 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: "rgba(255,209,0,0.95)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}
              >
                <Play size={28} style={{ color: "#101820", marginLeft: 4 }} />
              </div>
            </button>
          )}
        </div>
      ) : (
        <div
          className="rounded-2xl border border-dashed flex flex-col items-center justify-center py-16 gap-3"
          style={{ borderColor: "rgba(16,24,32,0.15)" }}
        >
          <Video size={32} style={{ color: "var(--st-ink-muted)", opacity: 0.4 }} />
          <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>Le replay n'est pas encore disponible.</p>
        </div>
      )}
    </section>
  );
}

// ── Progress card ─────────────────────────────────────────────────────────────

function ProgressCard({
  completionPct,
  completedLessons,
  totalLessons,
  completedModules,
  totalModules,
  onSeeStats,
}: {
  completionPct: number;
  completedLessons: number;
  totalLessons: number;
  completedModules: number;
  totalModules: number;
  onSeeStats: () => void;
}) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(16,24,32,0.06)", border: "1px solid rgba(16,24,32,0.06)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--st-ink)" }}>Votre progression</p>
      <div className="flex items-center gap-4">
        <ProgressCircle pct={completionPct} />
        <div className="flex flex-col gap-1.5">
          <div>
            <p className="text-base font-bold leading-tight" style={{ color: "var(--st-ink)" }}>{completedModules}/{totalModules} modules</p>
            <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>terminés</p>
          </div>
          <div>
            <p className="text-base font-bold leading-tight" style={{ color: "var(--st-ink)" }}>{completedLessons}/{totalLessons} séquences</p>
            <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>complétées</p>
          </div>
        </div>
      </div>
      <button
        onClick={onSeeStats}
        className="flex items-center gap-1.5 text-xs font-medium mt-auto"
        style={{ color: "var(--st-ink-muted)", fontFamily: "inherit", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        Voir mes statistiques <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ── Live card ─────────────────────────────────────────────────────────────────

function LiveCard({
  meeting,
  onViewCalendar,
}: {
  meeting: CourseLiveMeeting | null;
  onViewCalendar: () => void;
}) {
  const now = new Date();
  const isLive = meeting ? (() => {
    const s = new Date(meeting.scheduled_at);
    const e = new Date(s.getTime() + meeting.duration_minutes * 60_000);
    return now >= s && now <= e;
  })() : false;

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(16,24,32,0.06)", border: "1px solid rgba(16,24,32,0.06)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--st-ink)" }}>Prochain live</p>
      {meeting ? (
        <>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FFFBEA" }}>
              <Calendar size={18} style={{ color: "#101820" }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug" style={{ color: "var(--st-ink)" }}>{meeting.title}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--st-ink-muted)" }}>
                {isLive ? "En direct maintenant" : (
                  <>
                    {new Date(meeting.scheduled_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                    <br />{fmtLiveTime(meeting.scheduled_at)} – {fmtLiveTime(new Date(new Date(meeting.scheduled_at).getTime() + meeting.duration_minutes * 60_000).toISOString())} (CET)
                  </>
                )}
              </p>
              {meeting.description && (
                <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--st-ink-muted)" }}>{meeting.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onViewCalendar}
            className="flex items-center gap-1.5 text-xs font-medium mt-auto"
            style={{ color: "var(--st-ink-muted)", fontFamily: "inherit", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Voir l'agenda <ChevronRight size={12} />
          </button>
        </>
      ) : (
        <div className="flex items-center gap-3 mt-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#F2F4F4" }}>
            <Calendar size={18} style={{ color: "rgba(16,24,32,0.35)" }} />
          </div>
          <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>Aucun live prévu prochainement.</p>
        </div>
      )}
    </div>
  );
}

// ── Community info card ───────────────────────────────────────────────────────

const AVATAR_COLORS = ["#FFD100", "#69C3C4", "#F2A541", "#A8D8A8", "#D4A5A5"];

function CommunityInfoCard({
  courseId,
  email,
}: {
  courseId: string;
  email: string;
}) {
  const { data: forums = [] } = useCourseForums(courseId);
  const mainForum = forums[0] ?? null;
  const { data: allPosts = [] } = useForumPosts(mainForum?.id);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentPosts = allPosts.filter((p) => new Date(p.created_at) >= weekAgo);
  const recentAuthors = [...new Set(recentPosts.map((p) => p.author_email))].slice(0, 5);

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(16,24,32,0.06)", border: "1px solid rgba(16,24,32,0.06)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--st-ink)" }}>Communauté</p>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FFFBEA" }}>
          <Users size={18} style={{ color: "#101820" }} />
        </div>
        <p className="text-sm leading-snug" style={{ color: "var(--st-ink-muted)" }}>
          {recentPosts.length > 0
            ? `${recentPosts.length} message${recentPosts.length > 1 ? "s" : ""} cette semaine dans la communauté.`
            : "Échangez, posez vos questions et partagez vos réalisations."}
        </p>
      </div>
      {recentAuthors.length > 0 && (
        <div className="flex items-center gap-1.5">
          {recentAuthors.map((a, i) => (
            <div
              key={a}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white"
              style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: "#101820", marginLeft: i > 0 ? -6 : 0 }}
            >
              {a.split("@")[0].slice(0, 2).toUpperCase()}
            </div>
          ))}
          {recentPosts.length > recentAuthors.length && (
            <span className="text-xs ml-1" style={{ color: "var(--st-ink-muted)" }}>+{recentPosts.length - recentAuthors.length}</span>
          )}
        </div>
      )}
      <button
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold mt-auto transition-all hover:-translate-y-px"
        style={{ background: "#FFD100", color: "#101820", fontFamily: "inherit", border: "none", cursor: "pointer" }}
      >
        Rejoindre
      </button>
      <p className="text-xs text-center" style={{ color: "var(--st-ink-muted)" }}>
        Inspirez-vous des partages, posez vos questions et progressez ensemble !
      </p>
    </div>
  );
}

// ── Modules list section ──────────────────────────────────────────────────────

function ModulesListSection({
  modules,
  moduleStatuses,
  lessonCountByModule,
  lessonsDoneByModule,
  onModuleClick,
}: {
  modules: Array<{ id: string; title: string; position: number; description: string | null }>;
  moduleStatuses: Record<string, ModuleStatus>;
  lessonCountByModule: Record<string, number>;
  lessonsDoneByModule: Record<string, number>;
  onModuleClick: (moduleId: string) => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(16,24,32,0.06)", border: "1px solid rgba(16,24,32,0.06)" }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: "rgba(16,24,32,0.06)" }}>
        <p className="text-base font-bold" style={{ color: "var(--st-ink)" }}>Vos modules</p>
      </div>
      <div className="divide-y" style={{ borderColor: "rgba(16,24,32,0.06)" }}>
        {modules.map((mod, idx) => {
          const status = moduleStatuses[mod.id] ?? "not_started";
          const total = lessonCountByModule[mod.id] ?? 0;
          const done = lessonsDoneByModule[mod.id] ?? 0;
          const pct = total > 0 ? (done / total) * 100 : 0;
          const isCompleted = status === "completed";
          const isInProgress = status === "in_progress";
          const btnLabel = isCompleted ? "Revoir" : isInProgress ? "Continuer" : "Commencer";
          return (
            <div
              key={mod.id}
              className="flex items-center gap-4 px-6 py-4"
              style={{ borderColor: "rgba(16,24,32,0.06)" }}
            >
              {/* Number badge */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-base font-bold"
                style={{
                  background: isCompleted ? "#69C3C4" : isInProgress ? "#FFD100" : "#F2F4F4",
                  color: isCompleted ? "#fff" : "#101820",
                }}
              >
                M{idx + 1}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug" style={{ color: "var(--st-ink)" }}>
                  {mod.title}
                </p>
                {mod.description && (
                  <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--st-ink-muted)" }}>{mod.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#EDEDED", maxWidth: 120 }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isCompleted ? "#69C3C4" : "#FFD100" }} />
                  </div>
                  <p className="text-xs shrink-0" style={{ color: "var(--st-ink-muted)" }}>{done}/{total} séquences</p>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => onModuleClick(mod.id)}
                className="shrink-0 flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold transition-all hover:-translate-y-px"
                style={{
                  background: isCompleted ? "#F2F4F4" : "#FFD100",
                  color: "#101820",
                  fontFamily: "inherit",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {btnLabel} <ChevronRight size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tips block ────────────────────────────────────────────────────────────────

const TIPS = [
  "Ayez toujours une feuille et un feutre à portée de main.",
  "Progressez petit à petit, l'essentiel est la régularité.",
  "Testez, osez, pratiquez : il n'y a pas de dessin parfait.",
  "Participez aux lives et posez vos questions.",
];

function TipsBlock() {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(16,24,32,0.06)", border: "1px solid rgba(16,24,32,0.06)" }}>
      <div className="flex items-center gap-2.5">
        <Sparkles size={16} style={{ color: "#FFD100" }} />
        <p className="text-sm font-bold" style={{ color: "var(--st-ink)" }}>Conseils pour bien démarrer</p>
      </div>
      <ul className="space-y-2.5">
        {TIPS.map((tip) => (
          <li key={tip} className="flex items-start gap-2.5">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" style={{ color: "#69C3C4" }} />
            <p className="text-sm leading-snug" style={{ color: "var(--st-ink-muted)" }}>{tip}</p>
          </li>
        ))}
      </ul>
      <button
        className="text-xs font-medium text-left mt-auto flex items-center gap-1"
        style={{ color: "var(--st-ink-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
      >
        Voir tous les conseils <ChevronRight size={11} />
      </button>
    </div>
  );
}



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
  lessonsDoneByModule: Record<string, number>;
  activeLessonId: string | null;
  communityPreviewCount: number;
  meetings: CourseLiveMeeting[];
  activeView: string;
  onModuleClick: (moduleId: string) => void;
  onViewChange: (view: string) => void;
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
  lessonsDoneByModule,
  activeLessonId,
  communityPreviewCount,
  meetings,
  activeView,
  onModuleClick,
  onViewChange,
}: SidebarProps) {
  const navigate = useNavigate();
  const playerUrl = isPreview
    ? `/lms/${courseId}/player?preview=admin`
    : `/lms/${courseId}/player?email=${encodeURIComponent(email)}`;

  const SidebarBtn = ({
    label,
    icon: Icon,
    viewKey,
    sub,
  }: { label: string; icon: React.ElementType; viewKey: string; sub?: boolean }) => (
    <button
      onClick={() => onViewChange(viewKey)}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors",
        sub ? "pl-7 text-xs" : "text-sm",
        activeView === viewKey ? "font-semibold" : "hover:bg-black/5",
      )}
      style={{
        fontFamily: "inherit",
        background: activeView === viewKey ? "var(--st-yellow)" : "transparent",
        color: activeView === viewKey ? "#101820" : "var(--st-ink-muted)",
      }}
    >
      <Icon size={sub ? 13 : 15} style={{ flexShrink: 0 }} />
      <span className="truncate leading-snug">{label}</span>
    </button>
  );

  return (
    <aside
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: "var(--st-white)" }}
    >
      {/* Live et replays — distinctive style section */}
      {meetings.length > 0 && (
        <div className="p-3 pb-3 border-b" style={{ borderColor: "rgba(16,24,32,0.06)", background: "#101820" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-2" style={{ color: "rgba(255,209,0,0.7)", letterSpacing: ".06em" }}>
            Live &amp; Replays
          </p>
          <ul className="space-y-0.5">
            <li>
              <button
                onClick={() => onViewChange("calendar")}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors text-sm"
                style={{
                  fontFamily: "inherit",
                  background: activeView === "calendar" ? "#FFD100" : "rgba(255,209,0,0.1)",
                  color: activeView === "calendar" ? "#101820" : "#FFD100",
                  fontWeight: activeView === "calendar" ? 600 : 500,
                }}
                onMouseEnter={(e) => { if (activeView !== "calendar") (e.currentTarget as HTMLElement).style.background = "rgba(255,209,0,0.2)"; }}
                onMouseLeave={(e) => { if (activeView !== "calendar") (e.currentTarget as HTMLElement).style.background = "rgba(255,209,0,0.1)"; }}
              >
                <Calendar size={15} style={{ flexShrink: 0 }} />
                <span className="truncate leading-snug">Calendrier des lives</span>
              </button>
            </li>
            {meetings.map((m) => {
              const vk = `replay:${m.id}`;
              const isActive = activeView === vk;
              const hasReplay = !!m.replay_url;
              return (
                <li key={m.id}>
                  <button
                    onClick={() => onViewChange(vk)}
                    className="w-full flex items-center gap-2.5 pl-7 pr-3 py-2 rounded-xl text-left transition-colors text-xs"
                    style={{
                      fontFamily: "inherit",
                      background: isActive ? "#FFD100" : "transparent",
                      color: isActive ? "#101820" : hasReplay ? "#FFD100" : "rgba(255,209,0,0.5)",
                      fontWeight: isActive ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,209,0,0.1)"; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {hasReplay
                      ? <Play size={13} style={{ flexShrink: 0 }} />
                      : <Video size={13} style={{ flexShrink: 0 }} />}
                    <span className="truncate leading-snug">{m.title}</span>
                    {!hasReplay && (
                      <span className="ml-auto shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(255,209,0,0.2)", color: "rgba(255,209,0,0.6)" }}>
                        À venir
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Community — above modules */}
      {!isPreview && (
        <CommunitySidebarPreview
          courseId={courseId}
          email={email}
          previewCount={communityPreviewCount}
        />
      )}

      {/* Module list */}
      <div className="p-5 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--st-ink-muted)" }}>
          Vos modules
        </p>
        <ul className="space-y-1">
          {modules.map((m, idx) => {
            const status = moduleStatuses[m.id] ?? "not_started";
            const total = lessonCountByModule[m.id] ?? 0;
            const done = lessonsDoneByModule[m.id] ?? 0;
            const pct = total > 0 ? (done / total) * 100 : 0;
            const isCompleted = status === "completed";
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
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "#EDEDED" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isCompleted ? "#69C3C4" : "#FFD100" }} />
                      </div>
                      <p className="text-[10px] shrink-0" style={{ color: "var(--st-ink-muted)" }}>{done}/{total}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

// ── Hero section ──────────────────────────────────────────────────────────────


function HeroSection({
  course,
  completionPct,
  onContinue,
}: {
  course: { cover_image_url: string | null; welcome_video_url?: string | null; welcome_text?: string | null; home_config?: CourseHomeConfig | null };
  completionPct: number;
  onContinue: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const videoUrl = course.welcome_video_url ?? null;
  const embedUrl = videoUrl ? videoEmbed(videoUrl) : null;

  return (
    <section className="grid lg:grid-cols-2 gap-8 items-center">
      {/* Welcome text — LEFT */}
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

        {/* CTA */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onContinue}
            className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={{ background: "var(--st-yellow)", color: "var(--st-ink)", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(255,209,0,0.35)" }}
          >
            {completionPct > 0 ? "Continuer la formation" : "Commencer la formation"}
            <ChevronRight size={16} />
          </button>
          {course.home_config?.plan_url && (
            <a
              href={course.home_config.plan_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm font-medium"
              style={{ color: "var(--st-ink-muted)", textDecoration: "none", fontFamily: "inherit" }}
            >
              Voir le plan de la formation <ChevronRight size={14} />
            </a>
          )}
        </div>
      </div>

      {/* Video / cover — RIGHT */}
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
    </section>
  );
}

// ── Live banner ───────────────────────────────────────────────────────────────

function LiveBanner({
  meeting,
  onViewCalendar,
}: {
  meeting: CourseLiveMeeting;
  onViewCalendar: () => void;
}) {
  const now = new Date();
  const start = new Date(meeting.scheduled_at);
  const end = new Date(start.getTime() + meeting.duration_minutes * 60_000);
  const isLive = now >= start && now <= end;

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
            {isLive ? "En direct maintenant" : "Prochain live"}
          </p>
          <p className="text-base font-bold text-white">{meeting.title}</p>
        </div>
      </div>

      {/* Date */}
      {!isLive && (
        <div className="flex items-center gap-2 shrink-0">
          <Clock size={14} style={{ color: "rgba(255,255,255,0.5)" }} />
          <span className="text-sm text-white font-medium">
            {new Date(meeting.scheduled_at).toLocaleDateString("fr-FR", {
              weekday: "long", day: "numeric", month: "long",
            })} à {fmtLiveTime(meeting.scheduled_at)}
          </span>
        </div>
      )}

      {/* Description */}
      {meeting.description && (
        <p className="text-sm flex-1 min-w-0" style={{ color: "rgba(255,255,255,0.65)" }}>
          {meeting.description}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <button
          onClick={onViewCalendar}
          className="text-sm font-medium px-4 py-2 rounded-full border transition-all hover:bg-white/10"
          style={{ borderColor: "rgba(255,255,255,0.2)", color: "#fff", fontFamily: "inherit" }}
        >
          Voir toutes les dates
        </button>
        {isLive && meeting.meeting_url ? (
          <a
            href={meeting.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-all hover:-translate-y-px"
            style={{ background: "var(--st-yellow)", color: "#101820" }}
          >
            <Play size={14} />
            Rejoindre
          </a>
        ) : (
          <a
            href={googleCalendarUrl(meeting)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-all hover:-translate-y-px"
            style={{ background: "var(--st-yellow)", color: "#101820" }}
          >
            <CalendarPlus size={14} />
            Ajouter au calendrier
          </a>
        )}
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

function formatHomeDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function InfoCardsGrid({ config }: { config?: CourseHomeConfig | null }) {
  const c = config ?? {};
  const periodStart = formatHomeDate(c.period_start);
  const periodEnd = formatHomeDate(c.period_end);
  const hasPeriod = !!(periodStart || periodEnd || c.period_note);
  const objectives = (c.objectives ?? []).filter((o) => o.trim());
  const prerequisites = c.prerequisites?.trim();
  const documents = (c.documents ?? []).filter((d) => d.url?.trim());
  const instructor = c.instructor ?? null;
  const hasInstructor = !!(
    instructor &&
    (instructor.name || instructor.email || instructor.phone || instructor.cv_url || instructor.note || instructor.photo_url)
  );
  const hasAny = hasPeriod || objectives.length > 0 || !!prerequisites || documents.length > 0 || hasInstructor;
  if (!hasAny) return null;

  const instructorInitials =
    (instructor?.name || "")
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const linkStyle = { borderColor: "rgba(16,24,32,0.12)", color: "var(--st-ink)", textDecoration: "none" } as const;

  return (
    <section>
      <h2 className="text-base font-semibold mb-4" style={{ color: "var(--st-ink)" }}>Infos pratiques</h2>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {hasPeriod && (
          <InfoCard icon={Calendar} title="Période de formation">
            {(periodStart || periodEnd) && (
              <p className="font-semibold text-base mb-1" style={{ color: "var(--st-ink)" }}>
                {periodStart && <>Du {periodStart}</>}
                {periodStart && periodEnd && <br />}
                {periodEnd && <>au {periodEnd}</>}
              </p>
            )}
            {c.period_note && <p>{c.period_note}</p>}
          </InfoCard>
        )}

        {objectives.length > 0 && (
          <InfoCard icon={Target} title="Objectifs de la formation">
            <ul className="space-y-1.5">
              {objectives.map((obj) => (
                <li key={obj} className="flex items-start gap-1.5">
                  <span style={{ color: "var(--st-yellow)", fontWeight: 700, marginTop: 1 }}>✓</span>
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </InfoCard>
        )}

        {prerequisites && (
          <InfoCard icon={BookOpen} title="Prérequis">
            <p>{prerequisites}</p>
          </InfoCard>
        )}

        {documents.length > 0 && (
          <InfoCard icon={FileText} title="Documents utiles">
            <div className="space-y-2">
              {documents.map((doc) => (
                <a
                  key={doc.url}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all hover:bg-black/5 text-left"
                  style={linkStyle}
                >
                  <ExternalLink size={13} style={{ color: "var(--st-ink-muted)" }} />
                  {doc.label || "Document"}
                </a>
              ))}
            </div>
          </InfoCard>
        )}

        {hasInstructor && instructor && (
          <InfoCard icon={User} title="Votre formateur">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-sm font-bold"
                style={{ background: "var(--st-yellow)", color: "#101820" }}
              >
                {instructor.photo_url
                  ? <img src={instructor.photo_url} alt={instructor.name || ""} className="w-full h-full object-cover" />
                  : instructorInitials}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--st-ink)" }}>{instructor.name || "Votre formateur"}</p>
                {instructor.subtitle && <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>{instructor.subtitle}</p>}
              </div>
            </div>
            {instructor.note && (
              <p className="text-xs mb-3" style={{ color: "var(--st-ink-muted)" }}>{instructor.note}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {instructor.email && (
                <a href={`mailto:${instructor.email}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:bg-black/5" style={linkStyle}>
                  <Mail size={11} /> Email
                </a>
              )}
              {instructor.phone && (
                <a href={`tel:${instructor.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:bg-black/5" style={linkStyle}>
                  <Phone size={11} /> Téléphone
                </a>
              )}
              {instructor.cv_url && (
                <a href={instructor.cv_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:bg-black/5" style={linkStyle}>
                  <FileText size={11} /> CV
                </a>
              )}
            </div>
          </InfoCard>
        )}
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
  courseId,
  isPreview,
}: {
  courseTitle: string;
  learnerName: string;
  onMobileMenu: () => void;
  courseId?: string;
  isPreview?: boolean;
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
    { label: "Mes formations recommandées", icon: Sparkles, section: "recommandees" },
    { label: "Aide", icon: HelpCircle, section: "aide" },
  ];

  return (
    <>
      <ConfirmDialog />
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 lg:px-8 border-b"
        style={{
          background: "#ffffff",
          borderColor: "rgba(16,24,32,0.08)",
          height: 72,
          boxShadow: "0 1px 3px rgba(16,24,32,0.06)",
        }}
      >
        {/* Mobile menu toggle */}
        <button
          onClick={onMobileMenu}
          className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-black/5 shrink-0"
          aria-label="Menu"
        >
          <Menu size={20} style={{ color: "var(--st-ink)" }} />
        </button>

        {/* ── Left zone: logo + separator + course title ── */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Logo — nettement plus grand pour une vraie présence de marque */}
          <div className="shrink-0" style={{ height: 44 }}>
            <SupertiltLogo className="h-11" />
          </div>


          {/* Séparateur vertical */}
          <div
            className="hidden sm:block shrink-0"
            style={{ width: 1, height: 28, background: "rgba(16,24,32,0.12)" }}
          />

          {/* Titre de la formation — contexte de navigation, pas titre principal */}
          <p
            className="hidden sm:block truncate min-w-0 text-sm"
            style={{ color: "var(--st-ink-muted)", fontWeight: 450, letterSpacing: "-0.01em" }}
          >
            {courseTitle}
          </p>
        </div>

        {/* ── Right zone ── */}
        <div className="flex items-center gap-1 shrink-0 ml-2">

          {/* Admin edit shortcut */}
          {isPreview && courseId && (
            <a
              href={`/lms/${courseId}/edit`}
              className="mr-2"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 10,
                background: "#FFD100", color: "#101820",
                fontWeight: 700, fontSize: "0.8125rem",
                textDecoration: "none", flexShrink: 0,
              }}
            >
              Éditer
            </a>
          )}

          {/* Séparateur avant le compte */}
          <div
            className="hidden sm:block shrink-0 mx-2"
            style={{ width: 1, height: 28, background: "rgba(16,24,32,0.1)" }}
          />

          {/* Bloc compte utilisateur */}
          <div ref={ref} className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all hover:bg-black/[0.04] active:bg-black/[0.07]"
              style={{ fontFamily: "inherit" }}
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: "#FFD100", color: "#101820", fontSize: "0.9375rem" }}
              >
                {initial}
              </div>

              {/* Name block */}
              <div className="hidden sm:block text-left">
                <p className="text-[11px] leading-none mb-0.5" style={{ color: "var(--st-ink-muted)" }}>Bonjour</p>
                <p className="text-sm font-semibold leading-none" style={{ color: "var(--st-ink)" }}>
                  {learnerName || "Apprenant"}
                </p>
              </div>

              <ChevronDown
                size={14}
                className="hidden sm:block shrink-0 transition-transform duration-200"
                style={{
                  color: "var(--st-ink-muted)",
                  transform: open ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {/* Dropdown menu */}
            {open && (
              <div
                className="absolute right-0 top-full mt-2 z-50"
                style={{
                  width: 240,
                  background: "#ffffff",
                  border: "1px solid rgba(16,24,32,0.08)",
                  borderRadius: 16,
                  boxShadow: "0 8px 32px rgba(16,24,32,0.12), 0 2px 8px rgba(16,24,32,0.06)",
                  overflow: "hidden",
                }}
              >
                <div className="py-1.5">
                  {portalItems.map(({ label, icon: Icon, section }) => (
                    <button
                      key={section}
                      onClick={() => { navigate(`/espace-apprenant?section=${section}`); setOpen(false); }}
                      className="w-full flex items-center gap-3 text-sm text-left transition-colors hover:bg-black/[0.04]"
                      style={{
                        color: "var(--st-ink)",
                        fontFamily: "inherit",
                        padding: "10px 16px",
                      }}
                    >
                      <Icon size={16} strokeWidth={1.75} style={{ color: "var(--st-ink-muted)", flexShrink: 0 }} />
                      {label}
                    </button>
                  ))}
                </div>

                <div style={{ borderTop: "1px solid rgba(16,24,32,0.08)" }} className="py-1.5">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 text-sm text-left transition-colors hover:bg-red-50"
                    style={{
                      color: "#dc2626",
                      fontFamily: "inherit",
                      padding: "10px 16px",
                    }}
                  >
                    <LogOut size={16} strokeWidth={1.75} style={{ color: "#dc2626", flexShrink: 0 }} />
                    Se déconnecter
                  </button>
                </div>
              </div>
            )}
          </div>
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
  const { data: liveData } = useCourseLiveMeetings(courseId);
  const meetings = liveData?.meetings ?? [];

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initialView = searchParams.get("view") || "home";
  const [activeView, setActiveView] = useState<string>(initialView);

  // Completed lesson IDs
  const completedIds = useMemo(
    () => new Set(progress.filter((p) => p.status === "completed").map((p) => p.lesson_id)),
    [progress],
  );

  // IDs of modules that are regular (non-special)
  const regularModuleIds = useMemo(
    () => new Set(modules.filter((m) => !m.is_special_section).map((m) => m.id)),
    [modules],
  );

  // Overall completion % — excludes special-section lessons
  const completionPct = useMemo(() => {
    const regularLessons = allLessons.filter((l) => regularModuleIds.has(l.module_id));
    if (regularLessons.length === 0) return 0;
    const completedRegular = regularLessons.filter((l) => completedIds.has(l.id)).length;
    return (completedRegular / regularLessons.length) * 100;
  }, [completedIds, allLessons, regularModuleIds]);

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
      if (m.is_special_section) continue;
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
    for (const m of modules) {
      if (m.is_special_section) continue;
      counts[m.id] = (lessonsByModule[m.id] ?? []).length;
    }
    return counts;
  }, [modules, lessonsByModule]);

  const lessonsDoneByModule = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of modules) {
      if (m.is_special_section) continue;
      counts[m.id] = (lessonsByModule[m.id] ?? []).filter((l) => completedIds.has(l.id)).length;
    }
    return counts;
  }, [modules, lessonsByModule, completedIds]);

  const completedModulesCount = useMemo(
    () => Object.values(moduleStatuses).filter((s) => s === "completed").length,
    [moduleStatuses],
  );

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

  // Best meeting for LiveBanner: current live → next upcoming → most recent past
  const currentOrNextMeeting = useMemo(() => {
    if (!meetings.length) return null;
    const now = new Date();
    const live = meetings.find((m) => {
      const s = new Date(m.scheduled_at);
      const e = new Date(s.getTime() + m.duration_minutes * 60_000);
      return now >= s && now <= e;
    });
    if (live) return live;
    const upcoming = meetings.find((m) => new Date(m.scheduled_at) > now);
    if (upcoming) return upcoming;
    const past = [...meetings]
      .filter((m) => new Date(m.scheduled_at) <= now)
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    return past[0] ?? null;
  }, [meetings]);

  if (courseLoading || !course) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "var(--st-white)", fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif" }}>
        <p style={{ color: "var(--st-ink-muted)", fontSize: 14 }}>Chargement…</p>
      </div>
    );
  }

  const sortedModules = [...modules].sort((a, b) => a.position - b.position);
  const regularModules = sortedModules.filter((m) => !m.is_special_section);

  // View helpers
  const replayMeetingId = activeView.startsWith("replay:") ? activeView.slice(7) : null;
  const replayMeeting = replayMeetingId ? meetings.find((m) => m.id === replayMeetingId) ?? null : null;

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif", background: "var(--st-white)" }}
    >
      <CourseHomeHeader
        courseTitle={liveData?.training?.training_name || course.formation_configs?.formation_name || course.title}
        learnerName={learnerName}
        onMobileMenu={() => setSidebarOpen((v) => !v)}
        courseId={courseId}
        isPreview={isPreview}
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
            modules={regularModules}
            moduleStatuses={moduleStatuses}
            lessonCountByModule={lessonCountByModule}
            lessonsDoneByModule={lessonsDoneByModule}
            activeLessonId={null}
            communityPreviewCount={course.community_preview_count ?? 2}
            meetings={meetings}
            activeView={activeView}
            onModuleClick={handleModuleClick}
            onViewChange={setActiveView}
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
                  modules={regularModules}
                  moduleStatuses={moduleStatuses}
                  lessonCountByModule={lessonCountByModule}
                  lessonsDoneByModule={lessonsDoneByModule}
                  activeLessonId={null}
                  communityPreviewCount={course.community_preview_count ?? 2}
                  meetings={meetings}
                  activeView={activeView}
                  onModuleClick={(id) => { handleModuleClick(id); setSidebarOpen(false); }}
                  onViewChange={(v) => { setActiveView(v); setSidebarOpen(false); }}
                />
              </div>
            </div>
          </>
        )}

        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto" style={{ background: "#F2F4F4" }}>
          {/* Mobile progress bar — only on home view */}
          {activeView === "home" && (
            <div
              className="lg:hidden flex items-center gap-3 px-6 py-3 border-b"
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
          )}

          {/* Back button for non-home views */}
          {activeView !== "home" && (
            <div className="px-6 sm:px-10 lg:px-12 pt-7">
              <button
                onClick={() => setActiveView("home")}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-all hover:bg-black/5"
                style={{ borderColor: "rgba(16,24,32,0.15)", color: "var(--st-ink-muted)", fontFamily: "inherit", background: "var(--st-white)" }}
              >
                <ArrowLeft size={13} />
                Accueil du cours
              </button>
            </div>
          )}

          <div className="px-6 sm:px-10 lg:px-12 py-8 flex flex-col gap-8 max-w-[1440px] mx-auto w-full">
            {activeView === "home" && (
              <>
                <HeroSection
                  course={course}
                  completionPct={completionPct}
                  onContinue={handleContinue}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <ProgressCard
                    completionPct={completionPct}
                    completedLessons={allLessons.filter((l) => regularModuleIds.has(l.module_id) && completedIds.has(l.id)).length}
                    totalLessons={allLessons.filter((l) => regularModuleIds.has(l.module_id)).length}
                    completedModules={completedModulesCount}
                    totalModules={regularModules.length}
                    onSeeStats={() => {}}
                  />
                  <LiveCard
                    meeting={currentOrNextMeeting}
                    onViewCalendar={() => setActiveView("calendar")}
                  />
                  <CommunityInfoCard courseId={courseId!} email={email} />
                </div>
                <div className="grid lg:grid-cols-[1fr_300px] gap-7 items-start">
                  <ModulesListSection
                    modules={regularModules}
                    moduleStatuses={moduleStatuses}
                    lessonCountByModule={lessonCountByModule}
                    lessonsDoneByModule={lessonsDoneByModule}
                    onModuleClick={handleModuleClick}
                  />
                  <TipsBlock />
                </div>
                <InfoCardsGrid config={course.home_config} />
              </>
            )}

            {activeView === "calendar" && liveData && (
              <CalendarView
                liveData={liveData}
                onReplay={(id) => setActiveView(`replay:${id}`)}
              />
            )}

            {replayMeeting && (
              <ReplayView meeting={replayMeeting} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
