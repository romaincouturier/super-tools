import { Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FormationDate } from "@/types/formations";
import type { DateManagerActions } from "@/components/formations/formationFormTypes";
import { PERMANENT_SESSION_DATE_LABEL } from "@/lib/formationConstants";

interface FormationDatesSectionProps {
  formatFormation: "intra" | "inter" | "";
  dateFormation: string;
  setDateFormation: (v: string) => void;
  dateFormationLibre: string;
  setDateFormationLibre: (v: string) => void;
  formationDates: FormationDate[];
  loadingDates: boolean;
  datesDialogOpen: boolean;
  setDatesDialogOpen: (v: boolean) => void;
  dateManagerActions: DateManagerActions;
  onSelectInterSession?: (d: FormationDate) => void;
}

export default function FormationDatesSection({
  formatFormation, dateFormation, setDateFormation, dateFormationLibre,
  setDateFormationLibre, formationDates, loadingDates: _loadingDates,
  datesDialogOpen: _datesDialogOpen, setDatesDialogOpen: _setDatesDialogOpen,
  dateManagerActions: _a, onSelectInterSession,
}: FormationDatesSectionProps) {
  const selected = formationDates.find(
    (d) => d.date_label === dateFormation ||
      (d.is_permanent && dateFormation === PERMANENT_SESSION_DATE_LABEL && d.location && true)
  );

  const handleInterChange = (sessionId: string) => {
    const d = formationDates.find((x) => x.id === sessionId);
    if (!d) return;
    const label = d.is_permanent ? PERMANENT_SESSION_DATE_LABEL : d.date_label;
    setDateFormation(label);
    onSelectInterSession?.(d);
  };

  // Try to recover the currently selected session id for the controlled Select
  const currentSessionId = formationDates.find((d) => {
    const label = d.is_permanent ? PERMANENT_SESSION_DATE_LABEL : d.date_label;
    return label === dateFormation;
  })?.id ?? "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Dates de la formation *</Label>
      </div>
      {formatFormation === "inter" && (
        <>
          {formationDates.length > 0 ? (
            <Select value={currentSessionId} onValueChange={handleInterChange}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Sélectionner une session inter-entreprises programmée" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {formationDates.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <div className="flex items-center gap-2">
                      {d.is_default && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                      <span>
                        {d.is_permanent ? "Session permanente (apprenant.e autonome)" : d.date_label}
                        {d.location ? ` — ${d.location}` : ""}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Aucune session inter-entreprises programmée pour le moment.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Seules les sessions inter-entreprises programmées sont proposées. Les dates et le lieu sont repris automatiquement.
          </p>
          {selected?.is_permanent && (
            <p className="text-xs text-primary">
              Session permanente : « {PERMANENT_SESSION_DATE_LABEL} » sera utilisé sur le devis.
            </p>
          )}
        </>
      )}
      {formatFormation === "intra" && (
        <>
          <Input id="dateFormationLibre" placeholder="Ex: 15 et 16 janvier 2026, ou Du 10 au 14 mars 2026, ou À définir" value={dateFormationLibre} onChange={(e) => setDateFormationLibre(e.target.value)} required />
          <p className="text-xs text-muted-foreground">Saisissez les dates souhaitées ou "À définir" si pas encore fixées</p>
        </>
      )}
      {formatFormation === "" && (
        <p className="text-sm text-muted-foreground italic">
          Choisissez d'abord le type de formation (intra ou inter) en haut du formulaire pour voir les dates disponibles.
        </p>
      )}
    </div>
  );
}
