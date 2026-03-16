import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Video, Check, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Booking {
  id: string;
  requested_date: string;
  duration_minutes: number;
  status: string;
  learner_notes: string | null;
  instructor_notes: string | null;
  meeting_url: string | null;
  created_at: string;
}

interface Props {
  trainingId: string;
  participantId: string;
  /** Max coaching sessions allowed */
  maxSessions?: number;
  /** Already completed sessions */
  completedSessions?: number;
  /** If true, show instructor view with approve/reject */
  isInstructor?: boolean;
}

const statusLabels: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  cancelled: "Annulé",
  completed: "Réalisé",
};

const statusColors: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  confirmed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  completed: "bg-primary/10 text-primary",
};

export default function CoachingBooking({
  trainingId,
  participantId,
  maxSessions = 0,
  completedSessions = 0,
  isInstructor = false,
}: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadBookings();
  }, [trainingId, participantId]);

  const loadBookings = async () => {
    const { data } = await supabase
      .from("coaching_bookings")
      .select("*")
      .eq("training_id", trainingId)
      .eq("participant_id", participantId)
      .order("requested_date", { ascending: true });
    setBookings((data as Booking[]) || []);
    setLoading(false);
  };

  const activeBookings = bookings.filter((b) => b.status !== "cancelled");
  const remainingSessions = maxSessions - completedSessions - activeBookings.filter((b) => b.status === "pending" || b.status === "confirmed").length;

  const handleSubmit = async () => {
    if (!date || !time) return;
    setSubmitting(true);
    const requestedDate = new Date(`${date}T${time}:00`).toISOString();
    const { error } = await supabase.from("coaching_bookings").insert({
      training_id: trainingId,
      participant_id: participantId,
      requested_date: requestedDate,
      learner_notes: notes || null,
    } as any);
    if (error) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    } else {
      toast({ title: "Demande envoyée !" });
      setShowForm(false);
      setDate("");
      setNotes("");
      loadBookings();
    }
    setSubmitting(false);
  };

  const handleUpdateStatus = async (bookingId: string, status: string) => {
    await supabase
      .from("coaching_bookings")
      .update({
        status,
        ...(status === "confirmed" ? { confirmed_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", bookingId);
    loadBookings();
    toast({ title: `Séance ${status === "confirmed" ? "confirmée" : "annulée"}` });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Video className="w-4 h-4" /> Séances de coaching
          </CardTitle>
          {maxSessions > 0 && (
            <Badge variant="outline">
              {completedSessions}/{maxSessions} réalisées
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {bookings.length === 0 && !showForm && (
          <div className="text-center py-6 space-y-2">
            <Video className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Vous n'avez pas encore de séance de coaching programmée.
            </p>
            {remainingSessions > 0 && (
              <p className="text-xs text-muted-foreground">
                Il vous reste <span className="font-medium text-foreground">{remainingSessions} séance{remainingSessions > 1 ? "s" : ""}</span> à réserver.
              </p>
            )}
          </div>
        )}

        {bookings.map((b) => (
          <div key={b.id} className="flex items-start gap-3 p-3 rounded-lg border">
            <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {format(new Date(b.requested_date), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </span>
                <Badge variant="outline" className={statusColors[b.status]}>
                  {statusLabels[b.status]}
                </Badge>
              </div>
              {b.learner_notes && (
                <p className="text-xs text-muted-foreground mt-1">📝 {b.learner_notes}</p>
              )}
              {b.meeting_url && b.status === "confirmed" && (
                <a
                  href={b.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                >
                  <Video className="w-3 h-3" /> Rejoindre la session
                </a>
              )}
            </div>
            {isInstructor && b.status === "pending" && (
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdateStatus(b.id, "confirmed")}>
                  <Check className="w-4 h-4 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdateStatus(b.id, "cancelled")}>
                  <X className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        ))}

        {/* Booking form */}
        {showForm && (
          <div className="space-y-3 p-3 rounded-lg border border-dashed">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Heure</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sujet ou questions pour cette séance..."
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={!date || submitting} size="sm">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Calendar className="w-4 h-4 mr-1" />}
                Demander
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Annuler</Button>
            </div>
          </div>
        )}

        {!isInstructor && !showForm && remainingSessions > 0 && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowForm(true)}>
            <Calendar className="w-4 h-4 mr-1" /> Réserver une séance
          </Button>
        )}

        {!isInstructor && remainingSessions <= 0 && maxSessions > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Toutes vos séances ont été utilisées ou planifiées
          </p>
        )}
      </CardContent>
    </Card>
  );
}
