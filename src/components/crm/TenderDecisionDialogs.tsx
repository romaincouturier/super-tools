/**
 * Les deux décisions possibles sur un appel d'offres.
 *
 * Le No Go est le cas normal, à 98 % : il doit se prendre en trois secondes,
 * mais toujours avec un motif, seule donnée qui permettra d'affiner le filtre.
 * Le Go est l'exception : il demande deux informations que l'avis ne porte pas,
 * le type de prestation et la valeur estimée.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tenderNoGoReasonConfig, type TenderOpportunity } from "@/types/tenders";
import type { ServiceType } from "@/types/crm";

interface NoGoDialogProps {
  tender: TenderOpportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, detail: string) => void;
  pending?: boolean;
}

export function TenderNoGoDialog({
  tender,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: NoGoDialogProps) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");

  const close = () => {
    setReason("");
    setDetail("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Écarter cet appel d'offres</DialogTitle>
          <DialogDescription className="line-clamp-2">{tender?.objet}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="flex items-center gap-1">
              Motif <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pourquoi on n'y va pas..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(tenderNoGoReasonConfig).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1.5">
              Les motifs accumulés servent à resserrer le filtrage : c'est la seule raison de
              conserver les avis écartés.
            </p>
          </div>

          <div>
            <Label htmlFor="no-go-detail">Précision (facultatif)</Label>
            <Textarea
              id="no-go-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            disabled={!reason || pending}
            onClick={() => {
              onConfirm(reason, detail);
              close();
            }}
          >
            Écarter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface GoDialogProps {
  tender: TenderOpportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (serviceType: ServiceType, estimatedValue: number) => void;
  pending?: boolean;
}

export function TenderGoDialog({ tender, open, onOpenChange, onConfirm, pending }: GoDialogProps) {
  const [serviceType, setServiceType] = useState<ServiceType | "">("");
  const [value, setValue] = useState("");

  // Le montant annoncé dans l'avis est un plafond d'accord-cadre, pas un
  // chiffre d'affaires attendu : il est proposé, jamais imposé.
  const suggested = tender?.decision?.montant ?? null;

  const close = () => {
    setServiceType("");
    setValue("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer l'opportunité dans le CRM</DialogTitle>
          <DialogDescription className="line-clamp-2">{tender?.objet}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="flex items-center gap-1">
              Type <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2 mt-1">
              {(["formation", "mission"] as ServiceType[]).map((t) => (
                <Badge
                  key={t}
                  variant={serviceType === t ? "default" : "outline"}
                  className="cursor-pointer capitalize"
                  onClick={() => setServiceType(t)}
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="tender-value">Valeur estimée (€)</Label>
            <Input
              id="tender-value"
              type="number"
              min="0"
              step="500"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={suggested ? String(Math.round(suggested)) : "Ex : 15000"}
              className="mt-1"
            />
            {suggested !== null && (
              <p className="text-xs text-muted-foreground mt-1.5">
                L'avis annonce {suggested.toLocaleString("fr-FR")} €. C'est en général le plafond
                du marché ou de l'accord-cadre, pas ce que la mission rapporterait.
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            La carte est créée dans la première colonne du kanban, avec le tag « Marché public »,
            la date limite en date de clôture prévue, et « Retirer le DCE et décider de candidater »
            comme prochaine action.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Annuler
          </Button>
          <Button
            disabled={!serviceType || pending}
            onClick={() => {
              onConfirm(serviceType as ServiceType, Number(value) || 0);
              close();
            }}
          >
            Créer la carte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
