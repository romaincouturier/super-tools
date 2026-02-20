import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Video,
  Clock,
  Edit,
  Trash2,
  Plus,
  Link2,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";
import ShareEventDialog from "@/components/events/ShareEventDialog";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useEvent,
  useDeleteEvent,
} from "@/hooks/useEvents";
import { useEntityMedia, useAddMedia, useDeleteMedia } from "@/hooks/useMedia";
import EntityMediaManager from "@/components/media/EntityMediaManager";

const EventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: event, isLoading: eventLoading } = useEvent(id);
  const { data: media = [], isLoading: mediaLoading } = useEntityMedia("event", id);
  const deleteEvent = useDeleteEvent();
  const addMediaMutation = useAddMedia();
  const deleteMediaMutation = useDeleteMedia();

  const [videoLinkDialogOpen, setVideoLinkDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteEvent.mutateAsync(id);
      toast({ title: "Événement supprimé" });
      navigate("/events");
    } catch (error) {
      console.error("Failed to delete event:", error);
      toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" });
    }
  };

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
    } catch (error) {
      console.error("Failed to add video link:", error);
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleDeleteVideoLink = async (mediaId: string) => {
    if (!id) return;
    try {
      await deleteMediaMutation.mutateAsync({ id: mediaId, sourceType: "event", sourceId: id });
      toast({ title: "Lien vidéo supprimé" });
    } catch (error) {
      console.error("Failed to delete video link:", error);
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const videoLinks = media.filter((m) => m.file_type === "video_link");

  if (eventLoading || mediaLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="max-w-4xl mx-auto p-6 text-center py-20 text-muted-foreground">
          <p>Événement introuvable.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/events")}>
            Retour aux événements
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/events")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{event.title}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {format(parseISO(event.event_date), "EEEE d MMMM yyyy", { locale: fr })}
                </span>
                {event.event_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {event.event_time.slice(0, 5)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ShareEventDialog event={event} />
            <Button variant="outline" size="sm" onClick={() => navigate(`/events/${id}/edit`)}>
              <Edit className="h-4 w-4 mr-1" />
              Modifier
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cet événement ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Tous les médias associés seront aussi supprimés.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
            {event.description && (
              <div>
                <p className="text-sm font-medium mb-1">Description</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Images & Videos (unified) */}
        {id && (
          <EntityMediaManager
            sourceType="event"
            sourceId={id}
            sourceLabel={event.title}
          />
        )}

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
    </div>
  );
};

export default EventDetail;
