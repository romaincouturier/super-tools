/**
 * Réglages du filtre de détection, éditables depuis l'écran.
 *
 * Le bruit de la file ne se corrige pas dans le code : il se corrige en
 * retirant un code CPV trop générique ou en ajoutant un mot d'exclusion. Ces
 * listes vivent dans `app_settings` et sont relues à chaque synchronisation,
 * donc une correction ici s'applique dès le lendemain matin, sans déploiement.
 *
 * L'adresse d'arrivée des alertes mail est dans le même panneau : quand elle
 * est vide, un mail de PLACE ou d'AWS reçu sur `inbound.supertilt.fr` est
 * ignoré, et c'est invisible autrement.
 */
import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEditableAppSetting } from "@/hooks/useAppSetting";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";

const FIELDS = [
  {
    key: "tender_cpv_codes",
    label: "Codes CPV surveillés",
    help: "Un code trop générique (organisation d'événements, conception graphique) ramène des avis hors sujet : le retirer d'ici suffit.",
  },
  {
    key: "tender_keywords",
    label: "Mots-clés dans l'objet",
    help: "Un avis est retenu si un mot-clé apparaît, même sans code CPV surveillé.",
  },
  {
    key: "tender_exclusions",
    label: "Mots d'exclusion",
    help: "L'exclusion gagne toujours : un avis qui contient l'un de ces mots n'entre pas dans la file.",
  },
] as const;

function ListField({ setting }: { setting: (typeof FIELDS)[number] }) {
  const { data, isLoading, save } = useEditableAppSetting(setting.key);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading) setValue(data ?? "");
  }, [data, isLoading]);

  const dirty = value !== (data ?? "");

  return (
    <div>
      <Label htmlFor={setting.key}>{setting.label}</Label>
      <Textarea
        id={setting.key}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        className="mt-1 font-mono text-xs"
        placeholder="valeurs séparées par des virgules"
      />
      <div className="flex items-center justify-between gap-3 mt-1.5">
        <p className="text-xs text-muted-foreground">{setting.help}</p>
        <Button
          size="sm"
          variant="outline"
          disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await save(value.trim());
              toast({ title: "Filtre mis à jour" });
            } catch (e) {
              toastError(toast, e);
            } finally {
              setSaving(false);
            }
          }}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

function InboundField() {
  const { data, isLoading, save } = useEditableAppSetting("tender_inbound_email");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading) setValue(data ?? "");
  }, [data, isLoading]);

  const dirty = value !== (data ?? "");

  return (
    <div>
      <Label htmlFor="tender_inbound_email">Adresse d'arrivée des alertes mail</Label>
      <div className="flex gap-2 mt-1">
        <Input
          id="tender_inbound_email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="@inbound.supertilt.fr"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await save(value.trim());
              toast({ title: "Routage mail mis à jour" });
            } catch (e) {
              toastError(toast, e);
            } finally {
              setSaving(false);
            }
          }}
        >
          Enregistrer
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        Un sous-domaine entier (<code>@inbound.supertilt.fr</code>) ou une adresse exacte. La
        partie gauche de l'adresse devient la source de l'avis : un mail reçu sur{" "}
        <code>place@inbound.supertilt.fr</code> arrive avec la source « PLACE », sur{" "}
        <code>aws@…</code> avec « AWS », et la même déduplication s'applique qu'avec le BOAMP.
        Ajouter une source demain, c'est une règle de transfert de plus, pas une ligne de code.
      </p>
      {!isLoading && !(data ?? "").trim() && (
        <p className="text-xs text-destructive mt-1">
          Vide : aucune alerte mail n'est routée vers ce module pour l'instant.
        </p>
      )}
    </div>
  );
}

export function TenderFilterSettings() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-3.5 w-3.5 mr-1.5" />
          Réglages du filtre
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4 rounded-lg border p-4">
        {FIELDS.map((f) => (
          <ListField key={f.key} setting={f} />
        ))}
        <InboundField />
      </CollapsibleContent>
    </Collapsible>
  );
}
