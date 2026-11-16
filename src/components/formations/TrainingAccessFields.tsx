import { useTrainingVenues } from "@/hooks/useTrainingVenues";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import VenueAccessEditor from "./VenueAccessEditor";
import { resolveTrainingAccess } from "../../../supabase/functions/_shared/training-access";

export default function TrainingAccessFields({ value, onChange, venueId, location }: { value: string; onChange: (value: string) => void; venueId: string | null; location: string }) {
  const { data: venues = [] } = useTrainingVenues();
  const inherited = resolveTrainingAccess({ venue_id: venueId, location, session_format: "presentiel" }, venues);
  const legacyMatches = !venueId ? venues.filter(v => [v.name, v.address, [v.postal_code, v.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") === location) : [];
  return <div id="access-instructions" className="space-y-3 scroll-mt-24">
    {legacyMatches.length === 1 && <VenueAccessEditor venue={legacyMatches[0]} />}
    <Label htmlFor="session-access">Instructions d’accès pour cette session</Label>
    <Textarea id="session-access" value={value} onChange={e => onChange(e.target.value)} placeholder={inherited || "Digicode, étage, interphone, transports, contact sur place…"} />
    <p className="text-sm text-muted-foreground">Facultatif : si vide, les instructions du lieu sont reprises.</p>
    {inherited && <p className="text-sm text-muted-foreground whitespace-pre-wrap">Instructions du lieu : {inherited}</p>}
  </div>;
}