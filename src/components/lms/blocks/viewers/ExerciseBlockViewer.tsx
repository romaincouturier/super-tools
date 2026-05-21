import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExerciseBlockContent } from "@/types/lms-blocks";
import ActionBlockShell from "./ActionBlockShell";

interface Props {
  content: ExerciseBlockContent;
}

export default function ExerciseBlockViewer({ content }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (!content.prompt_html && !content.answer_html && !content.checklist_items?.length && !content.video_url && !content.image_url) return null;

  const checklistItems = (content.checklist_items || []).filter((i) => i.label.trim());

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const videoUrl = content.video_url;
  const isYouTube = videoUrl && (videoUrl.includes("youtube") || videoUrl.includes("youtu.be"));
  const isVimeo = videoUrl && videoUrl.includes("vimeo");

  return (
    <ActionBlockShell icon={Pencil} label={content.title || "Exercice"}>
      {content.image_url && (
        <div className="rounded-lg overflow-hidden bg-muted mb-3">
          <img
            src={content.image_url}
            alt="Image de consigne"
            className="w-full h-auto max-h-[480px] object-contain"
          />
        </div>
      )}
      {videoUrl && (
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted mb-3">
          {isYouTube ? (
            <iframe
              src={videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : isVimeo ? (
            <iframe
              src={videoUrl.replace("vimeo.com/", "player.vimeo.com/video/")}
              className="w-full h-full"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : (
            <video src={videoUrl} controls className="w-full h-full" />
          )}
        </div>
      )}
      {content.prompt_html && (
        <div
          className="prose max-w-none break-words"
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
              className="prose max-w-none mt-2 break-words"
              dangerouslySetInnerHTML={{ __html: content.answer_html }}
            />
          )}
        </div>
      )}
    </ActionBlockShell>
  );
}
