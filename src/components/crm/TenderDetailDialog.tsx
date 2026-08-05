/**
 * Contenu complet d'un avis, pour décider sans ouvrir le DCE.
 *
 * La fiche de la liste ne porte que des signaux courts ; ici on montre le texte
 * réel de l'avis (objet intégral, description, lots, lieu, contact) tel qu'il
 * arrive du BOAMP. Rien n'est reformulé : c'est le document qui décide.
 */
import { Building2, CalendarClock, ExternalLink, FileDown, Mail, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { daysLeft, describeMatch, resolveDceLink } from "@/lib/tenders";
import { extractTenderDetail } from "@/lib/tenderDetail";
import { TenderAiPanel } from "@/components/crm/TenderAiPanel";
import { tenderSourceConfig, type TenderWithContext } from "@/types/tenders";

interface Props {
  tender: TenderWithContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGo: () => void;
  onNoGo: () => void;
  decided?: boolean;
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground shrink-0 w-40">{label}</span>
      <span className="min-w-0">{value}</span>
    </div>
  );
}

export function TenderDetailDialog({ tender, open, onOpenChange, onGo, onNoGo, decided }: Props) {
  if (!tender) return null;
  const d = tender.decision ?? {};
  const dce = resolveDceLink(tender);
  const detail = extractTenderDetail(tender.raw);
  const left = daysLeft(tender.datelimitereponse);
  const lots = d.lots?.length ? d.lots : detail.lots;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="leading-snug pr-6">{tender.objet || "(sans objet)"}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Building2 className="h-3.5 w-3.5" />
            {tender.acheteur || "Acheteur non précisé"}
            <Badge variant="secondary" className="text-[10px]">
              {tenderSourceConfig[tender.source] ?? tender.source}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3 -mr-3">
          <div className="space-y-4">
            {!!detail.descripteurs.length && (
              <div className="flex flex-wrap gap-1.5">
                {detail.descripteurs.map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Line
                label="Date limite"
                value={
                  tender.datelimitereponse ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {new Date(tender.datelimitereponse).toLocaleString("fr-FR")}
                      {left !== null && (
                        <span className={left < 0 ? "text-destructive" : "text-muted-foreground"}>
                          {left < 0 ? "(dépassée)" : `(J-${left})`}
                        </span>
                      )}
                    </span>
                  ) : (
                    "non publiée"
                  )
                }
              />
              <Line
                label="Parution"
                value={
                  tender.dateparution
                    ? new Date(tender.dateparution).toLocaleDateString("fr-FR")
                    : null
                }
              />
              <Line label="Procédure" value={detail.procedure ?? tender.type_marche} />
              <Line label="Nature" value={tender.nature} />
              <Line
                label="Lieu"
                value={
                  d.ville || detail.villes[0] ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {d.ville || detail.villes.join(", ")}
                      {tender.code_departement?.length
                        ? ` (${tender.code_departement.join(", ")})`
                        : ""}
                    </span>
                  ) : null
                }
              />
              <Line
                label="Montant annoncé"
                value={d.montant != null ? `${d.montant.toLocaleString("fr-FR")} €` : null}
              />
              <Line
                label="Durée"
                value={
                  d.duree_mois != null
                    ? `${d.duree_mois} mois${d.reconductible ? ", reconductible" : ""}`
                    : null
                }
              />
              <Line
                label="Codes CPV"
                value={tender.cpv_codes?.length ? tender.cpv_codes.join(", ") : null}
              />
              <Line
                label="Retenu sur"
                value={
                  tender.matched_on?.length ? tender.matched_on.map(describeMatch).join(", ") : null
                }
              />
            </div>

            {!!d.criteres?.length && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-1.5">Critères d'attribution</p>
                  <ul className="text-sm text-muted-foreground space-y-0.5">
                    {d.criteres.map((c, i) => (
                      <li key={`${c.libelle}-${i}`}>
                        {c.libelle}
                        {c.poids !== null ? ` — ${c.poids} %` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {!!lots?.length && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-1.5">
                    Lots ({lots.length})
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-0.5">
                    {lots.map((lot, i) => (
                      <li key={i}>{lot}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {!!detail.descriptions.length && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-1.5">Description de l'avis</p>
                  {detail.descriptions.map((text, i) => (
                    <p
                      key={i}
                      className="text-sm text-muted-foreground whitespace-pre-line mb-2 last:mb-0"
                    >
                      {text}
                    </p>
                  ))}
                </div>
              </>
            )}

            {(detail.emails.length > 0 || detail.telephones.length > 0 || d.contact_email) && (
              <>
                <Separator />
                <div className="text-sm text-muted-foreground space-y-1">
                  {[...new Set([d.contact_email, ...detail.emails].filter(Boolean))].map((mail) => (
                    <p key={mail as string} className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {mail}
                    </p>
                  ))}
                  {detail.telephones.map((tel) => (
                    <p key={tel} className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {tel}
                    </p>
                  ))}
                </div>
              </>
            )}

            {!detail.descriptions.length && (
              <p className="text-xs text-muted-foreground">
                Cet avis ne publie pas de description longue : seul le DCE porte le détail des
                prestations.
              </p>
            )}

            <Separator />
            <TenderAiPanel tender={tender} />
          </div>
        </ScrollArea>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            {tender.url_avis && (
              <Button variant="outline" size="sm" asChild>
                <a href={tender.url_avis} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  L'avis
                </a>
              </Button>
            )}
            {dce && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className={cn(
                  dceOpened && "border-primary bg-primary/10 text-primary hover:bg-primary/20",
                )}
              >
                <a
                  href={dce.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={markDceOpened}
                >
                  <FileDown className="h-3.5 w-3.5 mr-1.5" />
                  {dceOpened ? "DCE en cours d'analyse" : dce.label}
                </a>
              </Button>
            )}
          </div>
          {!decided && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onNoGo();
                }}
              >
                No Go
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onGo();
                }}
              >
                Go
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
