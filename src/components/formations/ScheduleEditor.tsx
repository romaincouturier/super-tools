import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, Copy, Trash2, Sun, Sunrise, Sunset } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";

// Session types with predefined times (7h full day, 3.5h half-day)
type SessionType = "full" | "morning" | "afternoon";

export const SESSION_PRESETS: Record<SessionType, { start: string; end: string; label: string; duration: number }> = {
  full: { start: "09:00", end: "17:00", label: "Journée", duration: 7 },
  morning: { start: "09:00", end: "12:30", label: "Matin", duration: 3.5 },
  afternoon: { start: "13:30", end: "17:00", label: "Après-midi", duration: 3.5 },
};

export interface Schedule {
  day_date: string;
  start_time: string;
  end_time: string;
  session_type?: SessionType;
}

interface ScheduleEditorProps {
  schedules: Schedule[];
  onSchedulesChange: (schedules: Schedule[]) => void;
}

const ScheduleEditor = ({ schedules, onSchedulesChange }: ScheduleEditorProps) => {
  const { toast } = useToast();

  // Determine session type from times
  const getSessionTypeFromTimes = (startTime: string, endTime: string): SessionType => {
    // Check if times match a preset
    for (const [type, preset] of Object.entries(SESSION_PRESETS)) {
      if (preset.start === startTime && preset.end === endTime) {
        return type as SessionType;
      }
    }
    // Default to full if custom times
    return "full";
  };

  const updateSessionType = (index: number, sessionType: SessionType) => {
    const preset = SESSION_PRESETS[sessionType];
    const newSchedules = [...schedules];
    newSchedules[index] = {
      ...newSchedules[index],
      start_time: preset.start,
      end_time: preset.end,
      session_type: sessionType,
    };
    onSchedulesChange(newSchedules);
  };

  const updateSchedule = (index: number, field: "start_time" | "end_time", value: string) => {
    const newSchedules = [...schedules];
    newSchedules[index] = { ...newSchedules[index], [field]: value };
    // Clear session_type when manually editing times
    newSchedules[index].session_type = undefined;
    onSchedulesChange(newSchedules);
  };

  // Calculate total duration
  const totalDuration = schedules.reduce((total, schedule) => {
    if (schedule.session_type) {
      return total + SESSION_PRESETS[schedule.session_type].duration;
    }
    // Calculate from times
    const [startH, startM] = schedule.start_time.split(":").map(Number);
    const [endH, endM] = schedule.end_time.split(":").map(Number);
    const hours = (endH * 60 + endM - startH * 60 - startM) / 60;
    // Apply the same normalization: <=4h = 3.5h, >4h = 7h
    return total + (hours <= 4 ? 3.5 : 7);
  }, 0);

  const removeSchedule = (index: number) => {
    if (schedules.length <= 1) {
      toast({
        title: "Impossible de supprimer",
        description: "La formation doit conserver au moins une journée.",
        variant: "destructive",
      });
      return;
    }

    const removedSchedule = schedules[index];
    const newSchedules = schedules.filter((_, i) => i !== index);
    onSchedulesChange(newSchedules);
    
    toast({
      title: "Journée supprimée",
      description: `La journée du ${format(parseISO(removedSchedule.day_date), "d MMMM yyyy", { locale: fr })} a été retirée.`,
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Restore the schedule in the correct position (sorted by date)
            const restoredSchedules = [...newSchedules, removedSchedule].sort(
              (a, b) => a.day_date.localeCompare(b.day_date)
            );
            onSchedulesChange(restoredSchedules);
            toast({
              title: "Journée restaurée",
              description: `La journée du ${format(parseISO(removedSchedule.day_date), "d MMMM yyyy", { locale: fr })} a été restaurée.`,
            });
          }}
        >
          Annuler
        </Button>
      ),
    });
  };

  const replicateFirstDay = () => {
    if (schedules.length <= 1) return;

    const firstSchedule = schedules[0];
    const newSchedules = schedules.map((schedule, _index) => ({
      ...schedule,
      start_time: firstSchedule.start_time,
      end_time: firstSchedule.end_time,
    }));
    onSchedulesChange(newSchedules);
    
    toast({
      title: "Horaires répliqués",
      description: "Les horaires du premier jour ont été appliqués à tous les jours.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horaires par journée
            </CardTitle>
            <CardDescription>
              {schedules.length} session{schedules.length > 1 ? "s" : ""} • {totalDuration}h de formation
            </CardDescription>
          </div>
          {schedules.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={replicateFirstDay}
            >
              <Copy className="h-4 w-4 mr-2" />
              Répliquer le 1er jour
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {schedules.map((schedule, index) => {
            const currentType = schedule.session_type || getSessionTypeFromTimes(schedule.start_time, schedule.end_time);
            return (
              <div
                key={schedule.day_date}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium capitalize truncate">
                    Jour {index + 1} – {format(parseISO(schedule.day_date), "EEEE d MMMM yyyy", { locale: fr })}
                  </p>
                </div>

                {/* Session type toggle */}
                <ToggleGroup
                  type="single"
                  value={currentType}
                  onValueChange={(value) => value && updateSessionType(index, value as SessionType)}
                  className="justify-start"
                >
                  <ToggleGroupItem value="full" aria-label="Journée complète" className="gap-1 text-xs px-2">
                    <Sun className="h-3 w-3" />
                    <span className="hidden sm:inline">Journée</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="morning" aria-label="Matin" className="gap-1 text-xs px-2">
                    <Sunrise className="h-3 w-3" />
                    <span className="hidden sm:inline">Matin</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="afternoon" aria-label="Après-midi" className="gap-1 text-xs px-2">
                    <Sunset className="h-3 w-3" />
                    <span className="hidden sm:inline">Après-midi</span>
                  </ToggleGroupItem>
                </ToggleGroup>

                <div className="flex items-center gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground sr-only sm:not-sr-only">Début</Label>
                    <Input
                      type="time"
                      value={schedule.start_time}
                      onChange={(e) => updateSchedule(index, "start_time", e.target.value)}
                      className="w-24"
                    />
                  </div>
                  <span className="text-muted-foreground">–</span>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground sr-only sm:not-sr-only">Fin</Label>
                    <Input
                      type="time"
                      value={schedule.end_time}
                      onChange={(e) => updateSchedule(index, "end_time", e.target.value)}
                      className="w-24"
                    />
                  </div>
                  {schedules.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeSchedule(index)}
                      title="Supprimer cette journée"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleEditor;
