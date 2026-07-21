import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Trash2, Save, Upload, X } from "lucide-react";
import { useUpdateCourse, uploadLmsImage } from "@/hooks/useLms";
import type { CourseHomeConfig, CourseHeroMediaType } from "@/hooks/useLmsQueries";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { formatFileSize } from "@/lib/file-utils";

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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [videoUrl, setVideoUrl] = useState(course.welcome_video_url || "");
  const [home, setHome] = useState<CourseHomeConfig>({
    ...(course.home_config ?? {}),
    welcome_title_1: course.home_config?.welcome_title_1 ?? "Bienvenue dans",
    welcome_title_2: course.home_config?.welcome_title_2 ?? "votre formation",
    hero_media_type: course.home_config?.hero_media_type ?? "video",
    tips: course.home_config?.tips ?? [],
  });

  const tips = home.tips ?? [];
  const heroType: CourseHeroMediaType = home.hero_media_type ?? "video";

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadLmsImage(file, course.id);
      setHome((h) => ({ ...h, hero_image_url: url }));
      toast({ title: `Image importée (${formatFileSize(file.size)})` });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  };

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

        <div className="space-y-3 border-t pt-4">
          <Label>Bloc de présentation</Label>
          <RadioGroup
            value={heroType}
            onValueChange={(v) => setHome({ ...home, hero_media_type: v as CourseHeroMediaType })}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="video" id="hero-video" />
              <Label htmlFor="hero-video" className="font-normal cursor-pointer">Vidéo</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="image" id="hero-image" />
              <Label htmlFor="hero-image" className="font-normal cursor-pointer">Image</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="text" id="hero-text" />
              <Label htmlFor="hero-text" className="font-normal cursor-pointer">Texte</Label>
            </div>
          </RadioGroup>

          {heroType === "video" && (
            <div>
              <Label>Lien de la vidéo d'accueil</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
          )}

          {heroType === "image" && (
            <div className="space-y-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                  e.target.value = "";
                }}
              />
              {home.hero_image_url ? (
                <div className="relative max-w-md rounded-lg overflow-hidden border">
                  <img src={home.hero_image_url} alt="" className="w-full h-auto object-contain max-h-[300px]" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => setHome({ ...home, hero_image_url: null })}
                    aria-label="Supprimer l'image"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Spinner className="mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? "Upload…" : home.hero_image_url ? "Remplacer l'image" : "Importer une image"}
              </Button>
              <p className="text-xs text-muted-foreground">JPG, PNG, GIF ou WebP</p>
            </div>
          )}

          {heroType === "text" && (
            <div>
              <Label>Texte de présentation</Label>
              <Textarea
                value={home.hero_text ?? ""}
                onChange={(e) => setHome({ ...home, hero_text: e.target.value })}
                placeholder="Présentez votre formation en quelques mots…"
                rows={5}
              />
            </div>
          )}
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

        <div className="space-y-3 border-t pt-4">
          <Label>Encadrés du tableau de bord</Label>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Afficher l'encadré « Prochain live »</span>
            <Switch
              checked={home.show_next_live !== false}
              onCheckedChange={(v) => setHome({ ...home, show_next_live: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Afficher l'encadré « Communauté »</span>
            <Switch
              checked={home.show_community !== false}
              onCheckedChange={(v) => setHome({ ...home, show_community: v })}
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={updateCourse.isPending}>
          <Save className="w-4 h-4 mr-2" /> Sauvegarder la page d'accueil
        </Button>
      </CardContent>
    </Card>
  );
}
