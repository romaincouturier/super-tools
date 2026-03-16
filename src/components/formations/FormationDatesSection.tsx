import { Settings, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FormationDate } from "@/types/formations";
import type { DateManagerActions } from "@/components/formations/formationFormTypes";
import FormationDateManager from "@/components/formations/FormationDateManager";

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
}

export default function FormationDatesSection({
  formatFormation, dateFormation, setDateFormation, dateFormationLibre,
  setDateFormationLibre, formationDates, loadingDates, datesDialogOpen,
  setDatesDialogOpen, dateManagerActions: a,
}: FormationDatesSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Dates de la formation *</Label>
        {formatFormation === "inter" && (
          <Dialog open={datesDialogOpen} onOpenChange={setDatesDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2">
                <Settings className="w-3 h-3 mr-1" />Gérer
              </Button>
            </DialogTrigger>
            <FormationDateManager
              formationDates={formationDates} loadingDates={loadingDates}
              editingDate={a.editingDate} setEditingDate={a.setEditingDate}
              newDate={a.newDate} setNewDate={a.setNewDate}
              onAdd={a.onAdd} onSetDefault={a.onSetDefault}
              onDelete={a.onDelete} onSave={a.onSave}
            />
          </Dialog>
        )}
      </div>
      {formatFormation === "inter" && (
        <>
          {formationDates.length > 0 ? (
            <Select value={dateFormation} onValueChange={setDateFormation}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Sélectionner une date" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {formationDates.map((d) => (
                  <SelectItem key={d.id} value={d.date_label}>
                    <div className="flex items-center gap-2">
                      {d.is_default && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                      <span>{d.date_label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input id="dateFormation" placeholder="Ex: 15 et 16 janvier 2026, ou Du 10 au 14 mars 2026" value={dateFormation} onChange={(e) => setDateFormation(e.target.value)} required />
          )}
          <p className="text-xs text-muted-foreground">
            {formationDates.length > 0 ? "Sélectionnez une date ou gérez les dates disponibles" : "Saisissez les dates au format souhaité (ex: \"26 et 27 janvier 2026\")"}
          </p>
        </>
      )}
      {formatFormation === "intra" && (
        <>
          <Input id="dateFormationLibre" placeholder="Ex: 15 et 16 janvier 2026, ou Du 10 au 14 mars 2026, ou À définir" value={dateFormationLibre} onChange={(e) => setDateFormationLibre(e.target.value)} required />
          <p className="text-xs text-muted-foreground">Saisissez les dates souhaitées ou "À définir" si pas encore fixées</p>
        </>
      )}
    </div>
  );
}
