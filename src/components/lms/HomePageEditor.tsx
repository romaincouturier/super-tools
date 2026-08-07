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
import {
  CTA_LABEL_MAX_LENGTH,
  DEFAULT_CTA_LABEL_RESUME,
  DEFAULT_CTA_LABEL_START,
  INTRO_BOX_OPTIONS,
  PROGRESS_DISPLAY_OPTIONS,
  introBoxDefaultTitle,
  resolveIntroBox,
  type IntroBoxType,
  type ProgressDisplayMode,
} from "@/lib/lmsCourseHome";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import HomeIntroBox from "@/components/lms/HomeIntroBox";

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
  const introType: IntroBoxType = home.intro_box_type ?? "tips";

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
          <Label>Bouton principal</Label>
          <p className="text-xs text-muted-foreground">
            Laissez vide pour conserver les libellés par défaut.
          </p>
          <CtaLabelField
            id="cta-label-start"
            label="Premier accès"
            value={home.cta_label_start ?? ""}
            placeholder={DEFAULT_CTA_LABEL_START}
            onChange={(v) => setHome({ ...home, cta_label_start: v || null })}
          />
          <CtaLabelField
            id="cta-label-resume"
            label="Reprise (progression démarrée)"
            value={home.cta_label_resume ?? ""}
            placeholder={DEFAULT_CTA_LABEL_RESUME}
            onChange={(v) => setHome({ ...home, cta_label_resume: v || null })}
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

        <div className="space-y-3 border-t pt-4">
          <Label>Encadré d'introduction</Label>
          <Select
            value={introType}
            onValueChange={(v) => setHome({ ...home, intro_box_type: v as IntroBoxType })}
          >
            <SelectTrigger className="sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTRO_BOX_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {introType !== "none" && (
            <>
              <div>
                <Label htmlFor="intro-box-title" className="font-normal">Titre</Label>
                <Input
                  id="intro-box-title"
                  value={home.intro_box_title ?? ""}
                  placeholder={introBoxDefaultTitle(introType) ?? ""}
                  onChange={(e) => setHome({ ...home, intro_box_title: e.target.value || null })}
                />
              </div>

              <div>
                <Label className="font-normal">Contenu</Label>
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
                        placeholder="Une ligne de l'encadré…"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setHome({ ...home, tips: tips.filter((_, j) => j !== i) })}
                        aria-label="Supprimer la ligne"
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
                    <Plus className="w-4 h-4 mr-2" /> Ajouter une ligne
                  </Button>
                </div>
              </div>

              <div>
                <Label className="font-normal">Aperçu</Label>
                <div className="rounded-xl p-4 max-w-sm" style={{ background: "var(--st-surface, #F7F7F5)" }}>
                  {resolveIntroBox(home) ? (
                    <HomeIntroBox config={home} />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Ajoutez au moins une ligne de contenu pour que l'encadré s'affiche.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-3 border-t pt-4">
          <Label>Indicateurs de progression</Label>
          <p className="text-xs text-muted-foreground">
            Anneau « Votre progression » et compteur de la barre latérale. Le suivi de complétion
            reste enregistré et visible dans les statistiques, quel que soit ce réglage.
          </p>
          <RadioGroup
            value={home.progress_display ?? "auto"}
            onValueChange={(v) => setHome({ ...home, progress_display: v as ProgressDisplayMode })}
            className="flex flex-col gap-2"
          >
            {PROGRESS_DISPLAY_OPTIONS.map((o) => (
              <div key={o.value} className="flex items-start gap-2">
                <RadioGroupItem value={o.value} id={`progress-${o.value}`} className="mt-1" />
                <Label htmlFor={`progress-${o.value}`} className="font-normal cursor-pointer">
                  {o.label}
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
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

/** Champ de libellé du bouton d'accueil : placeholder = libellé par défaut, compteur, 40 caractères max. */
function CtaLabelField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="font-normal">{label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value.length}/{CTA_LABEL_MAX_LENGTH}
        </span>
      </div>
      <Input
        id={id}
        value={value}
        maxLength={CTA_LABEL_MAX_LENGTH}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
