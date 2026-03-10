import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Search, Building2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useSirenLookup } from "@/hooks/useQuotes";
import type { CrmCard } from "@/types/crm";

export interface ClientData {
  company: string;
  address: string;
  zip: string;
  city: string;
  siren: string;
  vatNumber: string;
  email: string;
}

interface Props {
  crmCard: CrmCard;
  onValidate: (client: ClientData) => void;
  initialClient?: ClientData | null;
}

export default function Step0ClientValidation({ crmCard, onValidate, initialClient }: Props) {
  const sirenLookup = useSirenLookup();
  const [siren, setSiren] = useState(initialClient?.siren || crmCard.company || "");
  const [client, setClient] = useState<ClientData>(
    initialClient || {
      company: crmCard.company || "",
      address: "",
      zip: "",
      city: "",
      siren: "",
      vatNumber: "",
      email: crmCard.email || "",
    }
  );
  const [sirenLoaded, setSirenLoaded] = useState(!!initialClient?.siren);

  const set = (key: keyof ClientData, value: string) =>
    setClient((prev) => ({ ...prev, [key]: value }));

  const handleLookup = async () => {
    try {
      const result = await sirenLookup.mutateAsync(siren);
      setClient({
        company: result.denomination,
        address: result.address,
        zip: result.zip,
        city: result.city,
        siren: result.siren,
        vatNumber: result.vatNumber,
        email: crmCard.email || "",
      });
      setSirenLoaded(true);
    } catch {
      // Error is in sirenLookup.error
    }
  };

  const isValid =
    client.company.trim() !== "" &&
    client.address.trim() !== "" &&
    client.zip.trim() !== "" &&
    client.city.trim() !== "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Validation et enrichissement du client
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* SIREN lookup */}
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label>N° SIREN</Label>
              <Input
                value={siren}
                onChange={(e) => setSiren(e.target.value)}
                placeholder="123 456 789"
                maxLength={11}
              />
            </div>
            <Button
              onClick={handleLookup}
              disabled={sirenLookup.isPending || siren.replace(/\s/g, "").length < 9}
              variant="outline"
              className="gap-2"
            >
              {sirenLookup.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Rechercher
            </Button>
          </div>

          {sirenLookup.isError && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                {(sirenLookup.error as Error).message ||
                  "Impossible de trouver ce SIREN. Vous pouvez saisir les informations manuellement."}
              </AlertDescription>
            </Alert>
          )}

          {sirenLoaded && (
            <Alert>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription>
                Données récupérées depuis l'API INSEE. Vérifiez et corrigez si nécessaire.
              </AlertDescription>
            </Alert>
          )}

          {/* Editable client fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Raison sociale *</Label>
              <Input
                value={client.company}
                onChange={(e) => set("company", e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Adresse *</Label>
              <Input
                value={client.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Code postal *</Label>
              <Input
                value={client.zip}
                onChange={(e) => set("zip", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ville *</Label>
              <Input
                value={client.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>N° TVA intracommunautaire</Label>
              <Input
                value={client.vatNumber}
                onChange={(e) => set("vatNumber", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={client.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => onValidate(client)} disabled={!isValid} size="lg">
          Valider le client et continuer
        </Button>
      </div>
    </div>
  );
}
