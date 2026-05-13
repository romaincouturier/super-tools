import { useState } from "react";
import { Star, CheckCircle2, XCircle, Clock, Loader2, RefreshCw } from "lucide-react";
import { PollingIndicator } from "@/components/shared/PollingIndicator";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  useTestimonials,
  useTestimonialCounts,
  useUpdateTestimonial,
  type Testimonial,
  type TestimonialStatus,
} from "@/hooks/useTestimonials";

function StatusBadge({ status }: { status: TestimonialStatus }) {
  if (status === "published") return <Badge className="bg-green-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Publié</Badge>;
  if (status === "rejected") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeté</Badge>;
  return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />À valider</Badge>;
}

function TestimonialCard({ t, onClick }: { t: Testimonial; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{t.client_name || "Client inconnu"}</p>
            <p className="text-xs text-muted-foreground">{t.company || "—"}</p>
          </div>
          <StatusBadge status={t.status} />
        </div>
        {t.service_type && <p className="text-xs text-muted-foreground">Prestation : {t.service_type}</p>}
        {t.raw_transcript && (
          <p className="text-xs text-muted-foreground line-clamp-2 italic">"{t.raw_transcript.slice(0, 150)}…"</p>
        )}
        <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("fr-FR")}</p>
      </CardContent>
    </Card>
  );
}

interface ValidationSheetProps {
  testimonial: Testimonial;
  onClose: () => void;
}

function ValidationSheet({ testimonial, onClose }: ValidationSheetProps) {
  const [clientName, setClientName] = useState(testimonial.client_name ?? "");
  const [company, setCompany] = useState(testimonial.company ?? "");
  const [serviceType, setServiceType] = useState(testimonial.service_type ?? "");
  const [reviewerNotes, setReviewerNotes] = useState(testimonial.reviewer_notes ?? "");
  const { mutateAsync: update, isPending } = useUpdateTestimonial();
  const { toast } = useToast();

  const save = async (status?: TestimonialStatus) => {
    try {
      await update({ id: testimonial.id, client_name: clientName, company, service_type: serviceType, reviewer_notes: reviewerNotes, status });
      toast({ title: status === "published" ? "Témoignage publié" : status === "rejected" ? "Témoignage rejeté" : "Modifications sauvegardées" });
      onClose();
    } catch {
      toastError(toast, "Impossible de sauvegarder");
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle>Validation du témoignage</SheetTitle>
          <StatusBadge status={testimonial.status} />
        </SheetHeader>

        <ScrollArea className="flex-1 my-4">
          <div className="space-y-4 pr-4">
            {/* Extracted fields */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="client-name">Nom du client</Label>
                <Input id="client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Prénom Nom" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="company">Entreprise</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nom de l'entreprise" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="service-type">Prestation</Label>
                <Input id="service-type" value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="Type de formation ou prestation" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="notes">Notes de révision</Label>
                <Textarea id="notes" value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value)} placeholder="Notes internes…" rows={2} />
              </div>
            </div>

            <Separator />

            {/* Raw transcript */}
            {testimonial.raw_transcript && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Transcript</p>
                <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed text-foreground/70 bg-muted/40 rounded-md p-3 max-h-60 overflow-y-auto">
                  {testimonial.raw_transcript}
                </pre>
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => save()} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauvegarder"}
          </Button>
          {testimonial.status !== "rejected" && (
            <Button variant="destructive" onClick={() => save("rejected")} disabled={isPending}>
              <XCircle className="h-4 w-4 mr-1" />Rejeter
            </Button>
          )}
          {testimonial.status !== "published" && (
            <Button onClick={() => save("published")} disabled={isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1" />Publier
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function TestimonialList({ status }: { status: TestimonialStatus | "" }) {
  const [selected, setSelected] = useState<Testimonial | null>(null);
  const { data, isLoading, refetch } = useTestimonials(status);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!data?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-14 text-center gap-3">
          <Star className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Aucun témoignage</p>
          <p className="text-sm text-muted-foreground">
            Déposez une vidéo dans votre dossier Google Drive dédié aux témoignages.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1" />Rafraîchir</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((t) => (
          <TestimonialCard key={t.id} t={t} onClick={() => setSelected(t)} />
        ))}
      </div>
      {selected && <ValidationSheet testimonial={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

export default function Temoignages() {
  const { data: counts } = useTestimonialCounts();

  return (
    <ModuleLayout>
      <div className="flex items-center justify-between mb-2">
        <PageHeader title="Témoignages" />
        <PollingIndicator source="drive_testimonials" label="Google Drive — Témoignages" functionName="poll-drive-testimonials" />
      </div>

      <Tabs defaultValue="pending_review">
        <TabsList className="mb-4">
          <TabsTrigger value="pending_review">
            À valider {counts?.pending_review ? <span className="ml-1.5 bg-primary/20 text-primary rounded-full px-1.5 text-xs">{counts.pending_review}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="published">Publiés {counts?.published ? `(${counts.published})` : ""}</TabsTrigger>
          <TabsTrigger value="rejected">Rejetés {counts?.rejected ? `(${counts.rejected})` : ""}</TabsTrigger>
          <TabsTrigger value="">Tous</TabsTrigger>
        </TabsList>

        <TabsContent value="pending_review"><TestimonialList status="pending_review" /></TabsContent>
        <TabsContent value="published"><TestimonialList status="published" /></TabsContent>
        <TabsContent value="rejected"><TestimonialList status="rejected" /></TabsContent>
        <TabsContent value=""><TestimonialList status="" /></TabsContent>
      </Tabs>
    </ModuleLayout>
  );
}
