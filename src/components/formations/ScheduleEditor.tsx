import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, Copy, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Schedule {
  day_date: string;
  start_time: string;
  end_time: string;
}

interface ScheduleEditorProps {
  schedules: Schedule[];
  onSchedulesChange: (schedules: Schedule[]) => void;
}

const ScheduleEditor = ({ schedules, onSchedulesChange }: ScheduleEditorProps) => {
  const { toast } = useToast();

  const calculateEndTime = (startTime: string): string => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const endHours = hours + 8;
    // Handle overflow past 24 hours
    const finalHours = endHours >= 24 ? 23 : endHours;
    const finalMinutes = endHours >= 24 ? 59 : minutes;
    return `${String(finalHours).padStart(2, "0")}:${String(finalMinutes).padStart(2, "0")}`;
  };

  const updateSchedule = (index: number, field: "start_time" | "end_time", value: string) => {
    const newSchedules = [...schedules];
    if (field === "start_time") {
      // Auto-calculate end time (+8h) when start time changes
      newSchedules[index] = { 
        ...newSchedules[index], 
        start_time: value,
        end_time: calculateEndTime(value)
      };
    } else {
      newSchedules[index] = { ...newSchedules[index], [field]: value };
    }
    onSchedulesChange(newSchedules);
  };

  const removeSchedule = (index: number) => {
    if (schedules.length <= 1) {
      toast({
        title: "Impossible de supprimer",
        description: "La formation doit conserver au moins une journée.",
        variant: "destructive",
      });
      return;
    }

    const removedDate = schedules[index].day_date;
    const newSchedules = schedules.filter((_, i) => i !== index);
    onSchedulesChange(newSchedules);
    
    toast({
      title: "Journée supprimée",
      description: `La journée du ${format(parseISO(removedDate), "d MMMM yyyy", { locale: fr })} a été retirée.`,
    });
  };

  const replicateFirstDay = () => {
    if (schedules.length <= 1) return;

    const firstSchedule = schedules[0];
    const newSchedules = schedules.map((schedule, index) => ({
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
              Horaires par journée ({schedules.length} jour{schedules.length > 1 ? "s" : ""})
            </CardTitle>
            <CardDescription>
              Définissez les horaires pour chaque journée de formation
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
        <div className="space-y-4">
          {schedules.map((schedule, index) => (
            <div
              key={schedule.day_date}
              className="flex items-center gap-4 p-4 rounded-lg bg-muted/50"
            >
              <div className="flex-1">
                <p className="font-medium capitalize">
                  {format(parseISO(schedule.day_date), "EEEE d MMMM", { locale: fr })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Début</Label>
                  <Input
                    type="time"
                    value={schedule.start_time}
                    onChange={(e) => updateSchedule(index, "start_time", e.target.value)}
                    className="w-28"
                  />
                </div>
                <span className="mt-6 text-muted-foreground">–</span>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fin</Label>
                  <Input
                    type="time"
                    value={schedule.end_time}
                    onChange={(e) => updateSchedule(index, "end_time", e.target.value)}
                    className="w-28"
                  />
                </div>
                {schedules.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSchedule(index)}
                    title="Supprimer cette journée"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleEditor;
