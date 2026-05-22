import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Copy, FileText, Plus, ChevronUp, ChevronDown, Pencil, Trash2, ArrowRightLeft, Layers } from "lucide-react";
import {
  useCourseModules,
  useModuleLessons,
  useCreateModule,
  useCreateLesson,
  useUpdateModule,
  useDeleteModule,
  useDeleteLesson,
  useDuplicateLesson,
  useReorderModules,
  useReorderLessons,
  useMoveLessonToModule,
  LmsModule,
  LmsLesson,
} from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { toastError } from "@/lib/toastError";

interface Props {
  courseId: string;
  activeLessonId: string;
  courseTitle: string;
}

export default function BuilderSidebar({ courseId, activeLessonId, courseTitle }: Props) {
  const { data: modules = [] } = useCourseModules(courseId);
  const createModule = useCreateModule();
  const reorderModules = useReorderModules();
  const { toast } = useToast();

  const handleAddModule = async () => {
    try {
      await createModule.mutateAsync({
        course_id: courseId,
        title: "Nouveau module",
        position: modules.length,
      });
      toast({ title: "Module ajouté" });
    } catch {
      toast({ title: "Erreur lors de la création du module", variant: "destructive" });
    }
  };

  const handleMoveModule = async (modId: string, dir: "up" | "down") => {
    const idx = modules.findIndex((m) => m.id === modId);
    if (idx < 0) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= modules.length) return;
    const updates = modules.map((m, i) => {
      if (i === idx) return { id: m.id, position: modules[swapIdx].position };
      if (i === swapIdx) return { id: m.id, position: modules[idx].position };
      return { id: m.id, position: m.position };
    });
    try {
      await reorderModules.mutateAsync(updates);
    } catch {
      toast({ title: "Erreur lors de la réorganisation", variant: "destructive" });
    }
  };

  return (
    <aside
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: "var(--st-surface)", fontFamily: "inherit", padding: "1rem" }}
    >
      {/* Section header */}
      <div
        className="px-2 py-2"
        style={{ fontWeight: 700, fontSize: ".6875rem", letterSpacing: ".05em", color: "var(--st-ink-50)", textTransform: "uppercase" }}
      >
        Structure du cours
      </div>

      {/* Module list */}
      <nav className="flex-1">
        {modules.map((mod, idx) => (
          <ModuleItem
            key={mod.id}
            mod={mod}
            courseId={courseId}
            activeLessonId={activeLessonId}
            allModules={modules}
            index={idx + 1}
            isFirst={idx === 0}
            isLast={idx === modules.length - 1}
            onMoveUp={() => handleMoveModule(mod.id, "up")}
            onMoveDown={() => handleMoveModule(mod.id, "down")}
          />
        ))}

        {/* Add module button */}
        <button
          disabled={createModule.isPending}
          onClick={handleAddModule}
          className="w-full flex items-center gap-2 text-left"
          style={{
            padding: ".5rem .75rem",
            fontSize: ".8125rem",
            color: "var(--st-ink-60)",
            borderRadius: 6,
            fontWeight: 500,
            marginTop: ".25rem",
            opacity: createModule.isPending ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.04)";
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink-60)";
          }}
        >
          <Plus size={14} />
          <span>{createModule.isPending ? "Création…" : "Ajouter un module"}</span>
        </button>
      </nav>

      {/* User footer */}
      <div style={{ marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid var(--st-ink-06)" }}>
        <div className="flex items-center gap-2.5 px-3 py-2" style={{ borderRadius: 8 }}>
          <div
            className="flex items-center justify-center shrink-0 font-bold"
            style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--st-ink)", color: "var(--st-yellow)", fontSize: ".75rem" }}
          >
            {courseTitle ? courseTitle.slice(0, 2).toUpperCase() : "—"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: ".8125rem", fontWeight: 600, color: "var(--st-ink)" }}>
              {courseTitle ? courseTitle.split(" ").slice(0, 2).join(" ") : "Auteur"}
            </div>
            <div style={{ fontSize: ".6875rem", color: "var(--st-ink-60)" }}>Formateur</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ReorderButtons({
  isFirst,
  isLast,
  onUp,
  onDown,
  disabled,
}: {
  isFirst: boolean;
  isLast: boolean;
  onUp: () => void;
  onDown: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        type="button"
        aria-label="Monter"
        disabled={isFirst || disabled}
        onClick={(e) => {
          e.stopPropagation();
          onUp();
        }}
        style={{
          padding: 2,
          borderRadius: 4,
          background: "transparent",
          color: isFirst || disabled ? "rgba(16,24,32,0.2)" : "var(--st-ink-60)",
          cursor: isFirst || disabled ? "not-allowed" : "pointer",
          display: "flex",
        }}
        onMouseEnter={(e) => {
          if (!isFirst && !disabled) {
            (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.08)";
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          if (!isFirst && !disabled) {
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink-60)";
          }
        }}
      >
        <ChevronUp size={12} />
      </button>
      <button
        type="button"
        aria-label="Descendre"
        disabled={isLast || disabled}
        onClick={(e) => {
          e.stopPropagation();
          onDown();
        }}
        style={{
          padding: 2,
          borderRadius: 4,
          background: "transparent",
          color: isLast || disabled ? "rgba(16,24,32,0.2)" : "var(--st-ink-60)",
          cursor: isLast || disabled ? "not-allowed" : "pointer",
          display: "flex",
        }}
        onMouseEnter={(e) => {
          if (!isLast && !disabled) {
            (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.08)";
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          if (!isLast && !disabled) {
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink-60)";
          }
        }}
      >
        <ChevronDown size={12} />
      </button>
    </div>
  );
}

