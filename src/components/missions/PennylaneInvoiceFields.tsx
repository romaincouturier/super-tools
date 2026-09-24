import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { demoBlur } from "@/lib/demoMask";

/** Fiche client envoyée à Pennylane : retrouvée par email, sinon créée. */
export interface PennylaneCustomerDraft {
  type: "company";
  name: string;
  email: string;
  address: string;
  postal_code: string;
  city: string;
  country: string;
  reg_no: string;
}

export const VAT_OPTIONS = [
  { value: "FR_200", label: "TVA 20 %" },
  { value: "exempt", label: "Exonéré (formation, art. 261-4-4 CGI)" },
  { value: "FR_100", label: "TVA 10 %" },
  { value: "FR_055", label: "TVA 5,5 %" },
] as const;

interface Props {
  customer: PennylaneCustomerDraft | null;
  loading: boolean;
  source: "crm" | "mission" | null;
  /** Remplace l'origine CRM / mission quand la fiche vient d'ailleurs. */
  sourceNote?: string;
  onCustomerChange: (customer: PennylaneCustomerDraft) => void;
  vatRate: string;
  onVatRateChange: (value: string) => void;
}

const FIELDS: Array<{ key: keyof PennylaneCustomerDraft; label: string; span?: boolean }> = [
  { key: "name", label: "Raison sociale *", span: true },
  { key: "email", label: "Email de facturation *" },
  { key: "reg_no", label: "SIREN" },
  { key: "address", label: "Adresse *", span: true },
  { key: "postal_code", label: "Code postal *" },
  { key: "city", label: "Ville *" },
];

export default function PennylaneInvoiceFields({
  customer,
  loading,
  source,
  sourceNote,
  onCustomerChange,
  vatRate,
  onVatRateChange,
}: Props) {
  const { isDemoMode } = useDemoMode();

  if (loading || !customer) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Spinner /> Recherche de la fiche client…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Client</p>
        <p className="text-xs text-muted-foreground">
          {sourceNote ?? (source === "crm" ? "Repris de l'opportunité CRM liée à la mission." : "Aucune opportunité CRM liée : repris de la mission, à compléter.")}{" "}
          La fiche Pennylane portant cet email est réutilisée telle quelle ; sinon elle est créée.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3" style={demoBlur(isDemoMode)}>
        {FIELDS.map((f) => (
          <div key={f.key} className={f.span ? "col-span-2" : undefined}>
            <Label htmlFor={`pl-${f.key}`}>{f.label}</Label>
            <Input
              id={`pl-${f.key}`}
              value={customer[f.key] /* demo-safe: champ de saisie, conteneur flouté */}
              onChange={(e) => onCustomerChange({ ...customer, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="max-w-xs">
        <Label>TVA</Label>
        <Select value={vatRate} onValueChange={onVatRateChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VAT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
