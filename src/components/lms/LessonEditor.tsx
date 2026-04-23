import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useUpdateLesson, LmsLesson, uploadLmsVideo, uploadLmsImage, uploadLmsFile } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { Save, Clock, Upload, Download, Paperclip, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import RichTextEditor from "@/components/content/RichTextEditor";
import { formatFileSize } from "@/lib/file-utils";

interface Props {
  lesson: LmsLesson;
}

export default function LmsLessonEditor({ lesson }: Props) {
  const updateLesson = useUpdateLesson();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: lesson.title,
    content_html: lesson.content_html || "",
    video_url: lesson.video_url || "",
    image_url: lesson.image_url || "",
    file_url: lesson.file_url || "",
    file_name: lesson.file_name || "",
    file_size: lesson.file_size || 0,
    estimated_minutes: lesson.estimated_minutes || 5,
    is_mandatory: lesson.is_mandatory,
  });

  const handleSave = async () => {
    await updateLesson.mutateAsync({ id: lesson.id, ...form });
    toast({ title: "Leçon sauvegardée" });
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadLmsVideo(file, lesson.id);
      setForm((f) => ({ ...f, video_url: url }));
      toast({ title: `Vidéo uploadée (${formatFileSize(file.size)})` });
    } catch (err: unknown) {
      toast({ title: "Erreur d'upload", description: (err instanceof Error ? err.message : "Erreur inconnue"), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const renderVideoPlayer = (url: string) => {
    if (url.includes("youtube") || url.includes("youtu.be")) {
      return (
        <iframe
          src={url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
    if (url.includes("vimeo")) {
      return (
        <iframe
          src={url.replace("vimeo.com/", "player.vimeo.com/video/")}
          className="w-full h-full"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      );
    }
    return <video src={url} controls className="w-full h-full" />;
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Titre de la leçon</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>

      {lesson.lesson_type === "text" && (
        <div>
          <Label>Contenu</Label>
          <RichTextEditor
            content={form.content_html}
            onChange={(html) => setForm({ ...form, content_html: html })}
          />
        </div>
      )}

      {lesson.lesson_type === "video" && (
        <div className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>URL de la vidéo</Label>
              <Input
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                placeholder="https://youtube.com/... ou uploadez un fichier"
              />
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoUpload}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Spinner className="mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? "Upload..." : "Uploader"}
              </Button>
            </div>
          </div>
          {form.video_url && (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              {renderVideoPlayer(form.video_url)}
            </div>
          )}
        </div>
      )}

      {lesson.lesson_type === "assignment" && (
        <div>
          <Label>Instructions du devoir</Label>
          <RichTextEditor
            content={form.content_html}
            onChange={(html) => setForm({ ...form, content_html: html })}
          />
        </div>
      )}

      {lesson.lesson_type === "image" && (
        <div className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>URL de l'image</Label>
              <Input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://... ou importez un fichier"
              />
            </div>
            <div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const url = await uploadLmsImage(file, lesson.id);
                    setForm((f) => ({ ...f, image_url: url }));
                    toast({ title: `Image importée (${formatFileSize(file.size)})` });
                  } catch (err: unknown) {
                    toast({ title: "Erreur d'upload", description: (err instanceof Error ? err.message : "Erreur inconnue"), variant: "destructive" });
                  } finally {
                    setUploading(false);
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Spinner className="mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? "Upload..." : "Importer"}
              </Button>
            </div>
          </div>
          {form.image_url && (
            <div className="rounded-lg overflow-hidden bg-muted border max-w-2xl">
              <img
                src={form.image_url}
                alt={form.title}
                className="w-full h-auto object-contain max-h-[500px]"
              />
            </div>
          )}
          <div>
            <Label>Légende / description (optionnel)</Label>
            <RichTextEditor
              content={form.content_html}
              onChange={(html) => setForm({ ...form, content_html: html })}
            />
          </div>
        </div>
      )}

      {lesson.lesson_type === "file" && (
        <div className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>Fichier à télécharger</Label>
              {form.file_url ? (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
                  <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{form.file_name || "Fichier"}</p>
                    {form.file_size > 0 && (
                      <p className="text-xs text-muted-foreground">{formatFileSize(form.file_size)}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setForm((f) => ({ ...f, file_url: "", file_name: "", file_size: 0 }))}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun fichier importé</p>
              )}
            </div>
            <div>
              <input
                ref={docFileInputRef}
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const result = await uploadLmsFile(file, lesson.id);
                    setForm((f) => ({ ...f, file_url: result.url, file_name: result.name, file_size: result.size }));
                    toast({ title: `Fichier importé (${formatFileSize(file.size)})` });
                  } catch (err: unknown) {
                    toast({ title: "Erreur d'upload", description: (err instanceof Error ? err.message : "Erreur inconnue"), variant: "destructive" });
                  } finally {
                    setUploading(false);
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => docFileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Spinner className="mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? "Upload..." : "Importer"}
              </Button>
            </div>
          </div>
          <div>
            <Label>Description / instructions (optionnel)</Label>
            <RichTextEditor
              content={form.content_html}
              onChange={(html) => setForm({ ...form, content_html: html })}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <Label>Durée estimée (min)</Label>
          <Input
            type="number"
            value={form.estimated_minutes}
            onChange={(e) => setForm({ ...form, estimated_minutes: +e.target.value })}
            className="w-20"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.is_mandatory}
            onCheckedChange={(v) => setForm({ ...form, is_mandatory: v })}
          />
          <Label>Obligatoire</Label>
        </div>
      </div>

      <Button onClick={handleSave} disabled={updateLesson.isPending}>
        <Save className="w-4 h-4 mr-2" /> Sauvegarder
      </Button>
    </div>
  );
}
