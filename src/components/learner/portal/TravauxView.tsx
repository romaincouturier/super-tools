import { useState, useRef } from "react";
import {
  FileText, ChevronDown, Upload, FileImage, ArrowRight, Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { resolveContentType } from "@/lib/file-utils";
import { useLearnerWorkDeposits, useCreatePortfolioDeposit } from "@/hooks/useLearnerPortalData";
import { useDeleteDeposit } from "@/hooks/useLmsWorkDeposit";
import { PEDAGOGICAL_STATUS_LABELS } from "@/types/lms-work-deposit";
import { useConfirm } from "@/hooks/useConfirm";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Training } from "@/types/learner-portal";

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

export function TravauxView({ email, trainings }: { email: string; trainings: Training[] }) {
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
                      <img
                        src={d.file_url}
                        alt={d.file_name ?? "travail"}
                        className="w-full object-cover"
                        style={{
                          maxHeight: 420,
                          transform: d.file_rotation ? `rotate(${(((d.file_rotation % 360) + 360) % 360)}deg)` : undefined,
                        }}
                      />
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
