import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useConnexionIndicators, useDormantLearnerAccounts } from "@/hooks/useConnexionIndicators";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskEmail } from "@/lib/demoMask";

/**
 * Indicateurs de la refonte de connexion (chapitre 20 de la spécification)
 * et comptes dormants signalés pour suppression (RG-23).
 */
export default function ConnexionTab() {
  const { isDemoMode } = useDemoMode();
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useConnexionIndicators(days);
  const dormant = useDormantLearnerAccounts(3);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="mt-4">
        <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 text-destructive" />
          Indicateurs indisponibles. La migration du lot 6 est-elle appliquée ?
        </CardContent>
      </Card>
    );
  }

  const tiles: { label: string; value: string; hint: string }[] = [
    {
      label: "Taux d'activation",
      value: data.activation_rate === null ? "—" : `${data.activation_rate} %`,
      hint: `${data.activated_accounts} activés sur ${data.provisioned_accounts} comptes provisionnés`,
    },
    {
      label: "Connexions réussies",
      value: data.first_try_rate === null ? "—" : `${data.first_try_rate} %`,
      hint: `${data.successful_logins} réussies, ${data.failed_logins} échecs`,
    },
    {
      label: "Liens envoyés",
      value: String(data.links_sent),
      hint: `${data.links_expired_unused} expirés sans avoir servi`,
    },
    {
      label: "Résolutions d'identité",
      value: String(data.resolutions),
      hint: `${data.resolutions_throttled} au-delà du quota`,
    },
  ];

  return (
    <div className="mt-4 space-y-6">
      <ToggleGroup
        type="single"
        value={String(days)}
        onValueChange={(v) => v && setDays(Number(v))}
        className="justify-start"
      >
        <ToggleGroupItem value="7">7 jours</ToggleGroupItem>
        <ToggleGroupItem value="30">30 jours</ToggleGroupItem>
        <ToggleGroupItem value="90">90 jours</ToggleGroupItem>
      </ToggleGroup>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{tile.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{tile.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Une baisse des envois de liens accompagnée d'une hausse des liens expirés signalerait une
        durée de validité trop courte.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Comptes apprenants dormants depuis 3 ans
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dormant.isLoading ? (
            <Spinner />
          ) : dormant.data && dormant.data.length > 0 ? (
            <ul className="divide-y text-sm">
              {dormant.data.slice(0, 50).map((account) => (
                <li key={account.email /* demo-safe: cle React, jamais affichee */} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{isDemoMode ? maskEmail(account.email) : account.email}</span>
                  <span className="text-muted-foreground">
                    {account.last_sign_in_at
                      ? `dernière connexion ${format(new Date(account.last_sign_in_at), "d MMMM yyyy", { locale: fr })}`
                      : `créé le ${format(new Date(account.created_at), "d MMMM yyyy", { locale: fr })}, jamais connecté`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun compte dormant à signaler.</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Signalement seulement. La suppression se décide compte par compte, depuis
            l'administration des apprenants. Les données de formation, soumises à conservation
            Qualiopi, ne sont pas concernées.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
