import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

interface LmsLessonOption {
  id: string;
  title: string;
  module_id: string;
  module_title: string;
  course_id: string;
  course_title: string;
  position: number;
  module_position: number;
}

function useAllLmsLessons() {
  return useQuery({
    queryKey: ["lms-all-lessons-for-link-picker"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<LmsLessonOption[]> => {
      const { data, error } = await supabase
        .from("lms_lessons")
        .select(
          "id, title, position, module_id, lms_modules!inner(id, title, position, course_id, lms_courses!inner(id, title, status))",
        )
        .order("position");
      if (error) throw error;
      const rows = (data || []) as any[];
      return rows
        .map((r) => ({
          id: r.id as string,
          title: (r.title as string) || "Sans titre",
          module_id: r.module_id as string,
          module_title: r.lms_modules?.title || "",
          module_position: r.lms_modules?.position ?? 0,
          course_id: r.lms_modules?.lms_courses?.id as string,
          course_title: r.lms_modules?.lms_courses?.title as string,
          position: r.position ?? 0,
        }))
        .filter((l) => !!l.course_id)
        .sort((a, b) =>
          a.course_title.localeCompare(b.course_title) ||
          a.module_position - b.module_position ||
          a.position - b.position,
        );
    },
  });
}

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
      <DialogContent className="max-w-2xl">
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
