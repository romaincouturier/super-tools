import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface SettingsGeneralDelaysProps {
  settings: Record<string, string>;
  updateSetting: (key: string, value: string) => void;
}

const SettingsGeneralDelays = ({ settings, updateSetting }: SettingsGeneralDelaysProps) => {
  const workingDays: boolean[] = (() => {
    try {
      const days = JSON.parse(settings.working_days);
      if (Array.isArray(days) && days.length === 7) return days;
    } catch { /* fallback */ }
    return [false, true, true, true, true, true, false];
  })();

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Jours ouvrables</h3>
        <p className="text-sm text-muted-foreground">
          Les emails automatisés (pré et post-formation) seront envoyés uniquement les jours ouvrables sélectionnés.
        </p>
        <div className="flex flex-wrap gap-4">
          {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day, index) => (
            <div key={day} className="flex items-center gap-2">
              <Checkbox
                id={`working-day-${index}`}
                checked={workingDays[index]}
                onCheckedChange={(checked) => {
                  const newDays = [...workingDays];
                  newDays[index] = checked === true;
                  updateSetting("working_days", JSON.stringify(newDays));
                }}
              />
              <Label htmlFor={`working-day-${index}`} className="text-sm cursor-pointer">{day}</Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Délais des emails avant formation</h3>
        <p className="text-sm text-muted-foreground">
          Configurez les délais d'envoi des emails automatiques avant la date de formation (J-X).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DelayField id="delay-needs-survey" label="Questionnaire de besoins" prefix="J -" suffix="jours" min={1} max={30} value={settings.delay_needs_survey_days} onChange={(v) => updateSetting("delay_needs_survey_days", v)} />
          <DelayField id="delay-reminder" label="Rappel logistique" prefix="J -" suffix="jours" min={1} max={30} value={settings.delay_reminder_days} onChange={(v) => updateSetting("delay_reminder_days", v)} />
          <DelayField id="delay-trainer-summary" label="Synthèse formateur" prefix="J -" suffix="jours" min={1} max={30} value={settings.delay_trainer_summary_days} onChange={(v) => updateSetting("delay_trainer_summary_days", v)} />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Relances convention de formation</h3>
        <p className="text-sm text-muted-foreground">
          Configurez les délais de relance pour la récupération de la convention de formation signée (en jours ouvrés après l'envoi).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DelayField id="delay-convention-reminder-1" label="1ère relance" prefix="J +" suffix="jours ouvrés" min={1} max={30} value={settings.delay_convention_reminder_1_days} onChange={(v) => updateSetting("delay_convention_reminder_1_days", v)} />
          <DelayField id="delay-convention-reminder-2" label="2ème relance" prefix="J +" suffix="jours ouvrés" min={1} max={30} value={settings.delay_convention_reminder_2_days} onChange={(v) => updateSetting("delay_convention_reminder_2_days", v)} />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Délais des emails après formation</h3>
        <p className="text-sm text-muted-foreground">
          Configurez les délais d'envoi des emails automatiques après la date de fin de formation (J+X).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DelayField id="delay-google-review" label="Avis Google" prefix="J +" suffix="jours" min={1} max={60} value={settings.delay_google_review_days} onChange={(v) => updateSetting("delay_google_review_days", v)} />
          <DelayField id="delay-video-testimonial" label="Témoignage vidéo" prefix="J +" suffix="jours" min={1} max={60} value={settings.delay_video_testimonial_days} onChange={(v) => updateSetting("delay_video_testimonial_days", v)} />
          <DelayField id="delay-cold-evaluation" label="Évaluation à froid commanditaire" prefix="J +" suffix="jours" min={1} max={90} value={settings.delay_cold_evaluation_days} onChange={(v) => updateSetting("delay_cold_evaluation_days", v)} />
          <div className="space-y-2">
            <Label htmlFor="delay-cold-evaluation-funder">Évaluation à froid financeur</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">J +</span>
              <Input id="delay-cold-evaluation-funder" type="number" min="1" max="120" value={settings.delay_cold_evaluation_funder_days} onChange={(e) => updateSetting("delay_cold_evaluation_funder_days", e.target.value)} className="w-20" />
              <span className="text-sm text-muted-foreground">jours</span>
            </div>
            <p className="text-xs text-muted-foreground">Uniquement si le financeur est différent du commanditaire</p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Délais des emails après mission</h3>
        <p className="text-sm text-muted-foreground">
          Configurez les délais d'envoi des emails automatiques après la date de fin de mission. Envoyés à tous les contacts de la mission.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DelayField id="delay-mission-google-review" label="Avis Google" prefix="J +" suffix="jours après fin mission" min={1} max={60} value={settings.delay_mission_google_review_days} onChange={(v) => updateSetting("delay_mission_google_review_days", v)} />
          <DelayField id="delay-mission-video-testimonial" label="Témoignage vidéo" prefix="J +" suffix="jours après l'avis Google" min={1} max={60} value={settings.delay_mission_video_testimonial_days} onChange={(v) => updateSetting("delay_mission_video_testimonial_days", v)} />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Relances pour collecte des évaluations</h3>
        <p className="text-sm text-muted-foreground">
          Ces relances sont envoyées uniquement aux participants n'ayant pas encore soumis leur évaluation.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="delay-evaluation-reminder-1">1ère relance</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">J +</span>
              <Input id="delay-evaluation-reminder-1" type="number" min="1" max="30" value={settings.delay_evaluation_reminder_1_days} onChange={(e) => updateSetting("delay_evaluation_reminder_1_days", e.target.value)} className="w-20" />
              <span className="text-sm text-muted-foreground">jours ouvrables</span>
            </div>
            <p className="text-xs text-muted-foreground">Relance amicale rappelant l'importance de l'évaluation</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delay-evaluation-reminder-2">2ème relance</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">J +</span>
              <Input id="delay-evaluation-reminder-2" type="number" min="1" max="30" value={settings.delay_evaluation_reminder_2_days} onChange={(e) => updateSetting("delay_evaluation_reminder_2_days", e.target.value)} className="w-20" />
              <span className="text-sm text-muted-foreground">jours ouvrables</span>
            </div>
            <p className="text-xs text-muted-foreground">Dernière relance mentionnant l'importance pour Qualiopi</p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Prise de nouvelles informelle</h3>
        <p className="text-sm text-muted-foreground">
          Un message personnalisé généré par l'IA est envoyé à chaque participant pour prendre de ses nouvelles et savoir ce qu'il a mis en pratique.
        </p>
        <div className="space-y-2">
          <Label htmlFor="delay-follow-up-news">Délai après envoi du mail de remerciement</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">J +</span>
            <Input id="delay-follow-up-news" type="number" min="7" max="90" value={settings.delay_follow_up_news_days} onChange={(e) => updateSetting("delay_follow_up_news_days", e.target.value)} className="w-20" />
            <span className="text-sm text-muted-foreground">jours ouvrables</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Message informel et humain, sans formulaire ni questionnaire — juste pour nouer la conversation
          </p>
        </div>
      </div>
    </>
  );
};

// Reusable delay field component
function DelayField({ id, label, prefix, suffix, min, max, value, onChange }: {
  id: string;
  label: string;
  prefix: string;
  suffix: string;
  min: number;
  max: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{prefix}</span>
        <Input id={id} type="number" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} className="w-20" />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

export default SettingsGeneralDelays;
