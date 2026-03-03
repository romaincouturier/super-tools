import { ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface EventFormValues {
  title: string;
  description: string;
  eventDate: string;
  eventTime: string;
  location: string;
  locationType: "physical" | "visio";
  eventType: "internal" | "external";
  cfpDeadline: string;
  eventUrl: string;
  cfpUrl: string;
}

interface EventFormFieldsProps {
  values: EventFormValues;
  onChange: <K extends keyof EventFormValues>(field: K, value: EventFormValues[K]) => void;
}

const EventFormFields = ({ values, onChange }: EventFormFieldsProps) => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">
          Nom de l'événement <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          value={values.title}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="Ex: Conférence IA et Formation"
        />
      </div>

      <div className="space-y-2">
        <Label>Type d'événement</Label>
        <RadioGroup
          value={values.eventType}
          onValueChange={(v) => onChange("eventType", v as "internal" | "external")}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="internal" id="internal" />
            <Label htmlFor="internal" className="cursor-pointer">Interne</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="external" id="external" />
            <Label htmlFor="external" className="cursor-pointer">Externe</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={values.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Description de l'événement…"
          rows={4}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="eventDate">
            Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="eventDate"
            type="date"
            value={values.eventDate}
            onChange={(e) => onChange("eventDate", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="eventTime">Heure</Label>
          <Input
            id="eventTime"
            type="time"
            value={values.eventTime}
            onChange={(e) => onChange("eventTime", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Type de lieu</Label>
        <RadioGroup
          value={values.locationType}
          onValueChange={(v) => onChange("locationType", v as "physical" | "visio")}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="physical" id="physical" />
            <Label htmlFor="physical" className="cursor-pointer">Adresse physique</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="visio" id="visio" />
            <Label htmlFor="visio" className="cursor-pointer">Visioconférence</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">
          {values.locationType === "physical" ? "Adresse" : "Lien de visioconférence"}
        </Label>
        <Input
          id="location"
          value={values.location}
          onChange={(e) => onChange("location", e.target.value)}
          placeholder={
            values.locationType === "physical"
              ? "Ex: 10 rue de la Paix, 75002 Paris"
              : "Ex: https://meet.google.com/abc-defg-hij"
          }
        />
      </div>

      {values.eventType === "external" && (
        <div className="space-y-4 p-4 rounded-lg border border-blue-200 bg-blue-50/50">
          <p className="text-sm font-medium text-blue-700 flex items-center gap-1">
            <ExternalLink className="h-4 w-4" />
            Informations événement externe
          </p>
          <div className="space-y-2">
            <Label htmlFor="eventUrl">Lien vers l'événement</Label>
            <Input
              id="eventUrl"
              value={values.eventUrl}
              onChange={(e) => onChange("eventUrl", e.target.value)}
              placeholder="https://www.conference-example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cfpUrl">Lien vers le CFP</Label>
              <Input
                id="cfpUrl"
                value={values.cfpUrl}
                onChange={(e) => onChange("cfpUrl", e.target.value)}
                placeholder="https://www.conference-example.com/cfp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfpDeadline">Date limite CFP</Label>
              <Input
                id="cfpDeadline"
                type="date"
                value={values.cfpDeadline}
                onChange={(e) => onChange("cfpDeadline", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventFormFields;
