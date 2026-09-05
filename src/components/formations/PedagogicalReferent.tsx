import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { UsersRound } from "lucide-react";
import { usePedagogicalReferent } from "@/hooks/usePedagogicalReferent";

/**
 * Référent pédagogique de la session (indicateur 19).
 *
 * Le décret le rend obligatoire « au-delà d'un nombre d'intervenants par
 * formation, fixé par arrêté ». L'arrêté n'étant pas paru, le seuil vit dans
 * les réglages et reste vide : la désignation est possible, jamais imposée.
 * Le jour où le seuil est publié, il suffit de le renseigner.
 */

interface Props {
  trainingId: string;
  /** Formateur principal, qui peut être l'un des intervenants coordonnés. */
  trainerName: string | null;
}

export default function PedagogicalReferent({ trainingId, trainerName }: Props) {
  const { referent, setReferent, threshold, loading, saving, save } =
    usePedagogicalReferent(trainingId);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8"><Spinner /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UsersRound className="h-4 w-4" />
          Référent pédagogique
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Chargé de la coordination pédagogique entre les intervenants de cette
          session. Distinct du formateur principal
          {trainerName ? ` (${trainerName})` : ""}, qui peut être l'un d'eux.
          {threshold
            ? ` Obligatoire au-delà de ${threshold} intervenants.`
            : " Le seuil qui le rend obligatoire est fixé par un arrêté non paru : la désignation reste facultative."}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="referent-name">Nom</Label>
            <Input
              id="referent-name"
              value={referent.name}
              onChange={(e) => setReferent((p) => ({ ...p, name: e.target.value }))}
              placeholder="Prénom Nom"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="referent-email">Email</Label>
            <Input
              id="referent-email"
              type="email"
              value={referent.email}
              onChange={(e) => setReferent((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {referent.designatedAt
              ? `Désigné le ${new Date(referent.designatedAt).toLocaleDateString("fr-FR")}.`
              : "Aucun référent désigné pour cette session."}
          </span>
          <Button onClick={() => save()} disabled={saving} size="sm">
            {saving && <Spinner className="mr-2" />}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
