import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ClientInfoSectionProps {
  siren: string;
  setSiren: (v: string) => void;
  searchingSiren: boolean;
  onSearchSiren: () => void;
  nomClient: string;
  setNomClient: (v: string) => void;
  searchingSirenByName: boolean;
  onSearchSirenByName: () => void;
  adresseClient: string;
  setAdresseClient: (v: string) => void;
  codePostalClient: string;
  setCodePostalClient: (v: string) => void;
  villeClient: string;
  setVilleClient: (v: string) => void;
  pays: string;
  setPays: (v: string) => void;
  paysAutre: string;
  setPaysAutre: (v: string) => void;
  emailCommanditaire: string;
  setEmailCommanditaire: (v: string) => void;
  civiliteCommanditaire: "M." | "Mme" | "";
  setCiviliteCommanditaire: (v: "M." | "Mme" | "") => void;
  nomCommanditaire: string;
  setNomCommanditaire: (v: string) => void;
}

export default function ClientInfoSection({
  siren,
  setSiren,
  searchingSiren,
  onSearchSiren,
  nomClient,
  setNomClient,
  searchingSirenByName,
  onSearchSirenByName,
  adresseClient,
  setAdresseClient,
  codePostalClient,
  setCodePostalClient,
  villeClient,
  setVilleClient,
  pays,
  setPays,
  paysAutre,
  setPaysAutre,
  emailCommanditaire,
  setEmailCommanditaire,
  adresseCommanditaire,
  setAdresseCommanditaire,
}: ClientInfoSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">Informations client</h3>

      {/* SIREN search */}
      <div className="flex gap-2 items-end p-3 bg-muted/50 rounded-lg border">
        <div className="flex-1 space-y-2">
          <Label htmlFor="siren" className="text-sm">
            Rechercher par SIREN
            <span className="text-muted-foreground font-normal ml-1">(9 chiffres)</span>
          </Label>
          <Input
            id="siren"
            placeholder="123456789"
            value={siren}
            onChange={(e) => setSiren(e.target.value.replace(/\D/g, "").slice(0, 9))}
            className="font-mono"
          />
        </div>
        <Button type="button" variant="secondary" onClick={onSearchSiren} disabled={searchingSiren || siren.length !== 9}>
          {searchingSiren ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="ml-2">Rechercher</span>
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nomClient">Nom du client *</Label>
        <div className="flex gap-2">
          <Input id="nomClient" placeholder="Nom de l'entreprise ou du client" value={nomClient} onChange={(e) => setNomClient(e.target.value)} required className="flex-1" />
          <Button type="button" variant="outline" size="sm" onClick={onSearchSirenByName} disabled={searchingSirenByName || nomClient.trim().length < 2} className="whitespace-nowrap">
            {searchingSirenByName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="ml-2">Chercher Siren</span>
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="adresseClient">Adresse du client *</Label>
        <Input id="adresseClient" placeholder="Numéro et nom de rue" value={adresseClient} onChange={(e) => setAdresseClient(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="codePostalClient">Code postal *</Label>
          <Input id="codePostalClient" placeholder="69000" value={codePostalClient} onChange={(e) => setCodePostalClient(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="villeClient">Ville *</Label>
          <Input id="villeClient" placeholder="Lyon" value={villeClient} onChange={(e) => setVilleClient(e.target.value)} required />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Pays *</Label>
          <RadioGroup value={pays} onValueChange={setPays} className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="france" id="pays-france" />
              <Label htmlFor="pays-france" className="font-normal cursor-pointer">France</Label>
            </div>
            <div className="flex items-center space-x-2 flex-1">
              <RadioGroupItem value="autre" id="pays-autre" />
              <Label htmlFor="pays-autre" className="font-normal cursor-pointer">Autre :</Label>
              <Input
                placeholder="Pays"
                value={paysAutre}
                onChange={(e) => { setPaysAutre(e.target.value); if (e.target.value) setPays("autre"); }}
                className="flex-1"
                disabled={pays !== "autre"}
              />
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="emailCommanditaire">Email du commanditaire *</Label>
          <Input id="emailCommanditaire" type="email" placeholder="email@exemple.com" value={emailCommanditaire} onChange={(e) => setEmailCommanditaire(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adresseCommanditaire">
            Comment s'adresser au commanditaire *
            <span className="text-muted-foreground font-normal text-sm ml-1">(Ex : Mme Poilvert)</span>
          </Label>
          <Input id="adresseCommanditaire" placeholder="Mme Dupont" value={adresseCommanditaire} onChange={(e) => setAdresseCommanditaire(e.target.value)} required />
        </div>
      </div>
    </div>
  );
}
