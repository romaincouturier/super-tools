import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save } from "lucide-react";
import { useUpdateCourse } from "@/hooks/useLms";
import type { CourseHomeConfig } from "@/hooks/useLmsQueries";
import { useToast } from "@/hooks/use-toast";

type Props = {
  course: {
    id: string;
    welcome_video_url?: string | null;
    home_config?: CourseHomeConfig | null;
  };
};

export default function HomePageEditor({ course }: Props) {
  const updateCourse = useUpdateCourse();
  const { toast } = useToast();

  const [videoUrl, setVideoUrl] = useState(course.welcome_video_url || "");
  const [home, setHome] = useState<CourseHomeConfig>({
    ...(course.home_config ?? {}),
    welcome_title_1: course.home_config?.welcome_title_1 ?? "Bienvenue dans",
    welcome_title_2: course.home_config?.welcome_title_2 ?? "votre formation",
    tips: course.home_config?.tips ?? [],
  });

  const tips = home.tips ?? [];

  const handleSave = async () => {
    await updateCourse.mutateAsync({
      id: course.id,
      welcome_video_url: videoUrl,
      home_config: home,
    });
    toast({ title: "Page d'accueil sauvegardée" });
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div>
          <Label>Titre — 1ʳᵉ partie</Label>
          <Input
            value={home.welcome_title_1 ?? ""}
            onChange={(e) => setHome({ ...home, welcome_title_1: e.target.value })}
            placeholder="Bienvenue dans"
          />
        </div>
        <div>
          <Label>Titre — 2ᵉ partie (en jaune)</Label>
          <Input
            value={home.welcome_title_2 ?? ""}
            onChange={(e) => setHome({ ...home, welcome_title_2: e.target.value })}
            placeholder="votre formation"
          />
        </div>

        <div>
          <Label>Lien de la vidéo d'accueil</Label>
          <Input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>

        <div>
          <Label>Conseils</Label>
          <div className="space-y-2">
            {tips.map((tip, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={tip}
                  onChange={(e) => {
                    const next = [...tips];
                    next[i] = e.target.value;
                    setHome({ ...home, tips: next });
                  }}
                  placeholder="Conseil…"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setHome({ ...home, tips: tips.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setHome({ ...home, tips: [...tips, ""] })}
            >
              <Plus className="w-4 h-4 mr-2" /> Ajouter un conseil
            </Button>
          </div>
        </div>

        <Button onClick={handleSave} disabled={updateCourse.isPending}>
          <Save className="w-4 h-4 mr-2" /> Sauvegarder la page d'accueil
        </Button>
      </CardContent>
    </Card>
  );
}
