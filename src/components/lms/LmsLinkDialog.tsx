import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Trash2 } from "lucide-react";
import { useAllLmsLessons, type LmsLessonOption } from "@/hooks/useAllLmsLessons";

interface Props {
  open: boolean;
  initialUrl?: string;
  onOpenChange: (open: boolean) => void;
  onApply: (url: string) => void;
  onRemove: () => void;
}

export default function LmsLinkDialog({
  open,
  initialUrl,
  onOpenChange,
  onApply,
  onRemove,
}: Props) {
  const [url, setUrl] = useState(initialUrl || "");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setUrl(initialUrl || "");
      setSearch("");
    }
  }, [open, initialUrl]);

  const { data: lessons = [], isLoading } = useAllLmsLessons();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lessons.slice(0, 50);
    return lessons
      .filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.module_title.toLowerCase().includes(q) ||
          l.course_title.toLowerCase().includes(q),
      )
      .slice(0, 80);
  }, [search, lessons]);

  const handleSelectLesson = (lesson: LmsLessonOption) => {
    const newUrl = `/lms/${lesson.course_id}/player?lesson=${lesson.id}`;
    setUrl(newUrl);
  };

  const handleApply = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      onRemove();
    } else {
      onApply(trimmed);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl">
        <DialogHeader>
          <DialogTitle>Insérer un lien</DialogTitle>
          <DialogDescription>
            Collez une URL ou sélectionnez une séquence du e-learning ci-dessous.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https:// ou /lms/..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApply();
                }
              }}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Ou choisir une séquence du e-learning
            </label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une séquence, un module, un cours…"
                className="pl-8"
              />
            </div>
            <div className="mt-2 max-h-72 overflow-y-auto rounded-md border divide-y">
              {isLoading && (
                <div className="p-3 text-sm text-muted-foreground">
                  Chargement…
                </div>
              )}
              {!isLoading && filtered.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">
                  Aucune séquence trouvée.
                </div>
              )}
              {filtered.map((l) => {
                const isSelected =
                  url === `/lms/${l.course_id}/player?lesson=${l.id}`;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleSelectLesson(l)}
                    className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors ${
                      isSelected ? "bg-accent" : ""
                    }`}
                  >
                    <div className="text-sm font-medium">{l.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.course_title} · {l.module_title}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {initialUrl && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive mr-auto"
              onClick={() => {
                onRemove();
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Retirer le lien
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleApply}>Appliquer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
