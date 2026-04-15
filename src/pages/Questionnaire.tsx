import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, WifiOff, RefreshCw, Calendar, Clock, MapPin, Video, Save } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { formatDateWithTime } from "@/lib/dateFormatters";
import supertiltLogo from "@/assets/supertilt-logo-anthracite-transparent.png";
import QuestionnaireFormSections from "@/components/questionnaire/QuestionnaireFormSections";
import { useQuestionnaire } from "@/hooks/useQuestionnaire";

const Questionnaire = () => {
  const q = useQuestionnaire();

  if (q.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (q.error || !q.questionnaire) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-2" />
            <CardTitle className="text-center">Questionnaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">{q.error || "Questionnaire introuvable."}</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => { q.setRetryCount((c) => c + 1); q.setError(null); q.setLoading(true); q.fetchData(); }}>
                <RefreshCw className="w-4 h-4 mr-2" />Réessayer
              </Button>
              <Button asChild variant="outline"><a href="/">Retour à l'accueil</a></Button>
            </div>
            {q.retryCount > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Si le problème persiste, vérifiez votre connexion internet ou contactez-nous à{" "}
                <a href={`mailto:${q.contactEmail}`} className="text-primary hover:underline">{q.contactEmail}</a>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already submitted
  if (q.questionnaire.etat === "complete" && !q.editingAfterSubmit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
            <CardTitle>Questionnaire envoyé !</CardTitle>
            <CardDescription>
              Merci d'avoir complété le questionnaire de recueil des besoins pour la formation "{q.training?.training_name}".
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">Vos réponses ont bien été enregistrées et seront utilisées pour adapter la formation à vos attentes.</p>
            {q.questionnaire.date_soumission && (
              <p className="text-xs text-muted-foreground">Soumis le {formatDateWithTime(q.questionnaire.date_soumission)}</p>
            )}
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium">Vous pouvez modifier vos réponses :</p>
              <Button className="w-full" onClick={() => q.setEditingAfterSubmit(true)}>Modifier mes réponses</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Offline banner */}
      {!q.isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />Vous êtes hors connexion. Vos réponses seront sauvegardées dès le retour du réseau.
        </div>
      )}

      {/* Save status indicator */}
      {q.saveStatus !== "idle" && (
        <div className={`fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 transition-all ${
          q.saveStatus === "saving" ? "bg-muted text-muted-foreground" :
          q.saveStatus === "saved" ? "bg-primary/10 text-primary" :
          "bg-destructive/10 text-destructive"
        }`}>
          {q.saveStatus === "saving" && <><Loader2 className="w-3 h-3 animate-spin" /> Sauvegarde...</>}
          {q.saveStatus === "saved" && <><CheckCircle2 className="w-3 h-3" /> Sauvegardé</>}
          {q.saveStatus === "error" && (
            <>
              <AlertTriangle className="w-3 h-3" /> Erreur de sauvegarde
              <button onClick={() => q.saveDraft({ silent: false })} className="underline ml-1 font-medium">Réessayer</button>
            </>
          )}
        </div>
      )}

      <div className="mx-auto w-full max-w-3xl space-y-6" onBlur={q.handleFieldBlur}>
        {/* Logo */}
        <div className="flex justify-center">
          <a href="https://www.supertilt.fr" target="_blank" rel="noopener noreferrer">
            <img src={supertiltLogo} alt="SuperTilt" className="h-12 md:h-16" />
          </a>
        </div>

        {/* Header with training info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">Questionnaire de recueil des besoins</CardTitle>
            {q.training && (
              <CardDescription className="space-y-3 pt-2">
                <p className="text-base font-medium text-foreground">{q.training.training_name}</p>
                {q.schedules.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1">
                      {q.schedules.map((sched, idx) => (
                        <div key={idx} className="contents">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 shrink-0" />
                            <span className="capitalize">{q.formatScheduleDate(sched.day_date)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>{q.formatTime(sched.start_time)} - {q.formatTime(sched.end_time)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground italic">Horaires indiqués en heure de Paris</p>
                  </div>
                )}
                {q.training.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {(() => {
                      const loc = q.training.location!.toLowerCase();
                      const isOnlineLocation = loc.includes("visio") || loc.includes("en ligne") || loc.includes("distanciel") || loc.includes("zoom") || loc.includes("teams") || loc.includes("meet");
                      const urlMatch = q.training.location!.match(/(https?:\/\/[^\s]+)/);
                      return (
                        <>
                          {isOnlineLocation ? <Video className="w-4 h-4 shrink-0" /> : <MapPin className="w-4 h-4 shrink-0" />}
                          {urlMatch ? (
                            <a href={urlMatch[0]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{q.training.location}</a>
                          ) : (
                            <span>{q.training.location}</span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </CardDescription>
            )}
          </CardHeader>
        </Card>

        <QuestionnaireFormSections
          questionnaire={q.questionnaire}
          setQuestionnaire={q.setQuestionnaire}
          training={q.training}
          prerequisValidations={q.prerequisValidations}
          setPrerequisValidations={q.setPrerequisValidations}
          accessibiliteChoice={q.accessibiliteChoice}
          setAccessibiliteChoice={q.setAccessibiliteChoice}
          isInterEntreprises={q.isInterEntreprises}
          contactEmail={q.contactEmail}
          contactName={q.contactName}
          markDirty={q.markDirty}
          hasUnvalidatedPrerequisites={q.hasUnvalidatedPrerequisites}
          submitting={q.submitting}
          submit={q.submit}
          saveDraft={q.saveDraft}
          saving={q.saving}
        />
      </div>
    </div>
  );
};

export default Questionnaire;
