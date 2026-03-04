import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Video, Plus, Trash2, Loader2, ExternalLink, Check, X, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    setEditingMeeting(meeting);
    setDialogOpen(true);
  };

  const scheduleLiveReminders = async (meetingId: string, scheduledAt: string) => {
    try {
      // Fetch communaute + coachee participants
      const { data: eligibleParticipants } = await supabase
        .from("training_participants")
        .select("id")
        .eq("training_id", trainingId)
        .in("formula", ["communaute", "coachee"]);

      if (!eligibleParticipants?.length) return;

      // Schedule a reminder 1 day before the live at 09:00
      const liveDate = new Date(scheduledAt);
      const reminderDate = new Date(liveDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      reminderDate.setHours(9, 0, 0, 0);

      // Only schedule if the reminder is in the future
      if (reminderDate <= new Date()) return;

      const emailRows = eligibleParticipants.map((p) => ({
        training_id: trainingId,
        participant_id: p.id,
        email_type: "live_reminder" as const,
        scheduled_for: reminderDate.toISOString(),
        status: "pending" as const,
        // Store meeting id in error_message field for tracking (used to delete on edit)
        error_message: `live:${meetingId}`,
      }));

      await supabase.from("scheduled_emails").insert(emailRows);
    } catch (err) {
      console.warn("Failed to schedule live reminders:", err);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !scheduledDate || !scheduledTime) return;
    setSaving(true);

    const scheduledAt = `${scheduledDate}T${scheduledTime}:00`;
    const payload = {
      training_id: trainingId,
      title: title.trim(),
      scheduled_at: scheduledAt,
      duration_minutes: parseInt(duration) || 60,
      meeting_url: meetingUrl.trim() || null,
      description: description.trim() || null,
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
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
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
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
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
            Aucun live programmé. Les lives sont accessibles aux participants Communauté et Coachée.
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
                    className="h-7 w-7"
                    onClick={() => openEdit(meeting)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !title.trim() || !scheduledDate}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingMeeting ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LiveMeetingsSection;
