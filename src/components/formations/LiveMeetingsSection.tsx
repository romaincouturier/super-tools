import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { scheduleEmailsBulk } from "@/services/activityLog";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Video, Plus, Trash2, Loader2, ExternalLink, Check, X, Pencil, Copy, FileText, Save } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import RichTextEditor from "@/components/content/RichTextEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface LiveMeeting {
  id: string;
  training_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  description: string | null;
  email_content: string | null;
  run_notes: string | null;
  status: string;
}

interface LiveMeetingsSectionProps {
  trainingId: string;
}

const LiveMeetingsSection = ({ trainingId }: LiveMeetingsSectionProps) => {
  const [meetings, setMeetings] = useState<LiveMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<LiveMeeting | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [description, setDescription] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesMeeting, setNotesMeeting] = useState<LiveMeeting | null>(null);
  const [runNotes, setRunNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const { toast } = useToast();

  const fetchMeetings = async () => {
    const { data, error } = await supabase
      .from("training_live_meetings")
      .select("*")
      .eq("training_id", trainingId)
      .order("scheduled_at", { ascending: true });

    if (!error) setMeetings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMeetings();
  }, [trainingId]);

  const resetForm = () => {
    setTitle("");
    setScheduledDate("");
    setScheduledTime("10:00");
    setDuration("60");
    setMeetingUrl("");
    setDescription("");
    setEmailContent("");
    setEditingMeeting(null);
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (meeting: LiveMeeting) => {
    const dt = parseISO(meeting.scheduled_at);
    setTitle(meeting.title);
    setScheduledDate(format(dt, "yyyy-MM-dd"));
    setScheduledTime(format(dt, "HH:mm"));
    setDuration(String(meeting.duration_minutes));
    setMeetingUrl(meeting.meeting_url || "");
    setDescription(meeting.description || "");
    setEmailContent(meeting.email_content || "");
    setEditingMeeting(meeting);
    setDialogOpen(true);
  };

  const openDuplicate = (meeting: LiveMeeting) => {
    const dt = parseISO(meeting.scheduled_at);
    const nextWeek = new Date(dt);
    nextWeek.setDate(nextWeek.getDate() + 7);
    setTitle(meeting.title);
    setScheduledDate(format(nextWeek, "yyyy-MM-dd"));
    setScheduledTime(format(dt, "HH:mm"));
    setDuration(String(meeting.duration_minutes));
    setMeetingUrl(meeting.meeting_url || "");
    setDescription(meeting.description || "");
    setEmailContent(meeting.email_content || "");
    setEditingMeeting(null);
    setDialogOpen(true);
  };

  const scheduleLiveReminders = async (meetingId: string, scheduledAt: string) => {
    try {
      // Fetch all participants of the training session
      const { data: eligibleParticipants } = await supabase
        .from("training_participants")
        .select("id")
        .eq("training_id", trainingId);

      if (!eligibleParticipants?.length) return;

      // Schedule a reminder 6 hours before the live
      const liveDate = new Date(scheduledAt);
      const reminderDate = new Date(liveDate.getTime() - 6 * 60 * 60 * 1000);

      // Only schedule if the reminder is in the future
      if (reminderDate <= new Date()) return;

      const emailRows = eligibleParticipants.map((p) => ({
        training_id: trainingId,
        participant_id: p.id,
        email_type: "live_reminder",
        scheduled_for: reminderDate.toISOString(),
        error_message: `live:${meetingId}`,
      }));

      await scheduleEmailsBulk(emailRows);
    } catch (err) {
      console.warn("Failed to schedule live reminders:", err);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !scheduledDate || !scheduledTime) return;
    setSaving(true);

    // Build a local Date and convert to ISO with correct timezone offset
    const localDate = new Date(`${scheduledDate}T${scheduledTime}:00`);
    const scheduledAt = localDate.toISOString();
    const payload = {
      training_id: trainingId,
      title: title.trim(),
      scheduled_at: scheduledAt,
      duration_minutes: parseInt(duration) || 60,
      meeting_url: meetingUrl.trim() || null,
      description: description.trim() || null,
      email_content: emailContent.trim() || null,
    };

    try {
      if (editingMeeting) {
        const { error } = await supabase
          .from("training_live_meetings")
          .update(payload)
          .eq("id", editingMeeting.id);
        if (error) throw error;

        // Re-schedule reminders: delete old ones and create new ones
        await supabase
          .from("scheduled_emails")
          .delete()
          .eq("training_id", trainingId)
          .eq("email_type", "live_reminder")
          .like("error_message", `%live:${editingMeeting.id}%`);

        await scheduleLiveReminders(editingMeeting.id, scheduledAt);
        toast({ title: "Live modifié" });
      } else {
        const { data: inserted, error } = await supabase
          .from("training_live_meetings")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        // Schedule reminder emails for communaute + coachee participants
        if (inserted) {
          await scheduleLiveReminders(inserted.id, scheduledAt);
        }
        toast({ title: "Live ajouté" });
      }
      setDialogOpen(false);
      resetForm();
      fetchMeetings();
    } catch (error: unknown) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (meetingId: string) => {
    // Delete associated reminder emails
    await supabase
      .from("scheduled_emails")
      .delete()
      .eq("training_id", trainingId)
      .eq("email_type", "live_reminder")
      .like("error_message", `%live:${meetingId}%`);

    const { error } = await supabase.from("training_live_meetings").delete().eq("id", meetingId);
    if (error) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    } else {
      toast({ title: "Live supprimé" });
      fetchMeetings();
    }
  };

  const handleToggleStatus = async (meeting: LiveMeeting) => {
    const newStatus = meeting.status === "completed" ? "scheduled" : "completed";
    const { error } = await supabase
      .from("training_live_meetings")
      .update({ status: newStatus })
      .eq("id", meeting.id);
    if (!error) fetchMeetings();
  };

  const openNotes = (meeting: LiveMeeting) => {
    setNotesMeeting(meeting);
    setRunNotes(meeting.run_notes || "");
    setNotesDialogOpen(true);
  };

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notesSaved, setNotesSaved] = useState(false);

  const saveNotesNow = useCallback(async (meetingId: string, notes: string) => {
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from("training_live_meetings")
        .update({ run_notes: notes.trim() || null })
        .eq("id", meetingId);
      if (error) throw error;
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
      fetchMeetings();
    } catch (error: unknown) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    } finally {
      setSavingNotes(false);
    }
  }, [fetchMeetings, toast]);

  const handleRunNotesChange = useCallback((html: string) => {
    setRunNotes(html);
    setNotesSaved(false);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (notesMeeting) {
      autoSaveTimerRef.current = setTimeout(() => {
        saveNotesNow(notesMeeting.id, html);
      }, 1500);
    }
  }, [notesMeeting, saveNotesNow]);

  // Cleanup timer on unmount / dialog close
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const handleSaveNotes = async () => {
    if (!notesMeeting) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    await saveNotesNow(notesMeeting.id, runNotes);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="outline" className="text-xs">Programmé</Badge>;
      case "completed":
        return <Badge variant="default" className="text-xs">Terminé</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="text-xs">Annulé</Badge>;
      default:
        return null;
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="h-5 w-5" />
            Lives collectifs
            {meetings.length > 0 && (
              <Badge variant="secondary" className="text-xs">{meetings.length}</Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun live programmé.
          </p>
        ) : (
          <div className="space-y-2">
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{meeting.title}</span>
                    {statusBadge(meeting.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(parseISO(meeting.scheduled_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    {" · "}{meeting.duration_minutes} min
                  </p>
                  {meeting.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{meeting.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {meeting.meeting_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => window.open(meeting.meeting_url!, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleToggleStatus(meeting)}
                  >
                    {meeting.status === "completed" ? (
                      <X className="h-3.5 w-3.5" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 ${meeting.run_notes ? "text-blue-600" : ""}`}
                    onClick={() => openNotes(meeting)}
                    title="Notes de déroulé"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(meeting)}
                    title="Modifier"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openDuplicate(meeting)}
                    title="Dupliquer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce live ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Le live "{meeting.title}" sera définitivement supprimé.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(meeting.id)}>
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMeeting ? "Modifier le live" : "Ajouter un live"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Live Q&A - Module 1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Heure *</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Durée (minutes)</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1h</SelectItem>
                  <SelectItem value="90">1h30</SelectItem>
                  <SelectItem value="120">2h</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Lien de la réunion</Label>
              <Input
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://zoom.us/j/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Thème ou contenu du live"
              />
            </div>
            <div className="space-y-2">
              <Label>Contenu de l'email de rappel</Label>
              <Textarea
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                placeholder="Corps du mail envoyé 6h avant le live à tous les participants. Laissez vide pour utiliser le message par défaut."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Envoyé automatiquement 6h avant le live à tous les participants.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !title.trim() || !scheduledDate}>
              {saving && <Spinner className="mr-2" />}
              {editingMeeting ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={(open) => {
        if (!open && notesMeeting && autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          saveNotesNow(notesMeeting.id, runNotes);
        }
        setNotesDialogOpen(open);
      }}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes de déroulé
              {notesMeeting && (
                <span className="text-sm font-normal text-muted-foreground">
                  — {notesMeeting.title}
                </span>
              )}
              <span className="ml-auto flex items-center gap-2 text-sm font-normal">
                {savingNotes && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Enregistrement...
                  </span>
                )}
                {notesSaved && !savingNotes && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                    Enregistré
                  </span>
                )}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2">
            <RichTextEditor
              content={runNotes}
              onChange={handleRunNotesChange}
              placeholder="Notez le déroulé du live, les points abordés, les questions posées..."
              minHeight="350px"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Fermer</Button>
            <Button onClick={handleSaveNotes} disabled={savingNotes}>
              {savingNotes && <Spinner className="mr-2" />}
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LiveMeetingsSection;
