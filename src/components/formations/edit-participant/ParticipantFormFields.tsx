import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag, UserCheck } from "lucide-react";
import type { FormationFormula } from "@/types/training";

interface ParticipantFormFieldsProps {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  company: string;
  setCompany: (v: string) => void;
  isInterEntreprise: boolean;
  soldPriceHt: string;
  setSoldPriceHt: (v: string) => void;
  formula: string;
  setFormula: (v: string) => void;
  availableFormulas: FormationFormula[];
  formatFormation?: string | null;
  elearningDuration: string;
  setElearningDuration: (v: string) => void;
  trainingElearningDuration?: number | null;
  couponCode: string | null;
  formulaAllowsCoaching: boolean;
  coachingSessionsTotal: string;
  setCoachingSessionsTotal: (v: string) => void;
  selectedFormula?: FormationFormula;
  coachingSessionsCompleted: number;
  coachingDeadline?: string | null;
}

const ParticipantFormFields = ({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  company,
  setCompany,
  isInterEntreprise,
  soldPriceHt,
  setSoldPriceHt,
  formula,
  setFormula,
  availableFormulas,
  formatFormation,
  elearningDuration,
  setElearningDuration,
  trainingElearningDuration,
  couponCode,
  formulaAllowsCoaching,
  coachingSessionsTotal,
  setCoachingSessionsTotal,
  selectedFormula,
  coachingSessionsCompleted,
  coachingDeadline,
}: ParticipantFormFieldsProps) => {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-firstName">Prénom</Label>
          <Input
            id="edit-firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jean"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-lastName">Nom</Label>
          <Input
            id="edit-lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Dupont"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-email">Email *</Label>
        <Input
          id="edit-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jean.dupont@example.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-company">Société</Label>
        <Input
          id="edit-company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="ACME Corp"
        />
      </div>

      {isInterEntreprise && (
        <>
          <div className="space-y-2">
            <Label htmlFor="edit-soldPriceHt">Montant vendu HT (€)</Label>
            <Input
              id="edit-soldPriceHt"
              type="number"
              step="0.01"
              min="0"
              value={soldPriceHt}
              onChange={(e) => setSoldPriceHt(e.target.value)}
              placeholder="1500.00"
            />
          </div>

          {availableFormulas.length > 0 && (
            <div className="space-y-2">
              <Label>Formule</Label>
              <Select value={formula} onValueChange={setFormula}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucune formule" />
                </SelectTrigger>
                <SelectContent>
                  {availableFormulas.map((f) => (
                    <SelectItem key={f.id} value={f.name}>
                      {f.name}
                      {(f.prix != null || f.duree_heures != null) && (
                        <span className="text-muted-foreground">
                          {" — "}
                          {f.prix != null ? `${f.prix}€` : ""}
                          {f.prix != null && f.duree_heures != null ? " · " : ""}
                          {f.duree_heures != null ? `${f.duree_heures}h` : ""}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formatFormation === "e_learning" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-elearningDuration">
                  Durée e-learning (heures)
                </Label>
                <Input
                  id="edit-elearningDuration"
                  type="number"
                  step="0.5"
                  min="0"
                  value={elearningDuration}
                  onChange={(e) => setElearningDuration(e.target.value)}
                  placeholder={
                    trainingElearningDuration != null
                      ? String(trainingElearningDuration)
                      : "7"
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Par défaut : {trainingElearningDuration ?? 7}h (durée de la
                  formation)
                </p>
              </div>

              {couponCode && (
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <Tag className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Coupon WooCommerce
                    </p>
                    <p className="text-sm font-mono font-bold text-green-700 dark:text-green-300">
                      {couponCode}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Coaching sessions */}
          {formulaAllowsCoaching && (
            <>
              <div className="pt-4 border-t">
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <UserCheck className="h-4 w-4" />
                  Séances de coaching individuel
                </Label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="0"
                    value={coachingSessionsTotal}
                    onChange={(e) => setCoachingSessionsTotal(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    séance(s) — {coachingSessionsCompleted || 0} réalisée(s)
                  </span>
                </div>
                {coachingDeadline && (
                  <p className="text-xs text-muted-foreground">
                    Validité : jusqu'au{" "}
                    {new Date(coachingDeadline).toLocaleDateString("fr-FR")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Par défaut : {selectedFormula?.coaching_sessions_count || 0}{" "}
                  séance(s) (formule {selectedFormula?.name})
                </p>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
};

export default ParticipantFormFields;
