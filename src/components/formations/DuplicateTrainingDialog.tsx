import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/services/activityLog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, Calendar, Copy, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ScheduleEditor, { Schedule, SESSION_PRESETS } from "@/components/formations/ScheduleEditor";

interface LiveMeetingInfo {
  title: string;
  duration_minutes: number;
  meeting_url: string | null;
  description: string | null;
  email_content: string | null;
}

interface DuplicateTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainingId: string;
  trainingName: string;
  isElearning: boolean;
  userId: string;
}

const DuplicateTrainingDialog = ({
  open,
  onOpenChange,
  trainingId,
  trainingName,
  isElearning,
  userId,
}: DuplicateTrainingDialogProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Dates for présentiel / synchrone
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // Dates for e-learning
  const [elearningStartDate, setElearningStartDate] = useState<string>("");
  const [elearningEndDate, setElearningEndDate] = useState<string>("");

  // Live meetings from original
  const [originalLives, setOriginalLives] = useState<LiveMeetingInfo[]>([]);
  const [liveDates, setLiveDates] = useState<{ date: string; time: string }[]>([]);

  // Fetch original live meetings
  useEffect(() => {
    if (!open) return;
    const fetchLives = async () => {
      const { data } = await supabase
        .from("training_live_meetings")
        .select("title, duration_minutes, meeting_url, description, email_content")
        .eq("training_id", trainingId)
        .order("scheduled_at", { ascending: true });
      if (data && data.length > 0) {
        setOriginalLives(data);
        setLiveDates(data.map(() => ({ date: "", time: "10:00" })));
      } else {
        setOriginalLives([]);
        setLiveDates([]);
      }
    };
    fetchLives();
  }, [open, trainingId]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedDates([]);
      setSchedules([]);
      setElearningStartDate("");
      setElearningEndDate("");
      setOriginalLives([]);
      setLiveDates([]);
    }
  }, [open]);

  // Generate schedules when dates change
  useEffect(() => {
    if (selectedDates.length === 0) {
      setSchedules([]);
      return;
    }
    const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    const newSchedules = sortedDates.map((day, index) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const existing = schedules.find(s => s.day_date === dateStr);
      if (existing) return existing;
      if (index > 0 && schedules.length > 0) {
        const first = schedules[0];
        return { day_date: dateStr, start_time: first.start_time, end_time: first.end_time, session_type: first.session_type };
      }
      return { day_date: dateStr, start_time: SESSION_PRESETS.full.start, end_time: SESSION_PRESETS.full.end, session_type: "full" as const };
    });
    const selectedDateStrs = sortedDates.map(d => format(d, "yyyy-MM-dd"));
    setSchedules(newSchedules.filter(s => selectedDateStrs.includes(s.day_date)));
  }, [selectedDates]);

  const formatSelectedDates = (): string => {
    if (selectedDates.length === 0) return "Sélectionner les jours";
    if (selectedDates.length === 1) return format(selectedDates[0], "d MMMM yyyy", { locale: fr });
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    return `${selectedDates.length} jours (${format(sorted[0], "d MMM", { locale: fr })} - ${format(sorted[sorted.length - 1], "d MMM", { locale: fr })})`;
  };

  const handleDuplicate = async () => {
    // Validate dates
    if (!isElearning && selectedDates.length === 0) {
      toast({ title: "Veuillez sélectionner les dates de la nouvelle session", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Fetch original training data
      const { data: original, error: fetchError } = await supabase
        .from("trainings")
        .select("*")
        .eq("id", trainingId)
        .single();

      if (fetchError || !original) throw fetchError || new Error("Formation introuvable");

      // Compute new dates
      let newStartDate: string | null = null;
      let newEndDate: string | null = null;

      if (isElearning) {
        newStartDate = elearningStartDate || null;
        newEndDate = elearningEndDate || null;
      } else {
        const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
        newStartDate = format(sorted[0], "yyyy-MM-dd");
        newEndDate = sorted.length > 1 ? format(sorted[sorted.length - 1], "yyyy-MM-dd") : null;
      }

      // Create new training - copy config fields, reset operational fields
      const { data: newTraining, error: insertError } = await supabase
        .from("trainings")
        .insert({
          start_date: newStartDate,
          end_date: newEndDate,
          training_name: original.training_name,
          location: original.location,
          client_name: original.client_name,
          client_address: original.client_address,
          sold_price_ht: original.sold_price_ht,
          max_participants: original.max_participants,
          evaluation_link: original.evaluation_link || "",
          format_formation: original.format_formation,
          session_type: original.session_type,
          session_format: original.session_format,
          prerequisites: original.prerequisites || [],
          objectives: original.objectives || [],
          program_file_url: original.program_file_url,
          supertilt_link: original.supertilt_link,
          sponsor_first_name: original.sponsor_first_name,
          sponsor_last_name: original.sponsor_last_name,
          sponsor_email: original.sponsor_email,
          sponsor_formal_address: original.sponsor_formal_address,
          participants_formal_address: original.participants_formal_address,
          financeur_same_as_sponsor: original.financeur_same_as_sponsor,
          financeur_name: original.financeur_name,
          financeur_url: original.financeur_url,
          trainer_id: original.trainer_id,
          elearning_duration: original.elearning_duration,
          catalog_id: original.catalog_id,
           supports_url: original.supports_url,
          private_group_url: original.private_group_url,
          assigned_to: original.assigned_to,
          created_by: userId,
          // Reset these fields (not duplicated):
          // - convention_file_url (conventions)
          // - signed_convention_urls (conventions signées)
          // - attendance_sheets_urls (feuilles d'émargement)
          // - invoice_file_url (facture)
          // - notes
          // - funder_appreciation / funder_appreciation_date
          // - train_booked, hotel_booked, restaurant_booked, room_rental_booked
        })
        .select()
        .single();

      if (insertError || !newTraining) throw insertError || new Error("Erreur lors de la création");

      // Create schedules for the new training
      if (schedules.length > 0) {
        const { error: schedulesError } = await supabase
          .from("training_schedules")
          .insert(
            schedules.map(s => ({
              training_id: newTraining.id,
              day_date: s.day_date,
              start_time: s.start_time,
              end_time: s.end_time,
            }))
          );
        if (schedulesError) throw schedulesError;
      }

      // Create live meetings with new dates if provided
      if (originalLives.length > 0) {
        const livesToInsert = originalLives
          .map((live, i) => {
            const ld = liveDates[i];
            if (!ld?.date) return null;
            const scheduledAt = new Date(`${ld.date}T${ld.time || "10:00"}:00`).toISOString();
            return {
              training_id: newTraining.id,
              title: live.title,
              scheduled_at: scheduledAt,
              duration_minutes: live.duration_minutes,
              meeting_url: live.meeting_url,
              description: live.description,
              email_content: live.email_content,
              status: "scheduled",
            };
          })
          .filter(Boolean);

        if (livesToInsert.length > 0) {
          const { error: livesError } = await supabase
            .from("training_live_meetings")
            .insert(livesToInsert as any);
          if (livesError) throw livesError;
        }
      }

      // Log activity
      await logActivity({
        actionType: "training_created",
        recipientEmail: "system",
        userId,
        details: {
          training_id: newTraining.id,
          training_name: original.training_name,
          client_name: original.client_name,
          start_date: newStartDate,
          duplicated_from: trainingId,
        },
      });

      toast({
        title: "Session dupliquée",
        description: "La nouvelle session a été créée avec succès.",
      });

      onOpenChange(false);
      navigate(`/formations/${newTraining.id}`);
    } catch (error: unknown) {
      console.error("Error duplicating training:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de la duplication.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Dupliquer la session
          </DialogTitle>
          <DialogDescription>
            Dupliquer « {trainingName} » avec de nouvelles dates.
            Les participants, conventions, documents, actions, notes, photos et vidéos ne seront pas repris.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date selection */}
          {isElearning ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Input
                  type="date"
                  value={elearningStartDate}
                  onChange={(e) => setElearningStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date de fin</Label>
                <Input
                  type="date"
                  value={elearningEndDate}
                  onChange={(e) => setElearningEndDate(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Jours de formation *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        selectedDates.length === 0 && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {formatSelectedDates()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="multiple"
                      selected={selectedDates}
                      onSelect={(dates) => setSelectedDates(dates || [])}
                      locale={fr}
                      weekStartsOn={1}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {schedules.length > 0 && (
                <ScheduleEditor
                  schedules={schedules}
                  onSchedulesChange={setSchedules}
                />
              )}
            </div>
          )}

          {/* Live meetings dates */}
          {originalLives.length > 0 && (
            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Nouvelles dates des lives
              </Label>
              <p className="text-xs text-muted-foreground">
                Définissez les nouvelles dates pour chaque live. Laissez vide pour ne pas inclure un live.
              </p>
              <div className="space-y-3">
                {originalLives.map((live, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{live.title}</p>
                      <p className="text-xs text-muted-foreground">{live.duration_minutes} min</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        className="w-40"
                        value={liveDates[index]?.date || ""}
                        onChange={(e) => {
                          const updated = [...liveDates];
                          updated[index] = { ...updated[index], date: e.target.value };
                          setLiveDates(updated);
                        }}
                      />
                      <Input
                        type="time"
                        className="w-28"
                        value={liveDates[index]?.time || "10:00"}
                        onChange={(e) => {
                          const updated = [...liveDates];
                          updated[index] = { ...updated[index], time: e.target.value };
                          setLiveDates(updated);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleDuplicate} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Duplication...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Dupliquer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateTrainingDialog;
