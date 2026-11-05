import { Link } from "react-router-dom";
import { ExternalLink, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNetworkInteractions } from "@/hooks/useReseauInteractions";
import { useNetworkContactTranscripts } from "@/hooks/useNetworkTranscripts";
import { WARMTH_LABELS, type NetworkContact } from "@/types/reseau";

const INTERACTION_LABELS: Record<string, string> = {
  meeting: "Réunion",
  manual_log: "Contact noté",
  linkedin_message: "Message LinkedIn",
  email: "Email",
  phone_call: "Appel",
  coffee_invite: "Café",
  share_content: "Partage de contenu",
  other: "Autre",
};

export default function NetworkContactSheet({ contact, onClose }: { contact: NetworkContact; onClose: () => void }) {
  const { data: transcripts = [], isLoading } = useNetworkContactTranscripts(contact.id);
  const { data: interactions = [] } = useNetworkInteractions();
  const mine = interactions.filter((i) => i.contact_id === contact.id);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-left">{contact.name}</SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            {WARMTH_LABELS[contact.warmth]}
            {contact.context ? ` · ${contact.context}` : ""}
            {contact.last_contact_date ? ` · Dernier contact : ${new Date(contact.last_contact_date).toLocaleDateString("fr-FR")}` : ""}
          </p>
          {contact.linkedin_url && (
            <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
              LinkedIn <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </SheetHeader>
        <ScrollArea className="flex-1 mt-4 pr-3">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcripts liés ({transcripts.length})</h3>
            {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
            {!isLoading && transcripts.length === 0 && <p className="text-sm text-muted-foreground">Aucun transcript rattaché.</p>}
            {transcripts.map((l) => (
              <Link
                key={l.id}
                to={`/supertilt-fr/transcripts?transcript=${l.transcript_id}`}
                className="block rounded border p-3 hover:bg-muted"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{l.transcript?.ai_title || l.transcript?.title || "Transcript"}</span>
                </div>
                {l.transcript?.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{l.transcript.summary}</p>}
              </Link>
            ))}
          </section>
          <section className="space-y-2 mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interactions ({mine.length})</h3>
            {mine.length === 0 && <p className="text-sm text-muted-foreground">Aucune interaction.</p>}
            {mine.map((i) => (
              <div key={i.id} className="rounded border p-3">
                <p className="text-xs text-muted-foreground">
                  {INTERACTION_LABELS[i.interaction_type] ?? i.interaction_type} · {new Date(i.created_at).toLocaleDateString("fr-FR")}
                </p>
                {i.notes && <p className="text-sm whitespace-pre-line mt-1 line-clamp-6">{i.notes}</p>}
              </div>
            ))}
          </section>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
