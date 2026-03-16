import { Settings, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormationDate } from "@/types/formations";
import FormationDateManager from "@/components/formations/FormationDateManager";

export interface DateManagerActions {
  editingDate: FormationDate | null;
  setEditingDate: (d: FormationDate | null) => void;
  newDate: Partial<FormationDate> | null;
  setNewDate: (d: Partial<FormationDate> | null) => void;
  onAdd: () => Promise<void>;
  onSetDefault: (d: FormationDate) => Promise<void>;
  onDelete: (d: FormationDate) => Promise<void>;
  onSave: () => Promise<void>;
}

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
  formatFormation,
  dateFormation,
  setDateFormation,
  dateFormationLibre,
  setDateFormationLibre,
  formationDates,
  loadingDates,
  datesDialogOpen,
  setDatesDialogOpen,
  dateManagerActions,
}: FormationDatesSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Dates de la formation *</Label>
        {formatFormation === "inter" && (
          <Dialog open={datesDialogOpen} onOpenChange={setDatesDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2">
                <Settings className="w-3 h-3 mr-1" />
                Gérer
              </Button>
            </DialogTrigger>
            <FormationDateManager
              formationDates={formationDates}
              loadingDates={loadingDates}
              editingDate={dateManagerActions.editingDate}
              setEditingDate={dateManagerActions.setEditingDate}
              newDate={dateManagerActions.newDate}
              setNewDate={dateManagerActions.setNewDate}
              onAdd={dateManagerActions.onAdd}
              onSetDefault={dateManagerActions.onSetDefault}
              onDelete={dateManagerActions.onDelete}
              onSave={dateManagerActions.onSave}
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
                {formationDates.map((dateConfig) => (
                  <SelectItem key={dateConfig.id} value={dateConfig.date_label}>
                    <div className="flex items-center gap-2">
                      {dateConfig.is_default && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                      <span>{dateConfig.date_label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="dateFormation"
              placeholder="Ex: 15 et 16 janvier 2026, ou Du 10 au 14 mars 2026"
              value={dateFormation}
              onChange={(e) => setDateFormation(e.target.value)}
              required
            />
          )}
          <p className="text-xs text-muted-foreground">
            {formationDates.length > 0
              ? "Sélectionnez une date ou gérez les dates disponibles"
              : "Saisissez les dates au format souhaité (ex: \"26 et 27 janvier 2026\")"
            }
          </p>
        </>
      )}

      {formatFormation === "intra" && (
        <>
          <Input
            id="dateFormationLibre"
            placeholder="Ex: 15 et 16 janvier 2026, ou Du 10 au 14 mars 2026, ou À définir"
            value={dateFormationLibre}
            onChange={(e) => setDateFormationLibre(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Saisissez les dates souhaitées ou "À définir" si pas encore fixées
          </p>
        </>
      )}
    </div>
  );
}
