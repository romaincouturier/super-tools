/**
 * Fiche de décision d'un appel d'offres.
 *
 * L'ordre d'affichage suit l'ordre dans lequel l'information fait basculer un
 * Go/No Go : échéance, titulaire sortant, pondération des critères,
 * allotissement, montant et durée, puis l'historique avec cet acheteur.
 */
import { AlertTriangle, Building2, CalendarClock, ExternalLink, FileDown, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { daysLeft, TENDER_URGENT_DAYS } from "@/lib/tenders";
import { tenderNoGoReasonConfig, tenderSourceConfig, type TenderWithContext } from "@/types/tenders";

interface TenderCardProps {
  tender: TenderWithContext;
  onGo: () => void;
  onNoGo: () => void;
  onReopen: () => void;
  decided?: boolean;
}

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  const left = daysLeft(deadline);
  if (left === null) {
    return (
      <Badge variant="outline" className="gap-1">
        <CalendarClock className="h-3 w-3" />
        Date limite non publiée
      </Badge>
    );
  }
  const urgent = left <= TENDER_URGENT_DAYS;
  return (
    <Badge
      variant={urgent ? "destructive" : "outline"}
      className={cn("gap-1", !urgent && "border-muted-foreground/30")}
    >
      <CalendarClock className="h-3 w-3" />
      {left < 0 ? "Dépassée" : `J-${left}`}
      {deadline && ` — ${new Date(deadline).toLocaleDateString("fr-FR")}`}
    </Badge>
  );
}

export function TenderCard({ tender, onGo, onNoGo, onReopen, decided }: TenderCardProps) {
  const d = tender.decision ?? {};
  const prix = d.criteres?.find((c) => /prix/i.test(c.libelle));
  // Un marché majoritairement noté sur le prix n'est pas pour SuperTilt :
  // c'est le deuxième signal de décision, après le titulaire sortant.
  const prixDominant = prix?.poids != null && prix.poids >= 50;
  const wonWithBuyer = tender.buyer_history.filter((h) => h.sales_status === "WON").length;

  return (
    <Card className={cn(decided && "opacity-70")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium leading-snug">{tender.objet || "(sans objet)"}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {tender.acheteur || "Acheteur non précisé"}
              {d.ville ? ` — ${d.ville}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <DeadlineBadge deadline={tender.datelimitereponse} />
            <Badge variant="secondary" className="text-[10px]">
              {tenderSourceConfig[tender.source] ?? tender.source}
            </Badge>
          </div>
        </div>

        {d.titulaire && (
          <div className="flex items-start gap-1.5 text-sm rounded-md bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
            <span>
              Titulaire sortant : <strong>{d.titulaire}</strong>
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 text-xs">
          {d.criteres?.map((c, i) => (
            <Badge
              key={`${c.libelle}-${i}`}
              variant="outline"
              className={cn(prixDominant && /prix/i.test(c.libelle) && "border-destructive text-destructive")}
            >
              {c.libelle}
              {c.poids !== null ? ` ${c.poids}%` : ""}
            </Badge>
          ))}
          {d.montant != null && (
            <Badge variant="outline">{d.montant.toLocaleString("fr-FR")} €</Badge>
          )}
          {d.duree_mois != null && <Badge variant="outline">{d.duree_mois} mois</Badge>}
          {d.reconductible === true && <Badge variant="outline">Reconductible</Badge>}
          {!!d.lots?.length && (
            <Badge variant="outline" className="gap-1">
              <Layers className="h-3 w-3" />
              {d.lots.length} lot{d.lots.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {!!d.lots?.length && (
          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
            {d.lots.slice(0, 6).map((lot, i) => (
              <li key={i} className="line-clamp-1">
                {lot}
              </li>
            ))}
          </ul>
        )}

        {tender.buyer_history.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Déjà {tender.buyer_history.length} opportunité
            {tender.buyer_history.length > 1 ? "s" : ""} avec cet acheteur
            {wonWithBuyer > 0 && `, dont ${wonWithBuyer} gagnée${wonWithBuyer > 1 ? "s" : ""}`}.
          </p>
        )}

        {!!tender.matched_on.length && (
          <p className="text-[11px] text-muted-foreground">
            Retenu sur : {tender.matched_on.join(", ")}
          </p>
        )}

        {tender.parse_error && (
          <p className="text-[11px] text-destructive">Avis partiellement illisible : {tender.parse_error}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {tender.url_avis && (
            <Button variant="outline" size="sm" asChild>
              <a href={tender.url_avis} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                L'avis
              </a>
            </Button>
          )}
          {d.url_dce && (
            <Button variant="outline" size="sm" asChild>
              <a href={d.url_dce} target="_blank" rel="noopener noreferrer">
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                Le DCE
              </a>
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {decided ? (
              <>
                {tender.no_go_reason && (
                  <span className="text-xs text-muted-foreground">
                    {tenderNoGoReasonConfig[
                      tender.no_go_reason as keyof typeof tenderNoGoReasonConfig
                    ] ?? tender.no_go_reason}
                  </span>
                )}
                {tender.status !== "go" && (
                  <Button variant="ghost" size="sm" onClick={onReopen}>
                    Remettre en revue
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={onNoGo}>
                  No Go
                </Button>
                <Button size="sm" onClick={onGo}>
                  Go
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
