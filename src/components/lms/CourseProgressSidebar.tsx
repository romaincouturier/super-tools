import { useState, useMemo, useEffect } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Lock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LmsModule, LmsLesson } from "@/hooks/useLms";

// ── Lesson tag detection ──────────────────────────────────────────────────────

interface LessonTag {
  label: string;
  bg: string;
  color: string;
}

function detectLessonTag(lesson: LmsLesson): LessonTag | null {
  if (lesson.lesson_type === "quiz")
    return { label: "Quiz", bg: "rgba(249,115,22,0.12)", color: "#ea580c" };
  if (lesson.lesson_type === "assignment" || lesson.work_deposit_enabled)
    return { label: "Exercice", bg: "rgba(168,85,247,0.1)", color: "#9333ea" };
  const t = lesson.title.toLowerCase();
  if (t.includes("live"))
    return { label: "Live", bg: "rgba(240,130,117,0.15)", color: "#e05d4b" };
  if (t.includes("échange") || t.includes("echange") || t.includes("binôme") || t.includes("binome"))
    return { label: "Échange", bg: "rgba(96,165,250,0.12)", color: "#2563eb" };
  if (lesson.lesson_type === "file" || t.includes("ressource"))
    return { label: "Ressource", bg: "rgba(107,114,128,0.1)", color: "#4b5563" };
  return null;
}

// ── Lesson status icon ────────────────────────────────────────────────────────

function LessonIcon({
  completed,
  active,
  position,
  locked,
}: {
  completed: boolean;
  active: boolean;
  position: number;
  locked: boolean;
}) {
  if (locked) {
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "rgba(16,24,32,0.06)" }}>
        <Lock size={10} style={{ color: "rgba(16,24,32,0.3)" }} />
      </div>
    );
  }
  if (completed) {
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "rgba(105,195,196,0.15)" }}>
        <CheckCircle2 size={14} style={{ color: "#69c3c4" }} />
      </div>
    );
  }
  if (active) {
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "#FFD100" }}>
        <Play size={9} style={{ color: "#101820", marginLeft: 1 }} />
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
      style={{ background: "rgba(16,24,32,0.07)", color: "rgba(16,24,32,0.45)" }}>
      {position}
    </div>
  );
}

// ── Lesson row ────────────────────────────────────────────────────────────────

