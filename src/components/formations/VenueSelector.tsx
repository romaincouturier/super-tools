import { useState } from "react";
import { MapPin, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTrainingVenues, useCreateTrainingVenue } from "@/hooks/useTrainingVenues";
import type { TrainingVenue } from "@/types/training-venue";

interface VenueSelectorProps {
  value: string | null;
  onChange: (venueId: string | null, venue: TrainingVenue | null) => void;
}

const EMPTY_FORM = {
  name: "",
  address: "",
  postal_code: "",
  city: "",
  email: "",
  room_name: "",
  formal_address: true,
};

export default function VenueSelector({ value, onChange }: VenueSelectorProps) {
  const { data: venues = [], isLoading } = useTrainingVenues();
  const createVenue = useCreateTrainingVenue();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const handleSelectChange = (val: string) => {
    if (val === "__new__") {
      setShowForm(true);
      return;
    }
    const venue = venues.find((v) => v.id === val) ?? null;
    onChange(venue?.id ?? null, venue);
  };

  const handleCreate = async () => {
    if (!form.name || !form.address || !form.postal_code || !form.city || !form.email) return;
    try {
      const created = await createVenue.mutateAsync({
        name: form.name.trim(),
        address: form.address.trim(),
        postal_code: form.postal_code.trim(),
        city: form.city.trim(),
        email: form.email.trim(),
        room_name: form.room_name.trim() || null,
        formal_address: form.formal_address,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      onChange(created.id, created);
    } catch {
      // error handled by caller
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select
          value={value ?? ""}
          onValueChange={handleSelectChange}
          disabled={isLoading}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={isLoading ? "Chargement…" : "Sélectionner un lieu…"} />
          </SelectTrigger>
          <SelectContent>
            {venues.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                <span className="font-medium">{v.name}</span>
                {v.room_name && <span className="text-muted-foreground ml-1">— {v.room_name}</span>}
                <span className="text-muted-foreground ml-1 text-xs">({v.city})</span>
              </SelectItem>
            ))}
            <SelectItem value="__new__">
              <span className="flex items-center gap-1.5 text-primary">
                <Plus className="h-3.5 w-3.5" />
                Ajouter un nouveau lieu…
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value && !showForm && (() => {
        const venue = venues.find((v) => v.id === value);
        if (!venue) return null;
        return (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2 space-y-0.5">
            <div>{venue.address}, {venue.postal_code} {venue.city}</div>
            {venue.room_name && <div>Salle : {venue.room_name}</div>}
            <div>Contact : {venue.email}</div>
          </div>
        );
      })()}

      {showForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
          <p className="text-sm font-medium">Nouveau lieu</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nom du lieu *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Espace Lumière"
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail de contact *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="reservation@lieu.fr"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Adresse *</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="12 rue de la Paix"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Code postal *</Label>
              <Input
                value={form.postal_code}
                onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                placeholder="75001"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ville *</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Paris"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nom de la salle (optionnel)</Label>
              <Input
                value={form.room_name}
                onChange={(e) => setForm((f) => ({ ...f, room_name: e.target.value }))}
                placeholder="Ex: Salle Horizon"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="venue-formal"
              checked={form.formal_address}
              onCheckedChange={(v) => setForm((f) => ({ ...f, formal_address: v }))}
            />
            <Label htmlFor="venue-formal" className="cursor-pointer">
              Vouvoiement dans les e-mails
            </Label>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={
                createVenue.isPending ||
                !form.name || !form.address || !form.postal_code || !form.city || !form.email
              }
            >
              {createVenue.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Créer le lieu
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
