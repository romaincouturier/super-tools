import { useState, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronUp, ChevronDown, Trash2, Plus, Image, Video, Mic,
  GripVertical, Loader2, Upload, BookOpen, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import RichTextEditor from "@/components/content/RichTextEditor";
import { resolveContentType, getFileType, formatFileSize } from "@/lib/file-utils";
import {
  useUpdateSection, useDeleteSection, useAddSectionMedia,
  useDeleteSectionMedia, useUnassignSectionMedia, uploadSupportFile,
} from "@/hooks/useTrainingSupport";
import type { SupportSection, SupportMedia, SupportImport } from "@/hooks/useTrainingSupport";

interface SupportSectionCardProps {
  section: SupportSection;
  sectionMedia: SupportMedia[];
  availableImports: SupportImport[];
  supportId: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAssignImport: (importId: string) => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
}

const SupportSectionCard = ({
  section, sectionMedia, availableImports, supportId,
  isFirst, isLast, onMoveUp, onMoveDown, onAssignImport,
  onInsertAbove, onInsertBelow,
}: SupportSectionCardProps) => {
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState(section.content);
  const [uploading, setUploading] = useState(false);
  const [showImports, setShowImports] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const addMedia = useAddSectionMedia();
  const deleteMedia = useDeleteSectionMedia();
  const unassignMedia = useUnassignSectionMedia();

  const handleTitleBlur = () => {
    if (title !== section.title) {
      updateSection.mutate({ id: section.id, title });
    }
  };

  const handleContentChange = (html: string) => {
    setContent(html);
    // Debounce save
    clearTimeout((window as any).__supportSectionTimer);
    (window as any).__supportSectionTimer = setTimeout(() => {
      updateSection.mutate({ id: section.id, content: html });
    }, 1000);
  };

  const handleDelete = () => {
    if (section.is_resources) {
      toast.error("La section Ressources ne peut pas être supprimée");
      return;
    }
    if (!confirm(`Supprimer la section "${section.title}" ?`)) return;
    deleteSection.mutate(section.id);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const mimeType = resolveContentType(file);
        const fileType = getFileType(file);
        if (!fileType || fileType === "video") {
          // video and image handled
        }

        const fileUrl = await uploadSupportFile(file, supportId);
        const media = await addMedia.mutateAsync({
          sectionId: section.id,
          supportId,
          fileUrl,
          fileName: file.name,
          fileType: fileType || "image",
          mimeType,
          fileSize: file.size,
        });

        // If audio, trigger transcription
        if (fileType === "audio") {
          transcribeAudio(media.id, fileUrl);
        }
      }
      toast.success("Fichier(s) ajouté(s)");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const transcribeAudio = async (mediaId: string, audioUrl: string) => {
    try {
      const { data } = await (await import("@/integrations/supabase/client")).supabase
        .functions.invoke("transcribe-audio-long", {
          body: { audio_url: audioUrl },
        });

      if (data?.transcript) {
        // Update media with transcript
        const { supabase } = await import("@/integrations/supabase/client");
        await (supabase as any).from("training_support_media").update({
          transcript: data.transcript,
        }).eq("id", mediaId);

        // Generate summary and add to section content
        try {
          const summaryRes = await supabase.functions.invoke("ai-content-assist", {
            body: {
              action: "summarize",
              text: data.transcript,
              context: "Résumé de transcription audio pour un support de formation",
            },
          });
          if (summaryRes.data?.result) {
            await (supabase as any).from("training_support_media").update({
              transcript_summary: summaryRes.data.result,
            }).eq("id", mediaId);

            // Append summary to section content
            const summaryHtml = `<blockquote><p><strong>Synthèse audio :</strong></p><p>${summaryRes.data.result}</p></blockquote>`;
            const newContent = content + summaryHtml;
            setContent(newContent);
            updateSection.mutate({ id: section.id, content: newContent });
          }
        } catch {
          // Summary generation failed, still have transcript
        }

        toast.success("Audio transcrit et synthèse ajoutée");
      }
    } catch {
      toast.error("Erreur de transcription audio");
    }
  };

  const handleDeleteMedia = async (mediaId: string, fileType: string) => {
    if (fileType === "image") {
      const media = sectionMedia.find((m) => m.id === mediaId);
      if (media) {
        unassignMedia.mutate({
          id: media.id,
          support_id: media.support_id,
          file_url: media.file_url,
          file_name: media.file_name,
          file_type: media.file_type,
          mime_type: media.mime_type,
          file_size: media.file_size,
        });
        toast.success("Image remise dans les images à affecter");
        return;
      }
    }
    deleteMedia.mutate(mediaId);
  };

  const images = sectionMedia.filter((m) => m.file_type === "image");
  const videos = sectionMedia.filter((m) => m.file_type === "video");
  const audios = sectionMedia.filter((m) => m.file_type === "audio");

  return (
    <Card className={`p-4 space-y-3 ${section.is_resources ? "border-primary/30 bg-primary/5" : ""}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={isLast}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          className="font-medium text-sm h-8"
          placeholder="Titre de la section"
        />

        {section.is_resources && (
          <Badge variant="secondary" className="text-[10px] flex-shrink-0 gap-1">
            <BookOpen className="h-3 w-3" />
            Ressources
          </Badge>
        )}

        <div className="flex items-center gap-1 flex-shrink-0">
          {!section.is_resources && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onInsertAbove} title="Ajouter une section au-dessus">
              <Plus className="h-3.5 w-3.5" />
              <ChevronUp className="h-3 w-3 -ml-1.5" />
            </Button>
          )}
          {!section.is_resources && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onInsertBelow} title="Ajouter une section en-dessous">
              <Plus className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3 -ml-1.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>

          {availableImports.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 relative"
              onClick={() => setShowImports(!showImports)}
            >
              <Image className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                {availableImports.length}
              </span>
            </Button>
          )}

          {!section.is_resources && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
      </div>

      {/* Available imports picker */}
      {showImports && availableImports.length > 0 && (
        <div className="border rounded-lg p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">Cliquez sur une image importée pour l'affecter à cette section :</p>
          <div className="flex flex-wrap gap-2">
            {availableImports.map((imp) => (
              <button
                key={imp.id}
                className="relative w-16 h-16 rounded border overflow-hidden hover:ring-2 ring-primary transition-all"
                onClick={() => {
                  onAssignImport(imp.id);
                  setShowImports(false);
                }}
              >
                {imp.file_type === "image" ? (
                  <img src={imp.file_url} alt={imp.file_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <Video className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Media gallery */}
      {sectionMedia.length > 0 && (
        <div className="space-y-2">
          {/* Images grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((m) => (
                <div key={m.id} className="relative group aspect-video rounded overflow-hidden border">
                  <img src={m.file_url} alt={m.file_name} className="w-full h-full object-cover" loading="lazy" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-70 hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDeleteMedia(m.id, "image");
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Videos */}
          {videos.map((m) => (
            <div key={m.id} className="relative group">
              <video controls className="w-full rounded border" preload="metadata">
                <source src={m.file_url} type={m.mime_type || "video/mp4"} />
              </video>
              <button
                onClick={() => handleDeleteMedia(m.id, "video")}
                className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Audio + transcripts */}
          {audios.map((m) => (
            <div key={m.id} className="space-y-1 relative group">
              <div className="flex items-center gap-2">
                <audio controls className="flex-1 h-8" preload="metadata">
                  <source src={m.file_url} type={m.mime_type || "audio/mpeg"} />
                </audio>
                <button
                  onClick={() => handleDeleteMedia(m.id, "audio")}
                  className="bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              {m.transcript && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">Voir la transcription</summary>
                  <p className="mt-1 whitespace-pre-wrap border-l-2 pl-2">{m.transcript}</p>
                </details>
              )}
              {m.transcript_summary && (
                <div className="text-xs bg-primary/5 border-l-2 border-primary pl-2 py-1 rounded-r">
                  <strong>Synthèse :</strong> {m.transcript_summary}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rich text content */}
      <RichTextEditor
        content={content}
        onChange={handleContentChange}
        placeholder="Contenu de la section..."
        minHeight="120px"
      />
    </Card>
  );
};

export default SupportSectionCard;