function LessonRow({
  lesson,
  position,
  isCompleted,
  isActive,
  isLocked,
  onClick,
}: {
  lesson: LmsLesson;
  position: number;
  isCompleted: boolean;
  isActive: boolean;
  isLocked: boolean;
  onClick: () => void;
}) {
  const tag = detectLessonTag(lesson);

  return (
    <button
      type="button"
      disabled={isLocked}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all group",
        isActive
          ? "font-medium"
          : "hover:bg-black/5",
        isLocked && "cursor-not-allowed opacity-50",
      )}
      style={
        isActive
          ? { background: "#FFFBEA", fontFamily: "inherit" }
          : { fontFamily: "inherit" }
      }
    >
      <div className="mt-0.5 shrink-0">
        <LessonIcon
          completed={isCompleted}
          active={isActive}
          position={position}
          locked={isLocked}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn("text-sm leading-snug", isCompleted && !isActive && "opacity-60")}
          style={{ color: isActive ? "#101820" : "var(--st-ink, #101820)", fontWeight: isActive ? 600 : 400 }}
        >
          {lesson.title}
        </p>

        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
          {tag && (
            <span
              className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-md leading-none"
              style={{ background: tag.bg, color: tag.color }}
            >
              {tag.label}
            </span>
          )}
          {lesson.estimated_minutes > 0 && (
            <span className="text-[11px]" style={{ color: "rgba(16,24,32,0.4)" }}>
              {lesson.estimated_minutes} min
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Module block ──────────────────────────────────────────────────────────────

function ModuleBlock({
  mod,
  moduleIndex,
  lessons,
  completedIds,
  selectedLessonId,
  isLocked,
  onSelectLesson,
  defaultOpen,
}: {
  mod: LmsModule;
  moduleIndex: number;
  lessons: LmsLesson[];
  completedIds: Set<string>;
  selectedLessonId: string | null;
  isLocked: boolean;
  onSelectLesson: (id: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const hasLesson = lessons.some((l) => l.id === selectedLessonId);
    if (hasLesson) {
      setOpen(true);
    } else if (selectedLessonId !== null) {
      // Auto-close when the active lesson moves to another module.
      // selectedLessonId !== null guard preserves manual state when no lesson is selected.
      setOpen(false);
    }
  }, [selectedLessonId]);

  const completedCount = lessons.filter((l) => completedIds.has(l.id)).length;
  const pct = lessons.length > 0 ? (completedCount / lessons.length) * 100 : 0;
  const allDone = completedCount === lessons.length && lessons.length > 0;
  const hasActive = lessons.some((l) => l.id === selectedLessonId);

  return (
    <div>
      {/* Module header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start gap-0 px-0 py-0 rounded-none text-left focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ fontFamily: "inherit", background: "transparent" }}
      >
        <div className="flex-1 min-w-0 space-y-2">
          {/* Module label + collapse */}
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
              style={{
                background: allDone ? "rgba(105,195,196,0.15)" : hasActive ? "#FFFBEA" : "rgba(16,24,32,0.06)",
                color: allDone ? "#69c3c4" : hasActive ? "#101820" : "rgba(16,24,32,0.45)",
              }}
            >
              Module {moduleIndex}
            </span>
            {allDone && <CheckCircle2 size={12} style={{ color: "#69c3c4" }} />}
            {isLocked && <Lock size={11} style={{ color: "rgba(16,24,32,0.3)" }} />}
            <div className="flex-1" />
            {open ? (
              <ChevronDown size={14} style={{ color: "rgba(16,24,32,0.4)" }} />
            ) : (
              <ChevronRight size={14} style={{ color: "rgba(16,24,32,0.4)" }} />
            )}
          </div>

          {/* Title */}
          <p className="text-sm font-semibold leading-snug text-left" style={{ color: "var(--st-ink, #101820)" }}>
            {mod.title}
          </p>

          {/* Progress */}
          <div className="space-y-1">
            <p className="text-[11px]" style={{ color: "rgba(16,24,32,0.5)" }}>
              {completedCount} / {lessons.length} terminée{lessons.length !== 1 ? "s" : ""}
            </p>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(16,24,32,0.08)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: allDone ? "#69c3c4" : "#FFD100",
                }}
              />
            </div>
          </div>
        </div>
      </button>

      {/* Lesson list */}
      {open && (
        <div className="mt-2 space-y-0.5">
          {lessons.map((lesson, idx) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              position={idx + 1}
              isCompleted={completedIds.has(lesson.id)}
              isActive={lesson.id === selectedLessonId}
              isLocked={isLocked}
              onClick={() => !isLocked && onSelectLesson(lesson.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

interface CourseProgressSidebarProps {
  modules: LmsModule[];
  lessonsByModule: Record<string, LmsLesson[]>;
  completedIds: Set<string>;
  selectedLessonId: string | null;
  onSelectLesson: (id: string) => void;
  isModuleUnlocked: (mod: LmsModule) => boolean;
}

export default function CourseProgressSidebar({
  modules,
  lessonsByModule,
  completedIds,
  selectedLessonId,
  onSelectLesson,
  isModuleUnlocked,
}: CourseProgressSidebarProps) {
  // Determine which module contains the active lesson
  const activeModuleId = useMemo(() => {
    for (const mod of modules) {
      if ((lessonsByModule[mod.id] ?? []).some((l) => l.id === selectedLessonId)) return mod.id;
    }
    return null;
  }, [modules, lessonsByModule, selectedLessonId]);

  const sortedModules = useMemo(() => [...modules].sort((a, b) => a.position - b.position), [modules]);

  return (
    <nav
      aria-label="Progression du cours"
      className="h-full overflow-y-auto"
      style={{ fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="px-4 py-5 space-y-6">
        {sortedModules.map((mod, i) => {
          const lessons = (lessonsByModule[mod.id] ?? []).sort((a, b) => a.position - b.position);
          const unlocked = isModuleUnlocked(mod);
          const completedCount = lessons.filter((l) => completedIds.has(l.id)).length;
          const allDone = completedCount === lessons.length && lessons.length > 0;
          const isActiveModule = mod.id === activeModuleId;
          // Only open the active module by default; never pre-open all unlocked modules
          // (avoids the flash of all-expanded when selectedLessonId hasn't been set yet)
          const defaultOpen = isActiveModule;

          return (
            <div key={mod.id} className="border-b pb-5 last:border-b-0 last:pb-0"
              style={{ borderColor: "rgba(16,24,32,0.07)" }}>
              <ModuleBlock
                mod={mod}
                moduleIndex={i + 1}
                lessons={lessons}
                completedIds={completedIds}
                selectedLessonId={selectedLessonId}
                isLocked={!unlocked}
                onSelectLesson={onSelectLesson}
                defaultOpen={defaultOpen}
              />
            </div>
          );
        })}
      </div>
    </nav>
  );
}
