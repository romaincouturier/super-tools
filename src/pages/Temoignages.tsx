import { useState } from "react";
import { Star, CheckCircle2, XCircle, Clock, Loader2, RefreshCw, Download, Wand2, Plus } from "lucide-react";
import { PollingIndicator } from "@/components/shared/PollingIndicator";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { supabase } from "@/integrations/supabase/client";
import {
  useTestimonials,
  useTestimonialCounts,
  useUpdateTestimonial,
  useCreateTestimonial,
  type Testimonial,
  type TestimonialStatus,
} from "@/hooks/useTestimonials";

function StatusBadge({ status }: { status: TestimonialStatus }) {
  if (status === "published") return <Badge className="bg-green-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Publié</Badge>;
  if (status === "rejected") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeté</Badge>;
  return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />À valider</Badge>;
}

function TestimonialCard({ t, onClick }: { t: Testimonial; onClick: () => void }) {
  const driveUrl = t.drive_file_id ? `https://drive.google.com/file/d/${t.drive_file_id}/view` : null;
  const videoUrl = driveUrl ?? t.video_url;
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
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("fr-FR")}</p>
          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="h-3 w-3" /> Vidéo
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function PublishedTestimonialCard({ t, onEdit }: { t: Testimonial; onEdit: () => void }) {
  const ytId = extractYoutubeId(t.video_url);
  const [playing, setPlaying] = useState(false);

  const driveUrl = t.drive_file_id ? `https://drive.google.com/file/d/${t.drive_file_id}/view` : null;
  const videoUrl = ytId
    ? `https://www.youtube.com/watch?v=${ytId}`
    : driveUrl ?? t.video_url ?? "#";
  const thumb = ytId
    ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
    : t.drive_file_id
    ? `https://drive.google.com/thumbnail?id=${t.drive_file_id}&sz=w640`
    : null;

  return (
    <div className="group flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
        {playing && ytId ? (
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
            title={t.service_type || "Témoignage"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (ytId) {
                e.preventDefault();
                setPlaying(true);
              }
            }}
            className="relative block h-full w-full"
          >
            {thumb ? (
              <img
                src={thumb}
                alt={t.service_type || t.company || "Témoignage"}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Star className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70">
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white"><path d="M8 5v14l11-7z" /></svg>
              </div>
            </div>
          </a>
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm line-clamp-2 leading-snug">{t.service_type || "Prestation non renseignée"}</p>
          <p className="text-xs text-muted-foreground truncate">{t.company || "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{t.client_name || "Client inconnu"}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
          title="Éditer"
        >
          <Wand2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}


function AddTestimonialDialog({ onClose }: { onClose: () => void }) {
  const [clientName, setClientName] = useState("");
  const [company, setCompany] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [reviewerNotes, setReviewerNotes] = useState("");
  const { mutateAsync: create, isPending } = useCreateTestimonial();
  const { toast } = useToast();

  const submit = async () => {
    if (!videoUrl.trim()) {
      toastError(toast, "L'URL de la vidéo est obligatoire");
      return;
    }
    try {
      await create({ client_name: clientName, company, service_type: serviceType, video_url: videoUrl.trim(), reviewer_notes: reviewerNotes });
      toast({ title: "Témoignage ajouté", description: "Il apparaît dans l'onglet \"À valider\"." });
      onClose();
    } catch {
      toastError(toast, "Impossible d'ajouter le témoignage");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un témoignage manuellement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="add-video-url">URL de la vidéo (Notion ou autre) *</Label>
            <Input id="add-video-url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-client-name">Nom du client</Label>
            <Input id="add-client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Prénom Nom" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-company">Entreprise</Label>
            <Input id="add-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nom de l'entreprise" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-service-type">Prestation</Label>
            <Input id="add-service-type" value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="Type de formation ou prestation" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-notes">Notes</Label>
            <Textarea id="add-notes" value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value)} placeholder="Notes internes…" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  const [retrying, setRetrying] = useState(false);

  const retryTranscript = async () => {
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("retry-testimonial-transcript", {
        body: { testimonial_id: testimonial.id },
      });
      if (error || !(data as { ok?: boolean })?.ok) {
        throw new Error((data as { error?: string })?.error || error?.message || "Échec");
      }
      toast({ title: "Transcription relancée", description: "Le transcript apparaîtra dans quelques minutes." });
    } catch (e) {
      toastError(toast, e instanceof Error ? e.message : "Impossible de relancer la transcription");
    } finally {
      setRetrying(false);
    }
  };

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

            {testimonial.video_url && !testimonial.drive_file_id && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lien vidéo</p>
                  <a
                    href={testimonial.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline break-all"
                  >
                    {testimonial.video_url}
                  </a>
                </div>
              </>
            )}

            <Separator />

            {/* Raw transcript */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcript</p>
                {!testimonial.raw_transcript && (
                  <Button size="sm" variant="outline" onClick={retryTranscript} disabled={retrying}>
                    {retrying ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                    Générer le transcript
                  </Button>
                )}
              </div>
              {testimonial.raw_transcript ? (
                <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed text-foreground/70 bg-muted/40 rounded-md p-3 max-h-60 overflow-y-auto">
                  {testimonial.raw_transcript}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground italic bg-muted/40 rounded-md p-3">
                  Transcription non disponible. Cliquez sur "Générer le transcript" pour relancer la transcription AssemblyAI à partir de la vidéo Drive.
                </p>
              )}
            </div>

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

function TestimonialList({ status, search }: { status: TestimonialStatus | ""; search: string }) {
  const [selected, setSelected] = useState<Testimonial | null>(null);
  const { data, isLoading, refetch } = useTestimonials(status);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? (data ?? []).filter((t) =>
        [t.client_name, t.company, t.service_type]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      )
    : data ?? [];

  if (!filtered.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-14 text-center gap-3">
          <Star className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">{q ? "Aucun résultat" : "Aucun témoignage"}</p>
          <p className="text-sm text-muted-foreground">
            {q ? "Essayez un autre nom, prénom ou titre." : "Déposez une vidéo dans votre dossier Google Drive dédié aux témoignages."}
          </p>
          {!q && <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1" />Rafraîchir</Button>}
        </CardContent>
      </Card>
    );
  }

  const isPublished = status === "published";
  return (
    <>
      <div className={isPublished ? "grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
        {filtered.map((t) =>
          isPublished ? (
            <PublishedTestimonialCard key={t.id} t={t} onEdit={() => setSelected(t)} />
          ) : (
            <TestimonialCard key={t.id} t={t} onClick={() => setSelected(t)} />
          )
        )}
      </div>
      {selected && <ValidationSheet testimonial={selected} onClose={() => setSelected(null)} />}
    </>
  );
}


export default function Temoignages() {
  const { data: counts } = useTestimonialCounts();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <ModuleLayout>
      <div className="flex items-center justify-between mb-2">
        <PageHeader title="Témoignages" />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Ajouter manuellement
          </Button>
          <PollingIndicator source="drive_testimonials" label="Google Drive — Témoignages" functionName="poll-drive-testimonials" />
        </div>
      </div>
      {addOpen && <AddTestimonialDialog onClose={() => setAddOpen(false)} />}

      <div className="mb-3 max-w-sm">
        <Input
          placeholder="Rechercher par nom, prénom, entreprise ou titre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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

        <TabsContent value="pending_review"><TestimonialList status="pending_review" search={search} /></TabsContent>
        <TabsContent value="published"><TestimonialList status="published" search={search} /></TabsContent>
        <TabsContent value="rejected"><TestimonialList status="rejected" search={search} /></TabsContent>
        <TabsContent value=""><TestimonialList status="" search={search} /></TabsContent>
      </Tabs>
    </ModuleLayout>
  );
}

