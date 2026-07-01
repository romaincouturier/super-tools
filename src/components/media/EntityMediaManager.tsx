import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  useEntityMedia,
  useAddMedia,
  useDeleteMedia,
  useToggleMediaDeliverable,
  useRenameMedia,
  useUpdateMediaTranscript,
  useUploadEventMedia,
  useUploadMissionMedia,
  useReorderMedia,
  uploadMediaFile,
  deleteMediaFile,
  MediaSourceType,
  MediaItem,
} from "@/hooks/useMedia";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { uploadEntityDocument } from "@/hooks/useEntityDocuments";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { downloadFile as downloadFileUtil, promptRenameFile, getFileType, resolveContentType } from "@/lib/file-utils";
import { ImageIcon, Video, Plus, Loader2, Upload, Trash2, Play, Download, Package, DownloadCloud, Pencil, Mic, FileAudio, FileText, Maximize2, GripVertical, Copy, CheckSquare, Square, Check, X } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import MediaLightbox from "@/components/media/MediaLightbox";

function SortableThumb({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "opacity-50" : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

interface EntityMediaManagerProps {
  sourceType: MediaSourceType;
  sourceId: string;
  sourceLabel: string;
  /** Show as a Card with header, or bare (for embedding in tabs) */
  variant?: "card" | "bare";
  /** Enable paste (Ctrl+V) upload */
  enablePaste?: boolean;
  /** Also allow video_link entries (for events) */
  allowVideoLinks?: boolean;
  /** Enable drag-and-drop reordering of images and videos */
  allowReorder?: boolean;
  /** Also allow PDF document uploads (e.g. a LinkedIn carousel as proof) */
  allowDocuments?: boolean;
}

const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50 Mo — matches the storage bucket limit

const EntityMediaManager = ({
  sourceType,
  sourceId,
  sourceLabel,
  variant = "card",
  enablePaste = false,
  allowVideoLinks = false,
  allowReorder = false,
  allowDocuments = false,
}: EntityMediaManagerProps) => {
  const isPdf = (file: File) => resolveContentType(file) === "application/pdf";
  const { data: media = [], isLoading } = useEntityMedia(sourceType, sourceId);
  const addMedia = useAddMedia();
  const deleteMutation = useDeleteMedia();
  const toggleDeliverable = useToggleMediaDeliverable();
  const renameMedia = useRenameMedia();
  const updateTranscript = useUpdateMediaTranscript();
  const uploadEventMedia = useUploadEventMedia();
  const uploadMissionMedia = useUploadMissionMedia();
  const reorderMedia = useReorderMedia();
  const { copy } = useCopyToClipboard();

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [presentationFullscreen, setPresentationFullscreen] = useState(false);
  const [transcribingIds, setTranscribingIds] = useState<Set<string>>(new Set());
  const [localItems, setLocalItems] = useState<MediaItem[] | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { invoke: invokeTranscribe } = useEdgeFunction<{ transcript?: string }>(
    "transcribe-audio-long",
    { silentOnError: true },
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Filter out video_link for display/download purposes
  const downloadableMedia = media.filter((m) => m.file_type !== "video_link");
  const imageItems = media.filter((m) => m.file_type === "image");
  const videoItems = media.filter((m) => m.file_type === "video");
  const audioItems = media.filter((m) => m.file_type === "audio");

  const displayItems = localItems ?? downloadableMedia;
  const gridItems = allowReorder
    ? displayItems
    : [...downloadableMedia].sort((a, b) => (b.is_deliverable ? 1 : 0) - (a.is_deliverable ? 1 : 0));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayItems.findIndex((m) => m.id === String(active.id));
    const newIndex = displayItems.findIndex((m) => m.id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(displayItems, oldIndex, newIndex);
    setLocalItems(reordered);
    reorderMedia.mutate(
      { sourceType, sourceId, items: reordered.map((m, i) => ({ id: m.id, position: i })) },
      { onSettled: () => setLocalItems(null) },
    );
  };

  const openPresentationAt = (item: MediaItem) => {
    setPresentationFullscreen(true);
    setLightboxItem(item);
  };

  const openPresentation = () => {
    const first = gridItems.find((m) => m.file_type === "image" || m.file_type === "video");
    if (!first) return;
    openPresentationAt(first);
  };

  const handleLightboxClose = () => {
    setLightboxItem(null);
    setPresentationFullscreen(false);
  };

  const handleToggleDeliverable = (item: MediaItem) => {
    toggleDeliverable.mutate({
      id: item.id,
      sourceType: item.source_type,
      sourceId: item.source_id,
      is_deliverable: !item.is_deliverable,
    });
  };

  const queryClient = useQueryClient();

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((f) => {
      if (allowDocuments && isPdf(f)) {
        if (f.size > MAX_DOCUMENT_SIZE) {
          toast.error(`${f.name} dépasse la taille maximale de 50 Mo`);
          return false;
        }
        return true;
      }
      return getFileType(f) !== null;
    });

    if (validFiles.length === 0) {
      toast.error(
        allowDocuments
          ? "Seuls les images, vidéos, fichiers audio et PDF sont acceptés"
          : "Seuls les images, vidéos et fichiers audio sont acceptés"
      );
      return;
    }

    // Warn early if batch is large — gives user a chance to cancel
    const BATCH_SIZE = 5;
    const LARGE_UPLOAD_THRESHOLD = 30;
    if (validFiles.length > LARGE_UPLOAD_THRESHOLD) {
      toast.info(
        `${validFiles.length} fichiers sélectionnés — upload par lots de ${BATCH_SIZE} pour éviter les coupures réseau.`
      );
    }

    setUploading(true);
    setUploadProgress({ done: 0, total: validFiles.length });
    let successCount = 0;
    let routedAudioToDocs = 0;
    let doneCount = 0;

    try {
      const uploadedAudioItems: MediaItem[] = [];

      // Process in small batches to avoid saturating memory on mobile Safari.
      // Each batch runs sequentially; a short pause between batches lets the
      // browser garbage-collect FormData objects from the previous batch.
      for (let batchStart = 0; batchStart < validFiles.length; batchStart += BATCH_SIZE) {
        const batch = validFiles.slice(batchStart, batchStart + BATCH_SIZE);

        for (const file of batch) {
          try {
            const fileType = allowDocuments && isPdf(file) ? "document" : getFileType(file)!;

            // Audio on missions → route through the documents pipeline so the
            // file shows in the "Documents" tab AND a transcript page is auto-
            // created with the language detected by AssemblyAI.
            if (fileType === "audio" && sourceType === "mission") {
              await uploadEntityDocument(file, "mission", sourceId);
              queryClient.invalidateQueries({ queryKey: ["mission-documents", sourceId] });
              successCount++;
              routedAudioToDocs++;
            } else {
              const result = sourceType === "event"
                ? await uploadEventMedia.mutateAsync({ file, eventId: sourceId })
                : sourceType === "mission"
                ? await uploadMissionMedia.mutateAsync({ file, missionId: sourceId })
                : await addMedia.mutateAsync({
                    file_url: await uploadMediaFile(file, sourceType, sourceId),
                    file_name: file.name,
                    file_type: fileType,
                    mime_type: resolveContentType(file),
                    file_size: file.size,
                    position: 0,
                    source_type: sourceType,
                    source_id: sourceId,
                  });

              successCount++;

              if (fileType === "audio" && result) {
                uploadedAudioItems.push({
                  ...result,
                  source_label: "",
                  source_emoji: null,
                  source_color: null,
                  source_tags: [],
                } as MediaItem);
              }
            }
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
            console.error("Upload error for file:", file.name, "type:", file.type, "size:", file.size, "resolved:", resolveContentType(file), "error:", errMsg);
            toast.error(`Erreur : ${file.name}`);
          }

          doneCount++;
          setUploadProgress({ done: doneCount, total: validFiles.length });
        }

        // Pause between batches — lets Safari GC collect FormData objects
        if (batchStart + BATCH_SIZE < validFiles.length) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      if (successCount > 0) {
        toast.success(
          successCount === 1
            ? "Fichier ajouté"
            : `${successCount} fichiers ajoutés`
        );
      }
      if (routedAudioToDocs > 0) {
        toast.info(
          routedAudioToDocs === 1
            ? "Audio ajouté à l'onglet Documents — transcription en cours."
            : `${routedAudioToDocs} audios ajoutés à l'onglet Documents — transcription en cours.`,
        );
      }

      // Auto-transcribe uploaded audio files (non-mission entities only)
      for (const audioItem of uploadedAudioItems) {
        handleTranscribe(audioItem);
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [sourceType, sourceId, addMedia, uploadEventMedia, uploadMissionMedia, queryClient, allowDocuments]);

  const handleTranscribe = async (item: MediaItem) => {
    setTranscribingIds((prev) => new Set(prev).add(item.id));
    try {
      toast.info("Transcription en cours...");
      const data = await invokeTranscribe({ audio_url: item.file_url });
      if (!data) {
        toast.error("Erreur lors de la transcription");
        return;
      }
      const transcript = data.transcript;
      if (!transcript || transcript === "[inaudible]") {
        toast.error("Transcription impossible — audio inaudible ou vide");
        return;
      }

      await updateTranscript.mutateAsync({
        id: item.id,
        transcript,
        sourceType: item.source_type,
        sourceId: item.source_id,
      });

      // For events: auto-fill summary_notes if empty, so the
      // "compte-rendu manquant" alert disappears once transcription is done.
      if (item.source_type === "event") {
        const { data: ev } = await supabase
          .from("events")
          .select("summary_notes")
          .eq("id", item.source_id)
          .maybeSingle();
        if (ev && !ev.summary_notes) {
          await supabase
            .from("events")
            .update({ summary_notes: transcript })
            .eq("id", item.source_id);
          queryClient.invalidateQueries({ queryKey: ["events"] });
        }
      }

      toast.success("Transcription terminée");
    } finally {
      setTranscribingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleDelete = async (e: React.MouseEvent, item: MediaItem) => {
    e.stopPropagation();
    if (!confirm(`Supprimer ${item.file_name} ?`)) return;

    try {
      if (item.file_type !== "video_link") {
        await deleteMediaFile(item.file_url);
      }
      await deleteMutation.mutateAsync({
        id: item.id,
        sourceType: item.source_type,
        sourceId: item.source_id,
      });
      toast.success("Fichier supprimé");
      if (lightboxItem?.id === item.id) setLightboxItem(null);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleDownloadFile = async (e: React.MouseEvent, url: string, fileName: string) => {
    e.stopPropagation();
    try {
      await downloadFileUtil(url, fileName);
    } catch {
      toast.error("Erreur lors du téléchargement");
    }
  };

  const handleDownloadAll = async () => {
    if (downloadableMedia.length === 0) return;

    setDownloading(true);
    let successCount = 0;
    try {
      for (const item of downloadableMedia) {
        try {
          await downloadFileUtil(item.file_url, item.file_name);
          successCount++;
        } catch {
          console.error(`Download error: ${item.file_name}`);
        }
      }
      if (successCount > 0) {
        toast.success(
          successCount === 1
            ? "1 fichier téléchargé"
            : `${successCount} fichiers téléchargés`
        );
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSelected = async () => {
    const items = downloadableMedia.filter((m) => selectedIds.has(m.id));
    if (items.length === 0) return;
    setDownloading(true);
    let successCount = 0;
    try {
      for (const item of items) {
        try {
          await downloadFileUtil(item.file_url, item.file_name);
          successCount++;
        } catch {
          console.error(`Download error: ${item.file_name}`);
        }
      }
      if (successCount > 0) {
        toast.success(
          successCount === 1 ? "1 fichier téléchargé" : `${successCount} fichiers téléchargés`,
        );
      }
    } finally {
      setDownloading(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const selectAll = () => {
    setSelectedIds(new Set(downloadableMedia.map((m) => m.id)));
  };

  const handleRename = (e: React.MouseEvent, item: MediaItem) => {
    e.stopPropagation();
    const finalName = promptRenameFile(item.file_name);
    if (!finalName) return;
    renameMedia.mutate(
      { id: item.id, file_name: finalName },
      {
        onSuccess: () => toast.success(`Renommé en "${finalName}"`),
        onError: () => toast.error("Erreur lors du renommage"),
      }
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  // Paste support
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!enablePaste) return;

      // Skip when an editable element has focus, so pastes in textareas/inputs
      // (e.g. event notes) are never intercepted by the media uploader.
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          active.isContentEditable
        ) {
          return;
        }
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/") || item.type.startsWith("video/") || item.type.startsWith("audio/")) {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        uploadFiles(pastedFiles);
      }
    },
    [enablePaste, uploadFiles]
  );


  useEffect(() => {
    if (!enablePaste) return;
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste, enablePaste]);

  // Items suitable for lightbox (exclude video_link and documents — PDFs open in a new tab)
  const lightboxItems = downloadableMedia.filter((m) => m.file_type !== "document");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Spinner size="md" className="text-muted-foreground" />
      </div>
    );
  }

  const content = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={`image/*,video/*,audio/*,.m4a,.mp3,.wav,.aac,.ogg,.caf,.svg${allowDocuments ? ",application/pdf,.pdf" : ""}`}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {media.length === 0 ? (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Spinner size="lg" className="text-primary" />
              <p className="text-sm text-muted-foreground">
                {uploadProgress && uploadProgress.total > 1
                  ? `Upload en cours... ${uploadProgress.done}/${uploadProgress.total}`
                  : "Upload en cours..."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {enablePaste
                  ? "Glissez, collez (Ctrl+V) ou cliquez pour ajouter des médias"
                  : allowDocuments
                  ? "Glissez vos photos, vidéos et PDF ici, ou cliquez pour sélectionner"
                  : "Glissez vos photos et vidéos ici, ou cliquez pour sélectionner"}
              </p>
              <p className="text-xs text-muted-foreground">
                Plusieurs fichiers à la fois
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Selection toolbar */}
          {downloadableMedia.length > 0 && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {!selectionMode ? (
                <Button size="sm" variant="outline" onClick={() => setSelectionMode(true)}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Sélectionner
                </Button>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      {selectedIds.size} sélectionné{selectedIds.size !== 1 ? "s" : ""}
                    </span>
                    <Button size="sm" variant="ghost" onClick={selectAll}>
                      Tout sélectionner
                    </Button>
                    <Button size="sm" variant="ghost" onClick={exitSelectionMode}>
                      <X className="h-4 w-4 mr-1" />
                      Annuler
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleDownloadSelected}
                    disabled={downloading || selectedIds.size === 0}
                  >
                    {downloading ? (
                      <Spinner className="mr-2" />
                    ) : (
                      <DownloadCloud className="h-4 w-4 mr-2" />
                    )}
                    Télécharger la sélection
                  </Button>
                </>
              )}
            </div>
          )}
          {(() => {
            const grid = (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {/* Add more button */}
                <div
                  className={cn(
                    "aspect-square rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors",
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                >
                  {uploading ? (
                    <Spinner size="md" className="text-muted-foreground" />
                  ) : (
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>

                {gridItems.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const canSelect = item.file_type !== "video_link";
                  const card = (
                    <div
                      key={item.id}
                      className={cn(
                        "group relative rounded-lg overflow-hidden bg-muted cursor-pointer",
                        item.file_type === "audio" ? "col-span-2 border" : "aspect-square border-2",
                        selectionMode && isSelected
                          ? "border-primary ring-2 ring-primary"
                          : item.is_deliverable && item.file_type !== "audio"
                          ? "border-amber-400"
                          : "border-border"
                      )}
                      onClick={() => {
                        if (selectionMode && canSelect) {
                          toggleSelected(item.id);
                          return;
                        }
                        if (item.file_type === "audio") return;
                        if (item.file_type === "document") {
                          window.open(item.file_url, "_blank", "noopener,noreferrer");
                          return;
                        }
                        setLightboxItem(item);
                      }}
                    >
                      {item.file_type === "image" ? (
                        <img
                          src={item.file_url}
                          alt={item.file_name}
                          className="w-full h-full object-cover will-change-transform"
                          loading="lazy"
                        />
                      ) : item.file_type === "audio" ? (
                        <div className="p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <FileAudio className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium truncate">{item.file_name}</span>
                            <div className="ml-auto flex items-center gap-1">
                              {!item.transcript && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={(e) => { e.stopPropagation(); handleTranscribe(item); }}
                                      disabled={transcribingIds.has(item.id)}
                                    >
                                      {transcribingIds.has(item.id) ? (
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      ) : (
                                        <FileText className="h-3 w-3 mr-1" />
                                      )}
                                      Transcrire
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Transcrire l'audio avec l'IA</TooltipContent>
                                </Tooltip>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleDownloadFile(e, item.file_url, item.file_name)}>
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => handleDelete(e, item)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <audio src={item.file_url} controls className="w-full h-8" preload="metadata" />
                          {item.transcript && (
                            <div className="mt-2 rounded border bg-background">
                              <div className="flex items-center justify-between gap-2 border-b px-2 py-1">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Transcript</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={(e) => { e.stopPropagation(); copy(item.transcript!, { title: "Transcript copié" }); }}
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copier
                                </Button>
                              </div>
                              <div className="p-2 text-sm text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                                {item.transcript}
                              </div>
                            </div>
                          )}
                          {transcribingIds.has(item.id) && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Transcription en cours...
                            </div>
                          )}
                        </div>
                      ) : item.file_type === "document" ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-muted p-2 text-center">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                          <span className="text-[11px] leading-tight text-muted-foreground line-clamp-2 break-all">
                            {item.file_name}
                          </span>
                        </div>
                      ) : (
                        <div className="w-full h-full relative bg-muted">
                          <video
                            src={`${item.file_url}#t=0.1`}
                            className="w-full h-full object-cover"
                            preload="metadata"
                            muted
                            playsInline
                            onError={(e) => {
                              const el = e.currentTarget;
                              el.style.display = "none";
                            }}
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
                            <Play className="h-8 w-8 text-white drop-shadow" />
                            {item.file_name.toLowerCase().endsWith(".mov") && (
                              <span className="text-white/70 text-[10px] mt-1">MOV</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Selection checkbox overlay */}
                      {selectionMode && canSelect && (
                        <div className="absolute inset-0 bg-black/30 z-20 flex items-start justify-end p-2 pointer-events-none">
                          <div
                            className={cn(
                              "w-6 h-6 rounded-md flex items-center justify-center border-2",
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "bg-white/90 border-white"
                            )}
                          >
                            {isSelected && <Check className="h-4 w-4" />}
                          </div>
                        </div>
                      )}

                      {/* Hover overlay (not for audio — handled inline) */}
                      {item.file_type !== "audio" && !selectionMode && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity will-change-[opacity] flex flex-col items-center justify-between p-2 z-10">
                        <div className="flex items-center justify-center gap-1 flex-1">
                          {(item.file_type === "image" || item.file_type === "video") && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPresentationAt(item);
                                  }}
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Démarrer la présentation ici</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={item.is_deliverable ? "default" : "secondary"}
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleDeliverable(item);
                                }}
                              >
                                <Package className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {item.is_deliverable ? "Retirer des livrables" : "Marquer comme livrable"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => handleRename(e, item)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Renommer</TooltipContent>
                          </Tooltip>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => handleDownloadFile(e, item.file_url, item.file_name)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => handleDelete(e, item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="w-full text-center text-white text-[11px] leading-tight truncate px-1 drop-shadow">
                          {item.file_name}
                        </p>
                      </div>
                      )}

                      {/* Drag handle indicator (reorder mode) */}
                      {allowReorder && item.file_type !== "audio" && (
                        <div className="absolute top-1 left-1 opacity-60">
                          <GripVertical className="h-3.5 w-3.5 text-white drop-shadow" />
                        </div>
                      )}

                      {/* Deliverable badge */}
                      {item.is_deliverable && item.file_type !== "audio" && (
                        <div className={cn("absolute top-1", allowReorder ? "left-5" : "left-1")}>
                          <Package className="h-3.5 w-3.5 text-white drop-shadow" />
                        </div>
                      )}

                      {item.file_type === "video" && (
                        <div className="absolute top-1 right-1">
                          <Video className="h-3.5 w-3.5 text-white drop-shadow" />
                        </div>
                      )}
                    </div>
                  );
                  return allowReorder ? (
                    <SortableThumb key={item.id} id={item.id}>{card}</SortableThumb>
                  ) : card;
                })}
              </div>
            );
            if (!allowReorder) return grid;
            return (
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext items={gridItems.map((m) => m.id)} strategy={rectSortingStrategy}>
                  {grid}
                </SortableContext>
              </DndContext>
            );
          })()}
        </div>
      )}

      {/* Lightbox */}
      {lightboxItem && (
        <MediaLightbox
          item={lightboxItem}
          items={lightboxItems}
          onClose={handleLightboxClose}
          onNavigate={setLightboxItem}
          onToggleDeliverable={handleToggleDeliverable}
          autoFullscreen={presentationFullscreen}
        />
      )}
    </>
  );

  if (variant === "bare") {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Médias
            {media.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({imageItems.length} image{imageItems.length !== 1 ? "s" : ""}
                {videoItems.length > 0 && `, ${videoItems.length} vidéo${videoItems.length !== 1 ? "s" : ""}`}
                {audioItems.length > 0 && `, ${audioItems.length} audio`})
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {(imageItems.length + videoItems.length) > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={openPresentation}
              >
                <Play className="h-4 w-4 mr-1" />
                Présentation
              </Button>
            )}
            {downloadableMedia.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadAll}
                disabled={downloading}
              >
                {downloading ? (
                  <Spinner className="mr-2" />
                ) : (
                  <DownloadCloud className="h-4 w-4 mr-2" />
                )}
                Tout télécharger
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};

export default EntityMediaManager;
