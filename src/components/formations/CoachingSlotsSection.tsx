import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { scheduleEmail } from "@/services/activityLog";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { UserCheck, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
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

interface CoachingSlot {
  id: string;
  training_id: string;
  participant_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  status: string;
  notes: string | null;
}

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  formula?: string | null;
  formula_id?: string | null;
}

interface CoachingSlotsSectionProps {
  trainingId: string;
  participants: Participant[];
}

const CoachingSlotsSection = ({ trainingId, participants }: CoachingSlotsSectionProps) => {
  const [slots, setSlots] = useState<CoachingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<CoachingSlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [participantId, setParticipantId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  // Participants eligible for coaching (have a formula_id and formula name contains "coach")
  const coacheeParticipants = participants.filter(
    (p) => p.formula_id && p.formula && p.formula.toLowerCase().includes("coach")
  );

  const fetchSlots = async () => {
    const { data, error } = await supabase
      .from("training_coaching_slots")
      .select("*")
      .eq("training_id", trainingId)
      .order("scheduled_at", { ascending: true });

    if (!error) setSlots(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSlots();
  }, [trainingId]);

  const resetForm = () => {
    setScheduledDate("");
    setScheduledTime("10:00");
    setDuration("30");
    setMeetingUrl("");
    setParticipantId("");
    setNotes("");
    setEditingSlot(null);
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (slot: CoachingSlot) => {
    const dt = parseISO(slot.scheduled_at);
    setScheduledDate(format(dt, "yyyy-MM-dd"));
    setScheduledTime(format(dt, "HH:mm"));
    setDuration(String(slot.duration_minutes));
    setMeetingUrl(slot.meeting_url || "");
    setParticipantId(slot.participant_id || "");
    setNotes(slot.notes || "");
    setEditingSlot(slot);
    setDialogOpen(true);
  };

  const scheduleCoachingReminder = async (slotId: string, pId: string, scheduledAt: string) => {
    try {
      // Schedule a reminder 1 day before the coaching at 09:00
      const slotDate = new Date(scheduledAt);
      const reminderDate = new Date(slotDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      reminderDate.setHours(9, 0, 0, 0);

      if (reminderDate <= new Date()) return;

      await scheduleEmail({
        trainingId,
        participantId: pId,
        emailType: "coaching_reminder",
        scheduledFor: reminderDate.toISOString(),
        errorMessage: `coaching:${slotId}`,
      });
    } catch (err) {
      console.warn("Failed to schedule coaching reminder:", err);
    }
  };

  const handleSave = async () => {
    if (!scheduledDate || !scheduledTime) return;
    setSaving(true);

    const scheduledAt = `${scheduledDate}T${scheduledTime}:00`;
    const payload = {
      training_id: trainingId,
      scheduled_at: scheduledAt,
      duration_minutes: parseInt(duration) || 30,
      meeting_url: meetingUrl.trim() || null,
      participant_id: participantId || null,
      status: participantId ? "booked" : "available",
      notes: notes.trim() || null,
    };

    try {
      if (editingSlot) {
        // Remove old coaching reminder
        await supabase
          .from("scheduled_emails")
          .delete()
          .eq("training_id", trainingId)
          .eq("email_type", "coaching_reminder")
          .like("error_message", `%coaching:${editingSlot.id}%`);

        const { error } = await supabase
          .from("training_coaching_slots")
          .update(payload)
          .eq("id", editingSlot.id);
        if (error) throw error;

        // Schedule new reminder if participant is assigned
        if (participantId) {
          await scheduleCoachingReminder(editingSlot.id, participantId, scheduledAt);
        }
        toast({ title: "Créneau modifié" });
      } else {
        const { data: inserted, error } = await supabase
          .from("training_coaching_slots")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        // Schedule reminder if participant is assigned
        if (inserted && participantId) {
          await scheduleCoachingReminder(inserted.id, participantId, scheduledAt);
        }
        toast({ title: "Créneau ajouté" });
      }
      setDialogOpen(false);
      resetForm();
      fetchSlots();
    } catch (error: unknown) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase
      .from("scheduled_emails")
      .delete()
      .eq("training_id", trainingId)
      .eq("email_type", "coaching_reminder")
      .like("error_message", `%coaching:${id}%`);

    const { error } = await supabase.from("training_coaching_slots").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    } else {
      toast({ title: "Créneau supprimé" });
      fetchSlots();
    }
  };

  const handleToggleComplete = async (slot: CoachingSlot) => {
    const newStatus = slot.status === "completed" ? "booked" : "completed";
    const { error } = await supabase
      .from("training_coaching_slots")
      .update({ status: newStatus })
      .eq("id", slot.id);
    if (!error) fetchSlots();
  };

  const getParticipantName = (pid: string | null) => {
    if (!pid) return null;
    const p = participants.find((p) => p.id === pid);
    if (!p) return null;
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
    return name || p.email;
  };

  const statusBadge = (slot: CoachingSlot) => {
    switch (slot.status) {
      case "available":
        return <Badge variant="outline" className="text-xs">Disponible</Badge>;
      case "booked":
        return <Badge variant="secondary" className="text-xs">Réservé</Badge>;
      case "completed":
        return <Badge variant="default" className="text-xs">Terminé</Badge>;
      case "cancelled":
        return <Badge variant="destructive" className="text-xs">Annulé</Badge>;
      default:
        return null;
    }
  };

  if (loading) return null;

  const bookedCount = slots.filter((s) => s.status === "booked" || s.status === "completed").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-5 w-5" />
            Coaching individuel
            {slots.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {bookedCount}/{slots.length}
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun créneau coaching. Les créneaux sont réservés aux participants Coachée.
          </p>
        ) : (
          <div className="space-y-2">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {format(parseISO(slot.scheduled_at), "EEE d MMM 'à' HH:mm", { locale: fr })}
                    </span>
                    <span className="text-xs text-muted-foreground">{slot.duration_minutes} min</span>
                    {statusBadge(slot)}
                  </div>
                  {slot.participant_id && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getParticipantName(slot.participant_id)}
                    </p>
                  )}
                  {slot.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{slot.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {slot.participant_id && slot.status !== "available" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleToggleComplete(slot)}
                    >
                      {slot.status === "completed" ? (
                        <X className="h-3.5 w-3.5" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(slot)}
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
                        <AlertDialogTitle>Supprimer ce créneau ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Ce créneau de coaching sera définitivement supprimé.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(slot.id)}>
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
            <DialogTitle>{editingSlot ? "Modifier le créneau" : "Ajouter un créneau coaching"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
              <Label>Durée</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1h</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Participant (Coachée)</Label>
              <Select value={participantId} onValueChange={setParticipantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Créneau libre (non attribué)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Créneau libre</SelectItem>
                  {coacheeParticipants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.email}
                    </SelectItem>
                  ))}
                  {coacheeParticipants.length === 0 && (
                    <SelectItem value="" disabled>
                      Aucun participant Coachée
                    </SelectItem>
                  )}
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
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes sur le créneau"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !scheduledDate}>
              {saving && <Spinner className="mr-2" />}
              {editingSlot ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CoachingSlotsSection;
