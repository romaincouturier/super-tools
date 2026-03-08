import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useUpdateLesson, LmsLesson } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { Save, Clock } from "lucide-react";
import RichTextEditor from "@/components/content/RichTextEditor";

interface Props {
  lesson: LmsLesson;
}

export default function LmsLessonEditor({ lesson }: Props) {
  const updateLesson = useUpdateLesson();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: lesson.title,
    content_html: lesson.content_html || "",
    video_url: lesson.video_url || "",
    estimated_minutes: lesson.estimated_minutes || 5,
    is_mandatory: lesson.is_mandatory,
  });

  const handleSave = async () => {
    await updateLesson.mutateAsync({ id: lesson.id, ...form });
    toast({ title: "Leçon sauvegardée" });
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
          <div>
            <Label>URL de la vidéo</Label>
            <Input
              value={form.video_url}
              onChange={(e) => setForm({ ...form, video_url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=... ou URL Vimeo/MP4"
            />
          </div>
          {form.video_url && (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              {form.video_url.includes("youtube") || form.video_url.includes("youtu.be") ? (
                <iframe
                  src={form.video_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : form.video_url.includes("vimeo") ? (
                <iframe
                  src={form.video_url.replace("vimeo.com/", "player.vimeo.com/video/")}
                  className="w-full h-full"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              ) : (
                <video src={form.video_url} controls className="w-full h-full" />
              )}
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
