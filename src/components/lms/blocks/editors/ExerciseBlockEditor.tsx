import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, Video } from "lucide-react";
import RichTextEditor from "@/components/content/RichTextEditor";
import { cryptoRandomId } from "@/types/lms-blocks";
import type { ExerciseBlockContent } from "@/types/lms-blocks";

interface Props {
  content: ExerciseBlockContent;
  onChange: (content: ExerciseBlockContent) => void;
  slim?: boolean;
}

function VideoPreview({ url }: { url: string }) {
  const isYouTube = url.includes("youtube") || url.includes("youtu.be");
  const isVimeo = url.includes("vimeo");
  return (
    <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
      {isYouTube ? (
        <iframe
          src={url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : isVimeo ? (
        <iframe
          src={url.replace("vimeo.com/", "player.vimeo.com/video/")}
          className="w-full h-full"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : (
        <video src={url} controls className="w-full h-full" />
      )}
    </div>
  );
}

export default function ExerciseBlockEditor({ content, onChange, slim }: Props) {
  const checklistItems = content.checklist_items || [];
  const hasChecklist = checklistItems.length > 0 || content.checklist_title;

  const setChecklistLabel = (id: string, label: string) =>
    onChange({
      ...content,
      checklist_items: checklistItems.map((it) => (it.id === id ? { ...it, label } : it)),
    });

  const addChecklistItem = () =>
    onChange({
      ...content,
      checklist_items: [...checklistItems, { id: cryptoRandomId(), label: "" }],
    });

  const removeChecklistItem = (id: string) => {
    const updated = checklistItems.filter((it) => it.id !== id);
    onChange({
      ...content,
      checklist_items: updated.length > 0 ? updated : null,
      checklist_title: updated.length > 0 ? content.checklist_title : null,
    });
  };

  const enableChecklist = () =>
    onChange({
      ...content,
      checklist_items: [{ id: cryptoRandomId(), label: "" }],
      checklist_title: null,
    });

  if (slim) {
    return (
      <div className="space-y-3">
        {content.video_url && <VideoPreview url={content.video_url} />}
        <RichTextEditor
          content={content.prompt_html || ""}
          onChange={(prompt_html) => onChange({ ...content, prompt_html })}
          placeholder="Énoncé de l'exercice…"
        />
        {hasChecklist && (
          <div className="space-y-1 pl-2">
            {checklistItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <span style={{ color: "var(--st-ink-50)" }}>☐</span>
                <Input
                  value={item.label}
                  onChange={(e) => setChecklistLabel(item.id, e.target.value)}
                  placeholder="Étape ou critère"
                  className="flex-1 text-sm h-7 border-none bg-transparent px-0 focus-visible:ring-0"
                />
              </div>
            ))}
            <button
              className="text-xs mt-1"
              style={{ color: "var(--st-ink-50)" }}
              onClick={addChecklistItem}
            >
              + Ajouter un critère
            </button>
          </div>
        )}
        {!hasChecklist && (
          <button
            className="text-xs"
            style={{ color: "var(--st-ink-50)" }}
            onClick={enableChecklist}
          >
            + Ajouter une liste de critères
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Video de consigne */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm">Vidéo de consigne (optionnel)</Label>
        </div>
        <Input
          value={content.video_url || ""}
          onChange={(e) => onChange({ ...content, video_url: e.target.value || null })}
          placeholder="URL YouTube, Vimeo ou lien direct…"
          type="url"
        />
        {content.video_url && <VideoPreview url={content.video_url} />}
      </div>

      <div>
        <Label>Énoncé de l'exercice</Label>
        <RichTextEditor
          content={content.prompt_html || ""}
          onChange={(prompt_html) => onChange({ ...content, prompt_html })}
          placeholder="Décrivez ce que l'apprenant doit faire…"
        />
      </div>

      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Liste à cocher dans la consigne</Label>
          {!hasChecklist && (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={enableChecklist}>
              <Plus className="h-3.5 w-3.5 mr-1" />Ajouter
            </Button>
          )}
        </div>
        {hasChecklist && (
          <div className="space-y-2">
            <Input
              value={content.checklist_title || ""}
              onChange={(e) => onChange({ ...content, checklist_title: e.target.value || null })}
              placeholder="Titre de la liste (optionnel)"
              className="text-sm"
            />
            {checklistItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-muted-foreground shrink-0">☐</span>
                <Input
                  value={item.label}
                  onChange={(e) => setChecklistLabel(item.id, e.target.value)}
                  placeholder="Étape ou critère"
                  className="flex-1 text-sm"
                />
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                  onClick={() => removeChecklistItem(item.id)} aria-label="Supprimer"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}>
              <Plus className="h-3.5 w-3.5 mr-1" />Ajouter un élément
            </Button>
          </div>
        )}
      </div>

      <div>
        <Label>Corrigé (optionnel)</Label>
        <RichTextEditor
          content={content.answer_html || ""}
          onChange={(answer_html) => onChange({ ...content, answer_html })}
          placeholder="Le corrigé est masqué par défaut, l'apprenant le révèle d'un clic."
        />
      </div>
    </div>
  );
}
