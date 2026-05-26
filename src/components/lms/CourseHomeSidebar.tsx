import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Calendar,
  Play,
  Video,
  Users,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePracticePosts } from "@/hooks/usePracticeFeed";
import type { CourseLiveMeeting } from "@/hooks/useLmsQueries";

export type ModuleStatus = "completed" | "in_progress" | "not_started";

export function ModuleStatusIcon({ status, num }: { status: ModuleStatus; num: number }) {
  if (status === "completed") {
    return <CheckCircle2 size={36} style={{ color: "#69C3C4", flexShrink: 0 }} />;
  }
  const borderColor = status === "in_progress" ? "#FFD100" : "#CCCCCC";
  const bg = status === "in_progress" ? "#FFD100" : "transparent";
  const textColor = status === "in_progress" ? "#101820" : "#AAAAAA";
  return (
    <div
      className="w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0"
      style={{ borderColor, background: bg }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: textColor, lineHeight: 1, letterSpacing: 0 }}>
        M{num}
      </span>
    </div>
  );
}

function authorName(email: string, firstName?: string | null, lastName?: string | null): string {
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  return email.split("@")[0];
}
function authorInitials(email: string, firstName?: string | null, lastName?: string | null): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function CommunitySidebarPreview({ email }: { email: string }) {
  const navigate = useNavigate();
  const { data: posts = [] } = usePracticePosts(email || null, 2);
  const goToCommunity = () => navigate("/espace-apprenant?section=pratique");

  return (
    <div className="p-5 border-b" style={{ borderColor: "rgba(16,24,32,0.08)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--st-ink-muted)" }}>
          Communauté
        </p>
        <button
          onClick={goToCommunity}
          className="text-[10px] font-semibold uppercase tracking-wider hover:underline"
          style={{ color: "var(--st-ink-muted)" }}
        >
          Voir tout
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="py-2">
          <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>Aucun post pour l'instant.</p>
          <button
            onClick={goToCommunity}
            className="mt-2 text-xs font-semibold underline"
            style={{ color: "var(--st-ink-muted)", fontFamily: "inherit" }}
          >
            Soyez le premier à publier →
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => {
            const name = authorName(post.author_email, post.author_first_name, post.author_last_name);
            const initials = authorInitials(post.author_email, post.author_first_name, post.author_last_name);
            return (
              <li key={post.id}>
                <button
                  onClick={goToCommunity}
                  className="w-full flex items-start gap-2.5 text-left rounded-lg p-1 -m-1 transition-colors hover:bg-black/[0.03]"
                >
                  <div
                    className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: post.author_photo_url ? "transparent" : "var(--st-yellow)", color: "#101820" }}
                  >
                    {post.author_photo_url
                      ? <img src={post.author_photo_url} alt={name} className="w-full h-full object-cover" />
                      : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: "var(--st-ink)" }}>{name}</p>
                    {post.content && (
                      <p className="text-xs line-clamp-2 mt-0.5" style={{ color: "var(--st-ink-muted)" }}>
                        {post.content}
                      </p>
                    )}
                    {!post.content && post.file_url && (
                      <p className="text-xs mt-0.5 italic" style={{ color: "var(--st-ink-muted)" }}>A partagé une photo</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: "var(--st-ink-muted)" }}>
                      <span>{post.reaction_count} j'aime</span>
                      <span>·</span>
                      <span>{post.comment_count} comm.</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={goToCommunity}
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-black/5"
        style={{ background: "rgba(16,24,32,0.04)", color: "var(--st-ink)", fontFamily: "inherit" }}
      >
        <Users size={13} />
        Aller à la communauté
      </button>
    </div>
  );
}

export interface CourseHomeSidebarProps {
  courseId: string;
  email: string;
  isPreview: boolean;
  modules: Array<{ id: string; title: string; position: number }>;
  moduleStatuses: Record<string, ModuleStatus>;
  lessonCountByModule: Record<string, number>;
  lessonsDoneByModule: Record<string, number>;
  communityPreviewCount: number;
  meetings: CourseLiveMeeting[];
  activeView: string;
  onModuleClick: (moduleId: string) => void;
  onViewChange: (view: string) => void;
  // Optional: when provided, the module containing activeLessonId expands with its lessons listed.
  lessonsByModule?: Record<string, Array<{ id: string; title: string }>>;
  activeLessonId?: string | null;
  completedLessonIds?: Set<string>;
  onLessonClick?: (lessonId: string) => void;
}

