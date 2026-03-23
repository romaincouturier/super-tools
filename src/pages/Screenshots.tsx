import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, addDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  Calendar,
  Camera,
  ImageOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const BUCKET = "app-screenshots";

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  formations: "Formations",
  "formation-detail": "Détail formation",
  crm: "CRM",
  missions: "Missions",
  statistiques: "Statistiques",
  medias: "Médiathèque",
  lms: "E-learning",
  catalogue: "Catalogue",
  events: "Évènements",
};

type ViewMode = "desktop" | "mobile";

interface ScreenshotFile {
  name: string;
  slug: string;
  url: string;
}

const Screenshots = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");
  const [screenshots, setScreenshots] = useState<ScreenshotFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Fetch available dates (list top-level folders)
  useEffect(() => {
    fetchAvailableDates();
  }, []);

  // Fetch screenshots for selected date + viewMode
  useEffect(() => {
    fetchScreenshots();
  }, [dateStr, viewMode]);

  const fetchAvailableDates = async () => {
    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      limit: 365,
      sortBy: { column: "name", order: "desc" },
    });

    if (!error && data) {
      const dates = data
        .filter((item) => item.name.match(/^\d{4}-\d{2}-\d{2}$/))
        .map((item) => item.name);
      setAvailableDates(dates);

      // If today has no screenshots, jump to the most recent date
      if (dates.length > 0 && !dates.includes(dateStr)) {
        setSelectedDate(parseISO(dates[0]));
      }
    }
  };

  const fetchScreenshots = async () => {
    setLoading(true);
    setSelectedSlug(null);

    const folderPath = `${dateStr}/${viewMode}`;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(folderPath, { limit: 50, sortBy: { column: "name", order: "asc" } });

    if (error || !data) {
      setScreenshots([]);
      setLoading(false);
      return;
    }

    const files: ScreenshotFile[] = data
      .filter((f) => f.name.endsWith(".png"))
      .map((f) => {
        const slug = f.name.replace(".png", "");
        const { data: urlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(`${folderPath}/${f.name}`);
        return {
          name: f.name,
          slug,
          url: urlData.publicUrl,
        };
      });

    setScreenshots(files);
    setLoading(false);
  };

  const goToPrevDay = () => {
    const idx = availableDates.indexOf(dateStr);
    if (idx >= 0 && idx < availableDates.length - 1) {
      setSelectedDate(parseISO(availableDates[idx + 1]));
    } else {
      setSelectedDate(subDays(selectedDate, 1));
    }
  };

  const goToNextDay = () => {
    const idx = availableDates.indexOf(dateStr);
    if (idx > 0) {
      setSelectedDate(parseISO(availableDates[idx - 1]));
    } else {
      setSelectedDate(addDays(selectedDate, 1));
    }
  };

  const selectedScreenshot = useMemo(
    () => screenshots.find((s) => s.slug === selectedSlug),
    [screenshots, selectedSlug],
  );

  const dateLabel = format(selectedDate, "EEEE d MMMM yyyy", { locale: fr });
  const hasScreenshots = screenshots.length > 0;

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Camera className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Screenshots</h1>
          <p className="text-muted-foreground text-sm">
            Évolution visuelle de l'application jour après jour
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={goToPrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[220px] justify-start gap-2">
                <Calendar className="h-4 w-4" />
                <span className="capitalize">{dateLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={fr}
                modifiers={{
                  hasScreenshot: availableDates.map((d) => parseISO(d)),
                }}
                modifiersClassNames={{
                  hasScreenshot: "bg-primary/20 font-bold",
                }}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="icon" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center border rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("desktop")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
              viewMode === "desktop"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            <Monitor className="h-4 w-4" />
            Desktop
          </button>
          <button
            onClick={() => setViewMode("mobile")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
              viewMode === "mobile"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            <Smartphone className="h-4 w-4" />
            Mobile
          </button>
        </div>

        {/* Count */}
        {hasScreenshots && (
          <span className="text-sm text-muted-foreground">
            {screenshots.length} capture{screenshots.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !hasScreenshots ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <ImageOff className="h-12 w-12" />
          <p>Aucune capture pour cette date</p>
          {availableDates.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(parseISO(availableDates[0]))}
            >
              Voir la capture la plus récente
            </Button>
          )}
        </div>
      ) : selectedSlug && selectedScreenshot ? (
        /* Full-size view */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedSlug(null)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Retour
            </Button>
            <h2 className="text-lg font-semibold">
              {PAGE_LABELS[selectedScreenshot.slug] || selectedScreenshot.slug}
            </h2>
          </div>
          <div className={cn(
            "rounded-lg border overflow-hidden shadow-sm bg-white",
            viewMode === "mobile" ? "max-w-sm mx-auto" : "",
          )}>
            <img
              src={selectedScreenshot.url}
              alt={selectedScreenshot.slug}
              className="w-full"
              loading="lazy"
            />
          </div>
        </div>
      ) : (
        /* Grid of thumbnails */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {screenshots.map((screenshot) => (
            <Card
              key={screenshot.slug}
              className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden group"
              onClick={() => setSelectedSlug(screenshot.slug)}
            >
              <div className="aspect-video overflow-hidden bg-muted">
                <img
                  src={screenshot.url}
                  alt={screenshot.slug}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
              </div>
              <CardContent className="p-3">
                <p className="font-medium text-sm">
                  {PAGE_LABELS[screenshot.slug] || screenshot.slug}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Screenshots;
