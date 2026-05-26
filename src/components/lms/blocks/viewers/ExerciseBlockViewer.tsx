import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight, FileText, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExerciseBlockContent } from "@/types/lms-blocks";
import ActionBlockShell from "./ActionBlockShell";
import { ImageWithLightbox } from "./ImageLightbox";
import LessonVideoPlayer from "./LessonVideoPlayer";

interface Props {
  content: ExerciseBlockContent;
}

export default function ExerciseBlockViewer({ content }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const imageUrls = content.image_urls?.length
    ? content.image_urls
    : content.image_url
      ? [content.image_url]
      : [];

  if (!content.prompt_html && !content.answer_html && !content.checklist_items?.length && !content.video_url && !imageUrls.length && !content.pdf_url) return null;

  const checklistItems = (content.checklist_items || []).filter((i) => i.label.trim());

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const videoUrl = content.video_url;

  return (
    <ActionBlockShell icon={Pencil} label={content.title || "Exercice"}>
      {imageUrls.length === 1 && (
        <div className="mb-3">
          <ImageWithLightbox
            src={imageUrls[0]}
            alt="Image de consigne"
            imgStyle={{ maxHeight: 480 }}
          />
        </div>
      )}
      {imageUrls.length > 1 && (
        <div className={`grid gap-2 mb-3 ${imageUrls.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
          {imageUrls.map((url, i) => (
            <ImageWithLightbox
              key={i}
              src={url}
              alt={`Image de consigne ${i + 1}`}
              imgStyle={{ maxHeight: 280 }}
            />
          ))}
        </div>
      )}
      {content.pdf_url && (
        <a
          href={content.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg border px-3 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors mb-3 no-underline"
        >
          <FileText size={16} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">Télécharger la consigne en PDF</span>
        </a>
      )}
      {videoUrl && (
        <div className="mb-3">
          <LessonVideoPlayer url={videoUrl} radius={8} />
        </div>
      )}
      {content.prompt_html && (
        <div
          className="prose prose-base sm:prose-lg max-w-none break-words"
          dangerouslySetInnerHTML={{ __html: content.prompt_html }}
        />
      )}

      {checklistItems.length > 0 && (
        <div className="mt-3 rounded-lg border bg-card px-4 py-3">
          {content.checklist_title && (
            <p className="font-semibold mb-2 break-words">{content.checklist_title}</p>
          )}
          <ul className="space-y-2">
            {checklistItems.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <Checkbox
                  id={`ex-check-${item.id}`}
                  checked={!!checked[item.id]}
                  onCheckedChange={() => toggle(item.id)}
                  className="mt-0.5 shrink-0"
                />
                <label
                  htmlFor={`ex-check-${item.id}`}
                  className={cn(
                    "cursor-pointer flex-1 min-w-0 break-words",
                    checked[item.id] && "line-through text-muted-foreground",
                  )}
                >
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.answer_html && (
        <div className="border-t pt-3 mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRevealed((v) => !v)}
            aria-expanded={revealed}
          >
            {revealed ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
            {revealed ? "Masquer le corrigé" : "Voir le corrigé"}
          </Button>
          {revealed && (
            <div
              className="prose prose-base sm:prose-lg max-w-none mt-2 break-words"
              dangerouslySetInnerHTML={{ __html: content.answer_html }}
            />
          )}
        </div>
      )}
    </ActionBlockShell>
  );
}
