import { useState, useRef } from "react";
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
  Upload,
  ImageIcon,
  Link2,
  X,
  Loader2,
  ExternalLink,
  Download,
} from "lucide-react";
import ShareEventDialog from "@/components/events/ShareEventDialog";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { supabase } from "@/integrations/supabase/client";
import {
  useEvent,
  useEventMedia,
  useDeleteEvent,
  useAddEventMedia,
  useDeleteEventMedia,
} from "@/hooks/useEvents";
import type { EventMedia } from "@/types/events";

const EventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: event, isLoading: eventLoading } = useEvent(id);
  const { data: media = [], isLoading: mediaLoading } = useEventMedia(id);
  const deleteEvent = useDeleteEvent();
  const addMedia = useAddEventMedia();
  const deleteMedia = useDeleteEventMedia();

  const [uploading, setUploading] = useState(false);
  const [videoLinkDialogOpen, setVideoLinkDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [lightboxImage, setLightboxImage] = useState<EventMedia | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadFile = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast({ title: "Erreur lors du téléchargement", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteEvent.mutateAsync(id);
      toast({ title: "Événement supprimé" });
      navigate("/events");
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" });
    }
  };

  const sanitizeFileName = (name: string) =>
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .toLowerCase();

  const handleUploadImages = async (files: FileList) => {
    if (!id) return;
    const validFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (validFiles.length === 0) {
      toast({ title: "Seules les images sont acceptées", variant: "destructive" });
      return;
    }

    setUploading(true);
    let count = 0;
    for (const file of validFiles) {
      const sanitized = sanitizeFileName(file.name);
      const path = `${id}/${Date.now()}_${sanitized}`;

      const { error: uploadError } = await supabase.storage
        .from("event-media")
        .upload(path, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast({ title: `Erreur upload ${file.name}`, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage.from("event-media").getPublicUrl(path);

      try {
        await addMedia.mutateAsync({
          event_id: id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: "image",
          mime_type: file.type,
          file_size: file.size,
          position: media.length + count,
        });
        count++;
      } catch (err) {
        console.error("Insert error:", err);
      }
    }

    if (count > 0) {
      toast({ title: `${count} image${count > 1 ? "s" : ""} ajoutée${count > 1 ? "s" : ""}` });
    }
    setUploading(false);
  };

  const handleAddVideoLink = async () => {
    if (!id || !videoUrl.trim()) return;
    try {
      await addMedia.mutateAsync({
        event_id: id,
        file_url: videoUrl.trim(),
        file_name: videoName.trim() || videoUrl.trim(),
        file_type: "video_link",
        mime_type: null,
        file_size: null,
        position: media.length,
      });
      toast({ title: "Lien vidéo ajouté" });
      setVideoUrl("");
      setVideoName("");
      setVideoLinkDialogOpen(false);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleDeleteMedia = async (item: EventMedia) => {
    if (!id) return;
    try {
      await deleteMedia.mutateAsync({ id: item.id, eventId: id });
      toast({ title: "Média supprimé" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const images = media.filter((m) => m.file_type === "image");
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

        {/* Images */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Images ({images.length})
              </CardTitle>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleUploadImages(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  Ajouter des images
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {images.length === 0 ? (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Cliquez ou glissez des images ici</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
                    onClick={() => setLightboxImage(img)}
                  >
                    <img
                      src={img.file_url}
                      alt={img.file_name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                    {/* Download button – always visible */}
                    <button
                      className="absolute bottom-1 right-1 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-opacity z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(img.file_url, img.file_name);
                      }}
                      title="Télécharger"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    {/* Delete button – visible on hover only */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMedia(img);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Video links */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="h-5 w-5" />
                Vidéos ({videoLinks.length})
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
                      onClick={() => handleDeleteMedia(v)}
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

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              className="text-white hover:text-white/80 p-1"
              onClick={(e) => {
                e.stopPropagation();
                downloadFile(lightboxImage.file_url, lightboxImage.file_name);
              }}
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              className="text-white hover:text-white/80 p-1"
              onClick={() => setLightboxImage(null)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <img
            src={lightboxImage.file_url}
            alt={lightboxImage.file_name}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default EventDetail;