function ModuleItem({
  mod,
  courseId,
  activeLessonId,
  allModules,
  index,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  mod: LmsModule;
  courseId: string;
  activeLessonId: string;
  allModules: LmsModule[];
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { data: lessons = [] } = useModuleLessons(mod.id);
  const hasActive = lessons.some((l) => l.id === activeLessonId);
  const [open, setOpen] = useState(hasActive);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(mod.title);
  const renameRef = useRef<HTMLInputElement>(null);
  const createLesson = useCreateLesson();
  const updateModule = useUpdateModule();
  const deleteModule = useDeleteModule();
  const reorderLessons = useReorderLessons();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(mod.title);
    setRenaming(true);
    setOpen(true);
  };

  const handleCommitRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === mod.title) { setRenaming(false); return; }
    try {
      await updateModule.mutateAsync({ id: mod.id, title: trimmed });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur de renommage");
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const hasContent = lessons.length > 0;
    const description = hasContent
      ? `Ce module contient ${lessons.length} leçon${lessons.length > 1 ? "s" : ""}. En le supprimant, les leçons et éléments associés seront également supprimés. Cette action est irréversible.`
      : "Cette action est irréversible.";

    const ok = await confirm({
      title: `Supprimer le module "${mod.title}" ?`,
      description,
      confirmText: "Oui, supprimer ce module",
      cancelText: "Annuler",
      variant: "destructive",
    });
    if (!ok) return;

    const activeInModule = lessons.some((l) => l.id === activeLessonId);
    try {
      await deleteModule.mutateAsync(mod.id);
      toast({ title: "Module supprimé" });
      if (activeInModule) navigate(`/lms/${courseId}`);
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur de suppression");
    }
  };

  const handleToggleSpecial = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateModule.mutateAsync({ id: mod.id, is_special_section: !mod.is_special_section });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur");
    }
  };

  const handleAddLesson = async () => {
    try {
      const lesson = await createLesson.mutateAsync({
        module_id: mod.id,
        title: "Nouvelle leçon",
        lesson_type: "text",
        position: lessons.length,
      });
      toast({ title: "Leçon ajoutée" });
      navigate(`/lms/${courseId}/lesson/${lesson.id}/builder`);
    } catch {
      toast({ title: "Erreur lors de la création de la leçon", variant: "destructive" });
    }
  };

  const handleMoveLesson = async (lessonId: string, dir: "up" | "down") => {
    const idx = lessons.findIndex((l) => l.id === lessonId);
    if (idx < 0) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= lessons.length) return;
    const updates = lessons.map((l, i) => {
      if (i === idx) return { id: l.id, position: lessons[swapIdx].position };
      if (i === swapIdx) return { id: l.id, position: lessons[idx].position };
      return { id: l.id, position: l.position };
    });
    try {
      await reorderLessons.mutateAsync(updates);
    } catch {
      toast({ title: "Erreur lors de la réorganisation", variant: "destructive" });
    }
  };

  return (
    <div style={{ marginBottom: ".25rem" }}>
      <ConfirmDialog />
      {/* Module header */}
      <div
        className="group flex items-start gap-2 cursor-pointer"
        onClick={() => !renaming && setOpen((o) => !o)}
        style={{ padding: ".5rem .75rem", fontWeight: 600, fontSize: ".875rem", color: "var(--st-ink)", borderRadius: 8, justifyContent: "space-between" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.04)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
      >
        <div className="flex items-start gap-2" style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
          <ChevronRight
            size={14}
            style={{
              color: "var(--st-ink-50)",
              transform: open ? "rotate(90deg)" : "none",
              transition: "transform 160ms",
              flexShrink: 0,
            }}
          />
          {renaming ? (
            <input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleCommitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleCommitRename(); }
                if (e.key === "Escape") { setRenaming(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 outline-none rounded px-1"
              style={{ fontSize: ".875rem", fontWeight: 600, color: "var(--st-ink)", background: "var(--st-white)", border: "1px solid rgba(16,24,32,0.2)", padding: "1px 4px" }}
            />
          ) : (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: ".6875rem", fontWeight: 700, color: mod.is_special_section ? "rgba(255,209,0,0.7)" : "var(--st-ink-50)", letterSpacing: ".04em", textTransform: "uppercase", lineHeight: 1.2 }}>
                {mod.is_special_section ? "Section spéciale" : `Module ${index}`}
              </div>
              <div
                title={mod.title}
                style={{
                  fontSize: ".875rem",
                  fontWeight: 600,
                  color: "var(--st-ink)",
                  lineHeight: 1.35,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {mod.title}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-start gap-1" style={{ flexShrink: 0 }}>
          {/* Rename + Delete — visible on hover */}
          {!renaming && (
            <>
              <button
                type="button"
                aria-label="Renommer le module"
                onClick={handleStartRename}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                style={{ width: 22, height: 22, borderRadius: 4, padding: 0, color: "var(--st-ink-50)", background: "transparent" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.1)"; (e.currentTarget as HTMLElement).style.color = "var(--st-ink)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--st-ink-50)"; }}
              >
                <Pencil size={11} />
              </button>
              <button
                type="button"
                aria-label="Supprimer le module"
                onClick={handleDelete}
                disabled={deleteModule.isPending}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                style={{ width: 22, height: 22, borderRadius: 4, padding: 0, color: "var(--st-ink-50)", background: "transparent" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,0.08)"; (e.currentTarget as HTMLElement).style.color = "#dc2626"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--st-ink-50)"; }}
              >
                <Trash2 size={11} />
              </button>
              <button
                type="button"
                aria-label={mod.is_special_section ? "Convertir en module normal" : "Marquer comme section spéciale"}
                onClick={handleToggleSpecial}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                style={{ width: 22, height: 22, borderRadius: 4, padding: 0, color: mod.is_special_section ? "rgba(255,209,0,0.9)" : "var(--st-ink-50)", background: mod.is_special_section ? "rgba(255,209,0,0.15)" : "transparent" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,209,0,0.2)"; (e.currentTarget as HTMLElement).style.color = "#b8950a"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = mod.is_special_section ? "rgba(255,209,0,0.15)" : "transparent"; (e.currentTarget as HTMLElement).style.color = mod.is_special_section ? "rgba(255,209,0,0.9)" : "var(--st-ink-50)"; }}
              >
                <Layers size={11} />
              </button>
            </>
          )}
          <ReorderButtons isFirst={isFirst} isLast={isLast} onUp={onMoveUp} onDown={onMoveDown} />
          <span style={{ fontWeight: 500, fontSize: ".75rem", color: "var(--st-ink-50)" }}>
            {lessons.length}
          </span>
        </div>
      </div>

      {/* Lessons with slide animation */}
      <div style={{ overflow: "hidden", maxHeight: open ? "1000px" : 0, transition: "max-height 240ms ease" }}>
        {lessons.map((lesson, idx) => (
          <LessonItem
            key={lesson.id}
            lesson={lesson}
            courseId={courseId}
            currentModuleId={mod.id}
            otherModules={allModules.filter((m) => m.id !== mod.id)}
            isActive={lesson.id === activeLessonId}
            isFirst={idx === 0}
            isLast={idx === lessons.length - 1}
            onMoveUp={() => handleMoveLesson(lesson.id, "up")}
            onMoveDown={() => handleMoveLesson(lesson.id, "down")}
          />
        ))}

        {/* Add lesson button */}
        <button
          disabled={createLesson.isPending}
          onClick={handleAddLesson}
          className="w-full flex items-center gap-2 text-left"
          style={{
            padding: ".375rem .75rem .375rem 2rem",
            fontSize: ".8125rem",
            color: "var(--st-ink-50)",
            borderRadius: 6,
            fontWeight: 400,
            opacity: createLesson.isPending ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
            (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.04)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink-50)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <Plus size={12} />
          <span>{createLesson.isPending ? "Création…" : "Ajouter une leçon"}</span>
        </button>
      </div>
    </div>
  );
}

function LessonItem({
  lesson,
  courseId,
  currentModuleId: _currentModuleId,
  otherModules,
  isActive,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  lesson: LmsLesson;
  courseId: string;
  currentModuleId: string;
  otherModules: LmsModule[];
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const navigate = useNavigate();
  const deleteLesson = useDeleteLesson();
  const duplicateLesson = useDuplicateLesson();
  const moveLesson = useMoveLessonToModule();
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const handleMoveToModule = async (e: React.MouseEvent, targetModuleId: string) => {
    e.stopPropagation();
    setShowMoveMenu(false);
    try {
      await moveLesson.mutateAsync({ lessonId: lesson.id, targetModuleId });
      toast({ title: "Leçon déplacée" });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur lors du déplacement");
    }
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const copy = await duplicateLesson.mutateAsync(lesson.id);
      toast({ title: "Leçon dupliquée" });
      navigate(`/lms/${courseId}/lesson/${copy.id}/builder`);
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur de duplication");
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: `Supprimer la leçon "${lesson.title}" ?`,
      description: "Cette action est irréversible. Le contenu de la leçon sera définitivement supprimé.",
      confirmText: "Oui, supprimer cette leçon",
      cancelText: "Annuler",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await deleteLesson.mutateAsync(lesson.id);
      toast({ title: "Leçon supprimée" });
      if (isActive) navigate(`/lms/${courseId}`);
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur de suppression");
    }
  };

  return (
    <>
      <ConfirmDialog />
      <div
        className="group flex items-center gap-1.5 cursor-pointer relative"
        onClick={() => navigate(`/lms/${courseId}/lesson/${lesson.id}/builder`)}
        style={{
          padding: isActive ? ".5rem .5rem .5rem 1.75rem" : ".5rem .5rem .5rem 2rem",
          fontSize: ".875rem",
          fontWeight: isActive ? 600 : 400,
          color: isActive ? "var(--st-ink)" : "var(--st-ink-70, rgba(16,24,32,0.7))",
          borderRadius: 6,
          borderLeft: isActive ? "3px solid var(--st-yellow)" : "3px solid transparent",
          background: isActive ? "var(--st-yellow-soft)" : "transparent",
          transition: "color 120ms ease, background 120ms ease",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
            (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.03)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink-70, rgba(16,24,32,0.7))";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }
        }}
      >
        <span
          className="flex items-center justify-center shrink-0"
          style={{ width: 16, height: 16, color: isActive ? "var(--st-ink)" : "rgba(16,24,32,0.4)" }}
        >
          <FileText size={16} />
        </span>
        <span
          style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={lesson.title}
        >
          {lesson.title}
        </span>

        {/* Action overlay — absolutely positioned so it never compresses the title */}
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center gap-0.5 pl-5 pr-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
          style={{
            background: isActive
              ? "linear-gradient(90deg, transparent, #FFFBEA 35%)"
              : "linear-gradient(90deg, transparent, var(--st-surface, #fff) 35%)",
          }}
        >
          <ReorderButtons isFirst={isFirst} isLast={isLast} onUp={onMoveUp} onDown={onMoveDown} />
          {otherModules.length > 0 && (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                aria-label="Déplacer vers un autre module"
                onClick={(e) => { e.stopPropagation(); setShowMoveMenu((v) => !v); }}
                disabled={moveLesson.isPending}
                className="flex items-center justify-center"
                style={{ width: 20, height: 20, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "rgba(16,24,32,0.4)", flexShrink: 0 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--st-ink)"; (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(16,24,32,0.4)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <ArrowRightLeft size={11} />
              </button>
              {showMoveMenu && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={(e) => { e.stopPropagation(); setShowMoveMenu(false); }} />
                  <div
                    style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50, minWidth: 160, background: "var(--st-white)", border: "1px solid rgba(16,24,32,0.12)", borderRadius: 8, boxShadow: "0 4px 16px rgba(16,24,32,0.12)", padding: "4px 0" }}
                  >
                    <div style={{ fontSize: ".6875rem", fontWeight: 600, color: "var(--st-ink-50)", padding: "4px 12px 2px", textTransform: "uppercase", letterSpacing: ".04em" }}>
                      Déplacer vers
                    </div>
                    {otherModules.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={(e) => handleMoveToModule(e, m.id)}
                        style={{ width: "100%", textAlign: "left", padding: "6px 12px", fontSize: ".8125rem", color: "var(--st-ink)", background: "transparent", border: "none", cursor: "pointer" }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.04)"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      >
                        {m.title.length > 28 ? m.title.slice(0, 28) + "…" : m.title}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <button
            type="button"
            aria-label="Dupliquer la leçon"
            onClick={handleDuplicate}
            disabled={duplicateLesson.isPending}
            className="flex items-center justify-center"
            style={{ width: 20, height: 20, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "rgba(16,24,32,0.4)", flexShrink: 0 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--st-ink)"; (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(16,24,32,0.4)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Copy size={11} />
          </button>
          <button
            type="button"
            aria-label="Supprimer la leçon"
            onClick={handleDelete}
            disabled={deleteLesson.isPending}
            className="flex items-center justify-center"
            style={{ width: 20, height: 20, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "rgba(16,24,32,0.4)", flexShrink: 0 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#dc2626"; (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(16,24,32,0.4)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </>
  );
}
