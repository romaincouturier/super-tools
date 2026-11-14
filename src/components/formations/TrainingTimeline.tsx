import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay, startOfMonth, addMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskText } from "@/lib/demoMask";

interface TimelineTraining {
  id: string;
  training_name: string;
  client_name?: string | null;
  start_date: string | null;
  end_date?: string | null;
}

const SPAN_DAYS = 90;

export default function TrainingTimeline({ trainings }: { trainings: TimelineTraining[] }) {
  const navigate = useNavigate();
  const { isDemoMode } = useDemoMode();
  const [offset, setOffset] = useState(0);
  const from = addDays(startOfDay(new Date()), -7 + offset);
  const to = addDays(from, SPAN_DAYS);
  const pct = (d: Date) => (differenceInCalendarDays(d, from) / SPAN_DAYS) * 100;

  const blocks = useMemo(() => trainings
    .filter((t) => t.start_date)
    .map((t) => {
      const s = parseISO(t.start_date!);
      const e = t.end_date ? parseISO(t.end_date) : s;
      return { t, s, e };
    })
    .filter(({ s, e }) => e >= from && s < to), [trainings, offset]);

  const months: Date[] = [];
  for (let m = addMonths(startOfMonth(from), 1); m < to; m = addMonths(m, 1)) months.push(m);
  const todayPct = pct(startOfDay(new Date()));

  return (
    <Card className="mb-4">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Ligne de temps des formations</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOffset(offset - 30)} aria-label="Période précédente"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOffset(0)}>Aujourd'hui</Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOffset(offset + 30)} aria-label="Période suivante"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="relative h-10 rounded-md bg-muted overflow-hidden">
          {blocks.map(({ t, s, e }) => {
            const left = Math.max(0, pct(s));
            const right = Math.min(100, pct(addDays(e, 1)));
            const trainingName = isDemoMode ? maskText(t.training_name) : t.training_name;
            const clientName = isDemoMode ? maskText(t.client_name) : t.client_name;
            const label = `${trainingName}${clientName ? ` · ${clientName}` : ""} — ${format(s, "dd/MM/yyyy")}${e > s ? ` au ${format(e, "dd/MM/yyyy")}` : ""}`;
            return (
              <button
                key={t.id}
                type="button"
                title={label}
                onClick={() => navigate(`/formations/${t.id}`)}
                className="absolute top-1 bottom-1 rounded-sm bg-primary/40 border border-primary/70 hover:bg-primary/70 transition-colors"
                style={{ left: `${left}%`, width: `max(${right - left}%, 4px)` }}
              />
            );
          })}
          {todayPct >= 0 && todayPct <= 100 && (
            <div className="absolute top-0 bottom-0 w-px bg-destructive" style={{ left: `${todayPct}%` }} />
          )}
        </div>
        <div className="relative h-4 mt-1 text-[10px] text-muted-foreground">
          {months.map((m) => (
            <span key={m.toISOString()} className="absolute -translate-x-1/2 capitalize" style={{ left: `${pct(m)}%` }}>
              {format(m, "MMM yyyy", { locale: fr })}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
