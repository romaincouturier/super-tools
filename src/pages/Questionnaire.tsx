import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type QuestionnaireRecord = {
  id: string;
  training_id: string;
  token: string;
  etat: string;
  email: string | null;
  prenom: string | null;
  nom: string | null;
  societe: string | null;
  fonction: string | null;
  experience_sujet: string | null;
  experience_details: string | null;
  lecture_programme: string | null;
  prerequis_validation: string | null;
  prerequis_details: string | null;
  competences_actuelles: string | null;
  competences_visees: string | null;
  lien_mission: string | null;
  contraintes_orga: string | null;
  besoins_accessibilite: string | null;
  commentaires_libres: string | null;
  consentement_rgpd: boolean;
  date_premiere_ouverture: string | null;
  date_derniere_sauvegarde: string | null;
  date_soumission: string | null;
  date_consentement_rgpd: string | null;
};

type TrainingRecord = {
  training_name: string;
  start_date: string;
  end_date: string | null;
};

const Questionnaire = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireRecord | null>(null);
  const [training, setTraining] = useState<TrainingRecord | null>(null);

  const dirtyRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);

  const displayName = useMemo(() => {
    if (!questionnaire) return "";
    const parts = [questionnaire.prenom, questionnaire.nom].filter(Boolean);
    return parts.join(" ").trim();
  }, [questionnaire]);

  const markDirty = () => {
    dirtyRef.current = true;
  };

  const insertEvent = async (questionnaireId: string, type_evenement: string, metadata?: Record<string, unknown>) => {
    try {
      await supabase.from("questionnaire_events").insert([
        {
          questionnaire_id: questionnaireId,
          type_evenement,
          metadata: (metadata ?? {}) as any,
        },
      ]);
    } catch (e) {
      // non-blocking
      console.warn("Failed to insert questionnaire event", e);
    }
  };

  const fetchData = async () => {
    if (!token) {
      setError("Lien invalide : token manquant.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: q, error: qErr } = await supabase
        .from("questionnaire_besoins")
        .select("*")
        .eq("token", token)
        .single();

      if (qErr || !q) {
        throw qErr || new Error("Questionnaire introuvable");
      }

      const qTyped = q as unknown as QuestionnaireRecord;
      setQuestionnaire(qTyped);

      const { data: t, error: tErr } = await supabase
        .from("trainings")
        .select("training_name,start_date,end_date")
        .eq("id", qTyped.training_id)
        .single();

      if (!tErr && t) {
        setTraining(t as unknown as TrainingRecord);
      }

      // First open tracking
      if (!qTyped.date_premiere_ouverture) {
        const nowIso = new Date().toISOString();
        await supabase
          .from("questionnaire_besoins")
          .update({
            date_premiere_ouverture: nowIso,
            etat: qTyped.etat === "envoye" ? "accueil_envoye" : qTyped.etat,
          })
          .eq("id", qTyped.id);
        await insertEvent(qTyped.id, "opened", { source: "public_link" });
      }
    } catch (e: any) {
      console.error("Failed to load questionnaire", e);
      setError(
        "Impossible d'ouvrir ce questionnaire (lien invalide, expiré, ou accès refusé)."
      );
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async (opts?: { silent?: boolean }) => {
    if (!questionnaire) return;
    if (!dirtyRef.current) return;

    const nowIso = new Date().toISOString();
    setSaving(true);
    try {
      const payload = {
        prenom: questionnaire.prenom,
        nom: questionnaire.nom,
        societe: questionnaire.societe,
        fonction: questionnaire.fonction,
        experience_sujet: questionnaire.experience_sujet,
        experience_details: questionnaire.experience_details,
        lecture_programme: questionnaire.lecture_programme,
        prerequis_validation: questionnaire.prerequis_validation,
        prerequis_details: questionnaire.prerequis_details,
        competences_actuelles: questionnaire.competences_actuelles,
        competences_visees: questionnaire.competences_visees,
        lien_mission: questionnaire.lien_mission,
        contraintes_orga: questionnaire.contraintes_orga,
        besoins_accessibilite: questionnaire.besoins_accessibilite,
        commentaires_libres: questionnaire.commentaires_libres,
        consentement_rgpd: questionnaire.consentement_rgpd,
        date_consentement_rgpd: questionnaire.consentement_rgpd
          ? questionnaire.date_consentement_rgpd || nowIso
          : null,
        date_derniere_sauvegarde: nowIso,
      };

      const { error: upErr } = await supabase
        .from("questionnaire_besoins")
        .update(payload)
        .eq("id", questionnaire.id);

      if (upErr) throw upErr;

      dirtyRef.current = false;
      setQuestionnaire((prev) => (prev ? { ...prev, ...payload } : prev));

      if (!opts?.silent) {
        toast({
          title: "Sauvegardé",
          description: "Vos réponses ont été enregistrées.",
        });
      }
    } catch (e: any) {
      console.error("Autosave failed", e);
      if (!opts?.silent) {
        toast({
          title: "Erreur",
          description: "Impossible de sauvegarder. Réessayez.",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!questionnaire) return;
    if (!questionnaire.consentement_rgpd) {
      toast({
        title: "Consentement requis",
        description: "Veuillez accepter la clause RGPD pour soumettre le questionnaire.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Ensure latest answers saved
      await saveDraft({ silent: true });

      const nowIso = new Date().toISOString();
      const { error: upErr } = await supabase
        .from("questionnaire_besoins")
        .update({
          etat: "complete",
          date_soumission: nowIso,
          date_consentement_rgpd: questionnaire.date_consentement_rgpd || nowIso,
        })
        .eq("id", questionnaire.id);

      if (upErr) throw upErr;

      await insertEvent(questionnaire.id, "submitted", { source: "public_link" });
      dirtyRef.current = false;
      toast({
        title: "Merci !",
        description: "Votre questionnaire a bien été envoyé.",
      });

      setQuestionnaire((prev) =>
        prev ? { ...prev, etat: "complete", date_soumission: nowIso } : prev
      );
    } catch (e: any) {
      console.error("Submit failed", e);
      toast({
        title: "Erreur",
        description: "Impossible de soumettre le questionnaire. Réessayez.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (autosaveTimerRef.current) {
      window.clearInterval(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setInterval(() => {
      if (dirtyRef.current && !saving && !submitting) {
        void saveDraft({ silent: true });
      }
    }, 30_000);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearInterval(autosaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, submitting, questionnaire?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !questionnaire) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Questionnaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error || "Questionnaire introuvable."}</p>
            <Button asChild variant="outline">
              <a href="/">Retour à l'accueil</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Questionnaire de recueil des besoins</CardTitle>
            {(training || displayName) && (
              <p className="text-sm text-muted-foreground">
                {training ? (
                  <>
                    Formation : <span className="font-medium">{training.training_name}</span>
                  </>
                ) : null}
                {training && displayName ? " • " : null}
                {displayName ? (
                  <>
                    Participant : <span className="font-medium">{displayName}</span>
                  </>
                ) : null}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prenom">Prénom</Label>
                <Input
                  id="prenom"
                  value={questionnaire.prenom || ""}
                  onChange={(e) => {
                    markDirty();
                    setQuestionnaire((p) => (p ? { ...p, prenom: e.target.value } : p));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  value={questionnaire.nom || ""}
                  onChange={(e) => {
                    markDirty();
                    setQuestionnaire((p) => (p ? { ...p, nom: e.target.value } : p));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="societe">Société</Label>
                <Input
                  id="societe"
                  value={questionnaire.societe || ""}
                  onChange={(e) => {
                    markDirty();
                    setQuestionnaire((p) => (p ? { ...p, societe: e.target.value } : p));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fonction">Fonction</Label>
                <Input
                  id="fonction"
                  value={questionnaire.fonction || ""}
                  onChange={(e) => {
                    markDirty();
                    setQuestionnaire((p) => (p ? { ...p, fonction: e.target.value } : p));
                  }}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={questionnaire.email || ""} readOnly />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience">Votre expérience sur le sujet</Label>
              <Textarea
                id="experience"
                value={questionnaire.experience_details || ""}
                onChange={(e) => {
                  markDirty();
                  setQuestionnaire((p) => (p ? { ...p, experience_details: e.target.value } : p));
                }}
                rows={4}
                placeholder="Décrivez votre contexte, vos enjeux, votre niveau actuel..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objectifs">Compétences visées / objectifs</Label>
              <Textarea
                id="objectifs"
                value={questionnaire.competences_visees || ""}
                onChange={(e) => {
                  markDirty();
                  setQuestionnaire((p) => (p ? { ...p, competences_visees: e.target.value } : p));
                }}
                rows={3}
                placeholder="Qu'aimeriez-vous apprendre ou améliorer ?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contraintes">Contraintes d'organisation</Label>
              <Textarea
                id="contraintes"
                value={questionnaire.contraintes_orga || ""}
                onChange={(e) => {
                  markDirty();
                  setQuestionnaire((p) => (p ? { ...p, contraintes_orga: e.target.value } : p));
                }}
                rows={3}
                placeholder="Horaires, matériel, prérequis techniques, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessibilite">Besoins d'accessibilité (optionnel)</Label>
              <Textarea
                id="accessibilite"
                value={questionnaire.besoins_accessibilite || ""}
                onChange={(e) => {
                  markDirty();
                  setQuestionnaire((p) => (p ? { ...p, besoins_accessibilite: e.target.value } : p));
                }}
                rows={3}
                placeholder="Avez-vous besoin d'aménagements particuliers ?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="commentaires">Commentaires libres (optionnel)</Label>
              <Textarea
                id="commentaires"
                value={questionnaire.commentaires_libres || ""}
                onChange={(e) => {
                  markDirty();
                  setQuestionnaire((p) => (p ? { ...p, commentaires_libres: e.target.value } : p));
                }}
                rows={3}
              />
            </div>

            <div className="flex items-start gap-3 rounded-md border p-4">
              <Checkbox
                id="rgpd"
                checked={questionnaire.consentement_rgpd}
                onCheckedChange={(checked) => {
                  markDirty();
                  setQuestionnaire((p) =>
                    p ? { ...p, consentement_rgpd: Boolean(checked) } : p
                  );
                }}
              />
              <div className="space-y-1">
                <Label htmlFor="rgpd">Consentement RGPD</Label>
                <p className="text-sm text-muted-foreground">
                  J'accepte que mes réponses soient utilisées pour préparer et adapter la formation.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => saveDraft()}
                disabled={saving || submitting}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  "Sauvegarder"
                )}
              </Button>
              <Button type="button" onClick={submit} disabled={saving || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Envoyer le questionnaire"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Questionnaire;