export default function CourseHomeSidebar({
  courseId,
  email,
  isPreview,
  modules,
  moduleStatuses,
  lessonCountByModule,
  lessonsDoneByModule,
  communityPreviewCount,
  meetings,
  activeView,
  onModuleClick,
  onViewChange,
  lessonsByModule,
  activeLessonId,
  completedLessonIds,
  onLessonClick,
}: CourseHomeSidebarProps) {
  const activeModuleId = activeLessonId && lessonsByModule
    ? modules.find((m) => (lessonsByModule[m.id] || []).some((l) => l.id === activeLessonId))?.id ?? null
    : null;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (activeModuleId) setExpanded((prev) => (prev[activeModuleId] ? prev : { ...prev, [activeModuleId]: true }));
  }, [activeModuleId]);
  const toggleModule = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: "var(--st-white)" }}
    >
      {/* Live et replays */}
      {meetings.length > 0 && (() => {
        const now = Date.now();
        const next = [...meetings]
          .filter((m) => new Date(m.scheduled_at).getTime() >= now)
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
        const nextLabel = next
          ? new Date(next.scheduled_at).toLocaleString("fr-FR", {
              weekday: "short", day: "numeric", month: "short",
              hour: "2-digit", minute: "2-digit",
            })
          : "Aucun live à venir";
        return (
          <div className="p-3 pb-3 border-b" style={{ borderColor: "rgba(16,24,32,0.06)", background: "#101820" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1 px-2" style={{ color: "rgba(255,209,0,0.7)", letterSpacing: ".06em" }}>
              Live &amp; Replays
            </p>
            <p className="text-xs px-2 mb-2 flex items-center gap-1.5" style={{ color: "#FFD100" }}>
              <Video size={12} style={{ flexShrink: 0 }} />
              <span className="truncate">Prochain live · {nextLabel}</span>
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
            </ul>
          </div>
        );
      })()}


      {!isPreview && <CommunitySidebarPreview email={email} />}

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
            const moduleLessons = (lessonsByModule?.[m.id]) ?? [];
            const hasLessons = moduleLessons.length > 0;
            const isOpen = !!expanded[m.id];
            return (
              <li key={m.id}>
                <div
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-black/5"
                  style={{ fontFamily: "inherit" }}
                >
                  <button
                    onClick={() => onModuleClick(m.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
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
                  </button>
                  {hasLessons && (
                    <button
                      onClick={() => toggleModule(m.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-md shrink-0 hover:bg-black/10 transition-colors"
                      aria-label={isOpen ? "Replier" : "Déplier"}
                    >
                      <ChevronDown
                        size={14}
                        style={{ color: "var(--st-ink-muted)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                      />
                    </button>
                  )}
                </div>

                {isOpen && hasLessons && (
                  <ul className="mt-1 ml-12 space-y-0.5 mb-2">
                    {moduleLessons.map((lesson) => {
                      const isActiveLesson = lesson.id === activeLessonId;
                      const isDone = completedLessonIds?.has(lesson.id) ?? false;
                      return (
                        <li key={lesson.id}>
                          <button
                            onClick={() => onLessonClick?.(lesson.id)}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors text-xs",
                              !isActiveLesson && "hover:bg-black/5",
                            )}
                            style={{
                              fontFamily: "inherit",
                              background: isActiveLesson ? "#FFD100" : "transparent",
                              color: isActiveLesson ? "#101820" : "var(--st-ink-muted)",
                              fontWeight: isActiveLesson ? 600 : 400,
                            }}
                          >
                            {isDone
                              ? <CheckCircle2 size={12} style={{ color: "#69C3C4", flexShrink: 0 }} />
                              : <Play size={11} style={{ flexShrink: 0, opacity: isActiveLesson ? 1 : 0.5 }} />}
                            <span className="truncate leading-snug">{lesson.title}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
