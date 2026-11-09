import { useHandicapReferent } from "@/hooks/useHandicapReferent";

/**
 * Coordonnées du référent handicap, affichées au bénéficiaire (indicateur 26).
 *
 * Tant qu'aucun référent n'est désigné dans les réglages, la ligne ne prétend
 * pas qu'il y en a un : elle donne le contact général. Annoncer « notre
 * référent handicap » en affichant l'adresse d'envoi des emails, c'est ce que
 * faisait l'écran avant, et cela ne désignait personne.
 */
export default function HandicapReferentLine({
  fallbackName,
  fallbackEmail,
}: {
  fallbackName: string;
  fallbackEmail: string;
}) {
  const referent = useHandicapReferent({ name: fallbackName, email: fallbackEmail });

  if (referent.loading || !referent.email) return null;

  return (
    <p className="text-sm text-muted-foreground border-l-2 border-primary pl-3">
      {referent.isDesignated ? "Notre référent handicap : " : "Votre contact : "}
      <strong>{referent.name}</strong>
      {" – "}
      <a href={`mailto:${referent.email}`} className="text-primary hover:underline">
        {referent.email}
      </a>
      {referent.phone && <> – {referent.phone}</>}
    </p>
  );
}
