import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Plus, Trash2, Save } from "lucide-react";
import { useUpdateCourse } from "@/hooks/useLms";
import type { CourseHomeConfig } from "@/hooks/useLmsQueries";
import { useToast } from "@/hooks/use-toast";

type Props = {
  course: {
    id: string;
    welcome_video_url?: string | null;
    welcome_text?: string | null;
    home_config?: CourseHomeConfig | null;
  };
};

export default function HomePageEditor({ course }: Props) {
  const updateCourse = useUpdateCourse();
  const { toast } = useToast();

  const [welcome, setWelcome] = useState({
    welcome_video_url: course.welcome_video_url || "",
    welcome_text: course.welcome_text || "",
  });
  const [home, setHome] = useState<CourseHomeConfig>({
    plan_url: course.home_config?.plan_url ?? "",
    period_start: course.home_config?.period_start ?? "",
    period_end: course.home_config?.period_end ?? "",
    period_note: course.home_config?.period_note ?? "",
    objectives: course.home_config?.objectives ?? [],
    prerequisites: course.home_config?.prerequisites ?? "",
    documents: course.home_config?.documents ?? [],
    instructor: course.home_config?.instructor ?? {},
  });

  const objectives = home.objectives ?? [];
  const documents = home.documents ?? [];
  const setInstructor = (patch: Partial<NonNullable<CourseHomeConfig["instructor"]>>) =>
    setHome((h) => ({ ...h, instructor: { ...(h.instructor ?? {}), ...patch } }));

  const handleSave = async () => {
    await updateCourse.mutateAsync({ id: course.id, ...welcome, home_config: home });
    toast({ title: "Page d'accueil sauvegardée" });
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div>
          <Label>Vidéo d'accueil (URL YouTube, Vimeo ou fichier)</Label>
          <Input
            value={welcome.welcome_video_url}
            onChange={(e) => setWelcome({ ...welcome, welcome_video_url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>
        <div>
          <Label>Texte sous le titre</Label>
          <VoiceTextarea
            value={welcome.welcome_text}
            onValueChange={(v) => setWelcome({ ...welcome, welcome_text: v })}
            onChange={(e) => setWelcome({ ...welcome, welcome_text: e.target.value })}
            rows={3}
            placeholder="Message de bienvenue affiché sous le titre…"
          />
        </div>

        <div>
          <Label>Lien « Voir le plan de la formation »</Label>
          <Input value={home.plan_url || ""} onChange={(e) => setHome({ ...home, plan_url: e.target.value })} placeholder="https://…" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Début de formation</Label>
            <Input type="date" value={home.period_start || ""} onChange={(e) => setHome({ ...home, period_start: e.target.value })} />
          </div>
          <div>
            <Label>Fin de formation</Label>
            <Input type="date" value={home.period_end || ""} onChange={(e) => setHome({ ...home, period_end: e.target.value })} />
          </div>
          <div>
            <Label>Note sur la période</Label>
            <Input value={home.period_note || ""} onChange={(e) => setHome({ ...home, period_note: e.target.value })} placeholder="Ex : accessible à votre rythme…" />
          </div>
        </div>

        <div>
          <Label>Objectifs de la formation</Label>
          <div className="space-y-2">
            {objectives.map((obj, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={obj}
                  onChange={(e) => { const next = [...objectives]; next[i] = e.target.value; setHome({ ...home, objectives: next }); }}
                  placeholder="Objectif…"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => setHome({ ...home, objectives: objectives.filter((_, j) => j !== i) })}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setHome({ ...home, objectives: [...objectives, ""] })}>
              <Plus className="w-4 h-4 mr-2" /> Ajouter un objectif
            </Button>
          </div>
        </div>

        <div>
          <Label>Prérequis</Label>
          <VoiceTextarea
            value={home.prerequisites || ""}
            onValueChange={(v) => setHome({ ...home, prerequisites: v })}
            onChange={(e) => setHome({ ...home, prerequisites: e.target.value })}
            rows={2}
            placeholder="Ex : il n'est pas nécessaire de savoir dessiner…"
          />
        </div>

        <div>
          <Label>Documents utiles</Label>
          <div className="space-y-2">
            {documents.map((doc, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={doc.label}
                  placeholder="Libellé"
                  onChange={(e) => { const next = [...documents]; next[i] = { ...next[i], label: e.target.value }; setHome({ ...home, documents: next }); }}
                />
                <Input
                  value={doc.url}
                  placeholder="https://…"
                  onChange={(e) => { const next = [...documents]; next[i] = { ...next[i], url: e.target.value }; setHome({ ...home, documents: next }); }}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => setHome({ ...home, documents: documents.filter((_, j) => j !== i) })}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setHome({ ...home, documents: [...documents, { label: "", url: "" }] })}>
              <Plus className="w-4 h-4 mr-2" /> Ajouter un document
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Formateur</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input value={home.instructor?.name || ""} placeholder="Nom" onChange={(e) => setInstructor({ name: e.target.value })} />
            <Input value={home.instructor?.subtitle || ""} placeholder="Sous-titre (ex : Votre formateur)" onChange={(e) => setInstructor({ subtitle: e.target.value })} />
            <Input value={home.instructor?.photo_url || ""} placeholder="URL de la photo" onChange={(e) => setInstructor({ photo_url: e.target.value })} />
            <Input value={home.instructor?.email || ""} placeholder="Email" onChange={(e) => setInstructor({ email: e.target.value })} />
            <Input value={home.instructor?.phone || ""} placeholder="Téléphone" onChange={(e) => setInstructor({ phone: e.target.value })} />
            <Input value={home.instructor?.cv_url || ""} placeholder="URL du CV" onChange={(e) => setInstructor({ cv_url: e.target.value })} />
          </div>
          <Input value={home.instructor?.note || ""} placeholder="Note (ex : n'hésitez pas à le contacter)" onChange={(e) => setInstructor({ note: e.target.value })} />
        </div>

        <Button onClick={handleSave} disabled={updateCourse.isPending}>
          <Save className="w-4 h-4 mr-2" /> Sauvegarder la page d'accueil
        </Button>
      </CardContent>
    </Card>
  );
}
