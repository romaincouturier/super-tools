import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { FormationFormHook, PREDEFINED_LOCATIONS } from "@/hooks/useFormationForm";

// --- Session Type / Format Selector ---

export function SessionTypeFormatSelector({
  form,
  onFormatChange,
}: {
  form: FormationFormHook;
  onFormatChange?: (val: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Type de session</Label>
        <Select value={form.sessionType} onValueChange={form.setSessionType}>
          <SelectTrigger>
            <SelectValue placeholder="Intra ou inter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="intra">Intra-entreprise</SelectItem>
            <SelectItem value="inter">Inter-entreprises</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Format de la session</Label>
        <Select
          value={form.sessionFormat}
          onValueChange={(val) => {
            form.setSessionFormat(val);
            onFormatChange?.(val);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choisir le format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="presentiel">Présentiel</SelectItem>
            <SelectItem value="distanciel_synchrone">Distanciel synchrone (classe virtuelle)</SelectItem>
            <SelectItem value="distanciel_asynchrone">Distanciel asynchrone (e-learning)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// --- E-learning Date Fields ---

export function ElearningDatesFields({
  form,
  showDuration = true,
}: {
  form: FormationFormHook;
  showDuration?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date de début *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !form.elearningStartDate && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {form.elearningStartDate
                  ? format(form.elearningStartDate, "d MMMM yyyy", { locale: fr })
                  : "Sélectionner"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={form.elearningStartDate || undefined}
                onSelect={(date) => form.setElearningStartDate(date || null)}
                initialFocus
                locale={fr}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Date de fin *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !form.elearningEndDate && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {form.elearningEndDate
                  ? format(form.elearningEndDate, "d MMMM yyyy", { locale: fr })
                  : "Sélectionner"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={form.elearningEndDate || undefined}
                onSelect={(date) => form.setElearningEndDate(date || null)}
                initialFocus
                locale={fr}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {showDuration && (
        <div className="space-y-2">
          <Label htmlFor="elearningDuration">Durée totale (heures)</Label>
          <Input
            id="elearningDuration"
            type="number"
            placeholder="Ex: 25"
            value={form.elearningDuration}
            onChange={(e) => form.setElearningDuration(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Durée estimée du parcours e-learning
          </p>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="privateGroupUrl">URL du groupe privé</Label>
        <Input
          id="privateGroupUrl"
          type="url"
          placeholder="https://facebook.com/groups/... ou https://circle.so/..."
          value={form.privateGroupUrl}
          onChange={(e) => form.setPrivateGroupUrl(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Lien vers le groupe privé de la communauté d'apprenants (Facebook, Circle, etc.)
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Le contenu de l'email d'accès e-learning est géré dans{" "}
        <strong>Paramètres → Templates Email</strong>.
      </p>
    </div>
  );
}

// --- Training Days Calendar ---

export function TrainingDaysCalendar({ form }: { form: FormationFormHook }) {
  return (
    <div className="space-y-2">
      <Label>Jours de formation *</Label>
      <Popover open={form.calendarOpen} onOpenChange={form.setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              form.selectedDates.length === 0 && "text-muted-foreground"
            )}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {form.formatSelectedDates()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="multiple"
            selected={form.selectedDates}
            onSelect={(dates) => form.setSelectedDates(dates || [])}
            initialFocus
            className="pointer-events-auto"
            locale={fr}
          />
          <div className="border-t p-3 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {form.selectedDates.length} jour
              {form.selectedDates.length > 1 ? "s" : ""} sélectionné
              {form.selectedDates.length > 1 ? "s" : ""}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => form.setSelectedDates([])}
              disabled={form.selectedDates.length === 0}
            >
              Effacer
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        Cliquez sur plusieurs dates pour les sélectionner (journées contigües ou espacées)
      </p>
    </div>
  );
}

// --- Location Radio Group (Create mode) ---

export function LocationRadioGroup({ form }: { form: FormationFormHook }) {
  return (
    <div className="space-y-3">
      <Label>Lieu de la formation *</Label>
      <RadioGroup
        value={form.locationType}
        onValueChange={form.setLocationType}
        className="space-y-2"
      >
        {PREDEFINED_LOCATIONS.map((loc) => (
          <div key={loc.value} className="flex items-center space-x-2">
            <RadioGroupItem value={loc.value} id={`location-${loc.value}`} />
            <Label
              htmlFor={`location-${loc.value}`}
              className="font-normal cursor-pointer text-sm"
            >
              {loc.value === "chez_client" && form.clientAddress
                ? `Chez le client (${form.clientAddress})`
                : loc.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {form.locationType === "autre" && (
        <Input
          placeholder="Adresse personnalisée"
          value={form.locationCustom}
          onChange={(e) => form.setLocationCustom(e.target.value)}
          className="mt-2"
          required
        />
      )}
    </div>
  );
}

// --- Sponsor Card ---

export function SponsorCard({ form }: { form: FormationFormHook }) {
  if (form.isInter) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Commanditaire</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="formalAddress" className="text-sm text-muted-foreground">
              Tutoiement
            </Label>
            <Switch
              id="formalAddress"
              checked={form.sponsorFormalAddress}
              onCheckedChange={form.setSponsorFormalAddress}
            />
            <Label htmlFor="formalAddress" className="text-sm text-muted-foreground">
              Vouvoiement
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sponsorFirstName">Prénom</Label>
            <Input
              id="sponsorFirstName"
              value={form.sponsorFirstName}
              onChange={(e) => form.setSponsorFirstName(e.target.value)}
              placeholder="Ex: Jean"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sponsorLastName">Nom</Label>
            <Input
              id="sponsorLastName"
              value={form.sponsorLastName}
              onChange={(e) => form.setSponsorLastName(e.target.value)}
              placeholder="Ex: Dupont"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sponsorEmail">Email</Label>
          <Input
            id="sponsorEmail"
            type="email"
            value={form.sponsorEmail}
            onChange={(e) => form.setSponsorEmail(e.target.value)}
            placeholder="jean.dupont@entreprise.fr"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// --- Financeur Card ---

export function FinanceurCard({ form }: { form: FormationFormHook }) {
  if (form.isInter) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financeur</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            id="financeurSameAsSponsor"
            checked={form.financeurSameAsSponsor}
            onCheckedChange={form.setFinanceurSameAsSponsor}
          />
          <Label htmlFor="financeurSameAsSponsor" className="text-sm">
            Identique au commanditaire
          </Label>
        </div>

        {!form.financeurSameAsSponsor && (
          <>
            <div className="space-y-2">
              <Label htmlFor="financeurName">Nom du financeur</Label>
              <Input
                id="financeurName"
                value={form.financeurName}
                onChange={(e) => form.setFinanceurName(e.target.value)}
                placeholder="Ex: OPCO Atlas, France Travail..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="financeurUrl">URL du financeur</Label>
              <Input
                id="financeurUrl"
                type="url"
                value={form.financeurUrl}
                onChange={(e) => form.setFinanceurUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Catalog Summary Card ---

export function CatalogSummaryCard({
  form,
  catalogLink,
  emptyMessage,
}: {
  form: FormationFormHook;
  catalogLink?: React.ReactNode;
  emptyMessage?: string;
}) {
  if (!form.catalogId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="text-sm">
            {emptyMessage ||
              "Sélectionnez une formation du catalogue pour voir les objectifs, prérequis et programme."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Infos du catalogue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {form.programFileUrl && (
          <div>
            <Label className="text-xs text-muted-foreground">Programme</Label>
            <a
              href={form.programFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline block truncate"
            >
              {form.programFileUrl.split("/").pop() || "Voir le programme"}
            </a>
          </div>
        )}
        {form.objectives.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">
              Objectifs ({form.objectives.length})
            </Label>
            <ul className="text-sm list-disc list-inside space-y-0.5">
              {form.objectives.map((o, i) => (
                <li key={i} className="text-muted-foreground">
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}
        {form.prerequisites.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">
              Prérequis ({form.prerequisites.length})
            </Label>
            <ul className="text-sm list-disc list-inside space-y-0.5">
              {form.prerequisites.map((p, i) => (
                <li key={i} className="text-muted-foreground">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        {form.supertiltLink && (
          <div>
            <Label className="text-xs text-muted-foreground">Lien SuperTilt</Label>
            <a
              href={form.supertiltLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline block truncate"
            >
              {form.supertiltLink}
            </a>
          </div>
        )}
        <p className="text-xs text-muted-foreground italic pt-2 border-t">
          Ces informations proviennent du catalogue et sont modifiables depuis la page{" "}
          {catalogLink || "Catalogue"}.
        </p>
      </CardContent>
    </Card>
  );
}
