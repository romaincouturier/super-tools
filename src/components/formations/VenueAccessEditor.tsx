import { useEffect, useState } from "react";
import { useUpdateVenueAccess } from "@/hooks/useTrainingVenues";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TrainingVenue } from "@/types/training-venue";

export default function VenueAccessEditor({ venue }: { venue: TrainingVenue }) {
  const [text, setText] = useState(venue.access_instructions || "");
  const update = useUpdateVenueAccess();
  useEffect(() => setText(venue.access_instructions || ""), [venue.id, venue.access_instructions]);
  return <div className="space-y-2">
    <Label htmlFor={`venue-access-${venue.id}`}>Instructions d’accès du lieu</Label>
    <Textarea id={`venue-access-${venue.id}`} value={text} onChange={e => setText(e.target.value)} placeholder="Digicode, étage, interphone, transports, contact sur place…" />
    <Button type="button" size="sm" variant="outline" className="h-auto min-h-9 max-w-full whitespace-normal text-left py-2" disabled={update.isPending || text === (venue.access_instructions || "")} onClick={() => update.mutate({ id: venue.id, instructions: text })}>Enregistrer pour toutes les sessions de ce lieu</Button>
    {update.isSuccess && <p className="text-sm text-muted-foreground">Instructions du lieu enregistrées.</p>}
    {update.isError && <p className="text-sm text-destructive">Impossible d’enregistrer les instructions.</p>}
  </div>;
}