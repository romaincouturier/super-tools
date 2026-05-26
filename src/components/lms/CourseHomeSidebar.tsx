import { useRef, useState } from "react";
import DOMPurify from "dompurify";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  Calendar,
  Play,
  Video,
  Send,
  Paperclip,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCourseForums,
  useForumPosts,
  useCreateForumPost,
  uploadForumAttachment,
} from "@/hooks/useLms";
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
    } catch {
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
}: CourseHomeSidebarProps) {
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


      {!isPreview && (
        <CommunitySidebarPreview
          courseId={courseId}
          email={email}
          previewCount={communityPreviewCount}
        />
      )}

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
