import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatDateWithDayOfWeek } from "@/lib/dateFormatters";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Video,
  Clock,
  Edit,
  Plus,
  Link2,
  X,
  Loader2,
  ExternalLink,
  Copy,
  StickyNote,
  Save,
  Ban,
  RotateCcw,
  Globe,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CANCELLATION_REASONS, getCfpDaysLeft } from "@/types/events";
import ShareEventDialog from "@/components/events/ShareEventDialog";
import ModuleLayout from "@/components/ModuleLayout";
import PageLoading from "@/components/PageLoading";
import PageNotFound from "@/components/PageNotFound";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useEvent,
  useUpdateEvent,
} from "@/hooks/useEvents";
import { useEntityMedia, useAddMedia, useDeleteMedia } from "@/hooks/useMedia";
import EntityMediaManager from "@/components/media/EntityMediaManager";

const EventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: event, isLoading: eventLoading } = useEvent(id);
  const { data: media = [], isLoading: mediaLoading } = useEntityMedia("event", id);
  const updateEvent = useUpdateEvent();
  const addMediaMutation = useAddMedia();
  const deleteMediaMutation = useDeleteMedia();

  const [videoLinkDialogOpen, setVideoLinkDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [notes, setNotes] = useState(event?.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  useEffect(() => {
    if (event) setNotes(event.notes || "");
  }, [event]);


  const handleAddVideoLink = async () => {
    if (!id || !videoUrl.trim()) return;
    try {
      await addMediaMutation.mutateAsync({
        file_url: videoUrl.trim(),
        file_name: videoName.trim() || videoUrl.trim(),
        file_type: "video_link",
        mime_type: null,
        file_size: null,
        position: media.length,
        source_type: "event",
        source_id: id,
      });
      toast({ title: "Lien vidéo ajouté" });
      setVideoUrl("");
      setVideoName("");
      setVideoLinkDialogOpen(false);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleDeleteVideoLink = async (mediaId: string) => {
    if (!id) return;
    try {
      await deleteMediaMutation.mutateAsync({ id: mediaId, sourceType: "event", sourceId: id });
      toast({ title: "Lien vidéo supprimé" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    try {
      await supabase
        .from("events")
        .update({ notes: notes.trim() || null })
        .eq("id", id);
    } catch {
      toast({ title: "Erreur", description: "Impossible de sauvegarder les notes.", variant: "destructive" });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDuplicate = async () => {
    if (!event) return;
    try {
      const { data, error } = await supabase
        .from("events")
        .insert({
          title: `${event.title} (copie)`,
          description: event.description,
          event_date: event.event_date,
          event_time: event.event_time,
          location: event.location,
          location_type: event.location_type,
          notes: event.notes,
          event_type: event.event_type,
          cfp_deadline: event.cfp_deadline,
          event_url: event.event_url,
          cfp_url: event.cfp_url,
        })
        .select()
        .single();

      if (error) throw error;
      toast({ title: "Événement dupliqué" });
      navigate(`/events/${data.id}`);
    } catch {
      toast({ title: "Erreur", description: "Impossible de dupliquer.", variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    if (!id || !cancellationReason) return;
    try {
      await updateEvent.mutateAsync({
        id,
        status: "cancelled",
        cancellation_reason: cancellationReason,
      });
      toast({ title: "Événement annulé" });
      setCancelDialogOpen(false);
      setCancellationReason("");
    } catch {
      toast({ title: "Erreur", description: "Impossible d'annuler.", variant: "destructive" });
    }
  };

  const handleReactivate = async () => {
    if (!id) return;
    try {
      await updateEvent.mutateAsync({
        id,
        status: "active",
        cancellation_reason: null,
      });
      toast({ title: "Événement réactivé" });
    } catch {
      toast({ title: "Erreur", description: "Impossible de réactiver.", variant: "destructive" });
    }
  };

  const videoLinks = media.filter((m) => m.file_type === "video_link");

  if (eventLoading || mediaLoading) return <PageLoading />;
  if (!event) return <PageNotFound message="Événement introuvable." backTo="/events" backLabel="Retour aux événements" />;

  return (
    <ModuleLayout>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Cancelled banner */}
        {event.status === "cancelled" && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">Événement annulé</p>
                {event.cancellation_reason && (
                  <p className="text-sm text-destructive/80">
                    Raison : {CANCELLATION_REASONS.find((r) => r.value === event.cancellation_reason)?.label || event.cancellation_reason}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleReactivate}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Réactiver
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate("/events")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={`text-2xl font-bold ${event.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
                  {event.title}
                </h1>
                {event.event_type === "external" && (
                  <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300">
                    <Globe className="h-3 w-3" />
                    Externe
                  </Badge>
                )}
                {event.status === "cancelled" && (
                  <Badge variant="destructive">Annulé</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDateWithDayOfWeek(event.event_date)}
                </span>
                {event.event_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {event.event_time.slice(0, 5)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <ShareEventDialog event={event} />
              <Button variant="outline" size="sm" onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-1" />
                Dupliquer
              </Button>
              {event.status !== "cancelled" && (
                <>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/events/${id}/edit`)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Modifier
                  </Button>
                  <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-orange-600 hover:text-orange-600">
                        <Ban className="h-4 w-4 mr-1" />
                        Annuler
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Annuler cet événement</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Raison de l'annulation *</Label>
                          <Select value={cancellationReason} onValueChange={setCancellationReason}>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner une raison..." />
                            </SelectTrigger>
                            <SelectContent>
                              {CANCELLATION_REASONS.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                            Retour
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleCancel}
                            disabled={!cancellationReason}
                          >
                            Confirmer l'annulation
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Info card */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            {event.location && (
              <div className="flex items-start gap-2">
                {event.location_type === "visio" ? (
                  <Video className="h-4 w-4 mt-0.5 text-muted-foreground" />
                ) : (
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {event.location_type === "visio" ? "Visioconférence" : "Lieu"}
                  </p>
                  {event.location_type === "visio" && event.location.startsWith("http") ? (
                    <a
                      href={event.location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {event.location}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">{event.location}</p>
                  )}
                </div>
              </div>
            )}
            {(event as any).private_group_url && (
              <div className="flex items-start gap-2">
                <ExternalLink className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Groupe privé</p>
                  <a
                    href={(event as any).private_group_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    {(event as any).private_group_url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}
            {event.description && (
              <div>
                <p className="text-sm font-medium mb-1">Description</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* External event info */}
        {event.event_type === "external" && (event.event_url || event.cfp_url || event.cfp_deadline) && (
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
                <Globe className="h-5 w-5" />
                Événement externe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {event.event_url && (
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Lien événement</p>
                    <a
                      href={event.event_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {event.event_url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
              {event.cfp_url && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Lien CFP</p>
                    <a
                      href={event.cfp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {event.cfp_url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
              {event.cfp_deadline && (() => {
                const daysLeft = getCfpDaysLeft(event.cfp_deadline);
                const isPastDeadline = daysLeft < 0;
                const isUrgent = daysLeft >= 0 && daysLeft <= 7;
                return (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${isUrgent && !isPastDeadline ? "text-orange-500" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-sm font-medium">Date limite CFP</p>
                      <p className={`text-sm ${isPastDeadline ? "text-muted-foreground line-through" : isUrgent ? "text-orange-600 font-medium" : "text-muted-foreground"}`}>
                        {formatDateWithDayOfWeek(event.cfp_deadline)}
                        {isPastDeadline ? " (passée)" : daysLeft === 0 ? " (aujourd'hui !)" : daysLeft === 1 ? " (demain !)" : ` (dans ${daysLeft}j)`}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Images & Videos (unified) */}
        {id && (
          <EntityMediaManager
            sourceType="event"
            sourceId={id}
            sourceLabel={event.title}
          />
        )}

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <StickyNote className="h-5 w-5" />
                Notes
              </CardTitle>
              {notes !== (event.notes || "") && (
                <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
                  {savingNotes ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Enregistrer
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Ajoutez des notes sur cet événement..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (event.notes || "")) handleSaveNotes();
              }}
              className="min-h-[100px] resize-y"
            />
          </CardContent>
        </Card>

        {/* Video links */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="h-5 w-5" />
                Liens vidéo ({videoLinks.length})
              </CardTitle>
              <Dialog open={videoLinkDialogOpen} onOpenChange={setVideoLinkDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter un lien vidéo
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Ajouter un lien vidéo</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="videoUrl">URL de la vidéo *</Label>
                      <Input
                        id="videoUrl"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="videoName">Titre (optionnel)</Label>
                      <Input
                        id="videoName"
                        value={videoName}
                        onChange={(e) => setVideoName(e.target.value)}
                        placeholder="Ex: Replay de la conférence"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleAddVideoLink} disabled={!videoUrl.trim()}>
                        Ajouter
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {videoLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun lien vidéo pour le moment.
              </p>
            ) : (
              <div className="space-y-2">
                {videoLinks.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 p-3 rounded-lg border group"
                  >
                    <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.file_name}</p>
                      <a
                        href={v.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline truncate block"
                      >
                        {v.file_url}
                      </a>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteVideoLink(v.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </ModuleLayout>
  );
};

export default EventDetail;
