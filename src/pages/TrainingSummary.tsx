import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { rpc } from "@/lib/supabase-rpc";

import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { formatDateWithDayOfWeek, formatDateLong } from "@/lib/dateFormatters";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SupertiltLogo from "@/components/SupertiltLogo";
import { getGoogleMapsDirectionsUrl, getGoogleMapsEmbedUrl } from "@/lib/googleMaps";

// ── Material Symbol helper ──────────────────────────────────────────────────

function MIcon({
  icon,
  className = "",
  fill = false,
}: {
  icon: string;
  className?: string;
  fill?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {icon}
    </span>
  );
}

// ── Types ───────────────────────────────────────────────────────────────────

interface Training {
  id: string;
  training_name: string;
  client_name: string;
  start_date: string;
  end_date: string | null;
  location: string;
  program_file_url: string | null;
  supports_url: string | null;
  trainer_id: string | null;
  objectives: string[] | null;
  prerequisites: string[] | null;
  format_formation: string | null;
  session_format: string | null;
}

interface Schedule {
  id: string;
  day_date: string;
  start_time: string;
  end_time: string;
}

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  cv_url: string | null;
}

// ── MD3-inspired color palette (Stitch design) ─────────────────────────────

const c = {
  background: "#fff8f0",
  surface: "#fff8f0",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#fcf3e0",
  surfaceContainer: "#f6eddb",
  surfaceContainerHigh: "#f0e7d5",
  surfaceContainerHighest: "#ebe2cf",
  onSurface: "#1f1b10",
  onSurfaceVariant: "#4d4632",
  outlineVariant: "#d1c6ab",
  primary: "#725c00",
  primaryContainer: "#ffd100",
  onPrimaryContainer: "#6f5a00",
  onPrimary: "#ffffff",
  tertiary: "#006972",
  onTertiaryContainer: "#006670",
} as const;

// ── Component ───────────────────────────────────────────────────────────────

const TrainingSummary = () => {
  const { trainingId } = useParams<{ trainingId: string }>();
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8");
  const [training, setTraining] = useState<Training | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [reglementInterieurUrl, setReglementInterieurUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState("infos");

  // Section refs for bottom nav scroll
  const sectionInfos = useRef<HTMLElement>(null);
  const sectionDocuments = useRef<HTMLElement>(null);
  const sectionLieu = useRef<HTMLElement>(null);
  const sectionFormateur = useRef<HTMLElement>(null);

  useEffect(() => {
    if (trainingId) {
      fetchTrainingData();
    }
  }, [trainingId]);

  // Intersection observer for active nav
  useEffect(() => {
    const sections = [
      { ref: sectionInfos, id: "infos" },
      { ref: sectionDocuments, id: "documents" },
      { ref: sectionLieu, id: "lieu" },
      { ref: sectionFormateur, id: "formateur" },
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const match = sections.find((s) => s.ref.current === entry.target);
            if (match) setActiveNav(match.id);
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );

    for (const s of sections) {
      if (s.ref.current) observer.observe(s.ref.current);
    }
    return () => observer.disconnect();
  }, [training]);

  const fetchTrainingData = async () => {
    try {
      const { data: trainingData, error: trainingError } = await rpc.getTrainingSummaryInfo(trainingId!);

      if (trainingError) throw trainingError;
      if (!trainingData) {
        setError("Formation introuvable");
        return;
      }

      setTraining(trainingData);

      const { data: schedulesData } = await rpc.getTrainingSchedulesPublic(trainingId!);
      setSchedules(Array.isArray(schedulesData) ? (schedulesData as Schedule[]) : []);

      if (trainingData.trainer_id) {
        const { data: trainerData } = await rpc.getTrainerPublic(trainingData.trainer_id);
        setTrainer(trainerData);
      }

      const [{ data: settingValue }, { data: mapsKey }] = await Promise.all([
        rpc.getAppSettingPublic("reglement_interieur_url"),
        rpc.getAppSettingPublic("google_maps_api_key"),
      ]);

      if (settingValue) setReglementInterieurUrl(settingValue);
      if (mapsKey) setGoogleMapsApiKey(mapsKey);
    } catch (err) {
      console.error("Error fetching training data:", err);
      setError("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const formatScheduleDate = formatDateWithDayOfWeek;
  const formatTime = (time: string) => time.substring(0, 5);

  const isOnlineLocation = () => {
    if (!training) return false;
    const location = training.location.toLowerCase();
    return (
      location.includes("visio") ||
      location.includes("en ligne") ||
      location.includes("distanciel") ||
      location.includes("zoom") ||
      location.includes("teams") ||
      location.includes("meet") ||
      training.format_formation === "classe_virtuelle" ||
      training.session_format === "distanciel_synchrone" ||
      training.session_format === "distanciel_asynchrone"
    );
  };

  const extractUrlFromLocation = () => {
    if (!training) return null;
    const urlMatch = training.location.match(/(https?:\/\/[^\s]+)/);
    return urlMatch ? urlMatch[0] : null;
  };

  const getDirectionsUrl = () => {
    if (!training) return "";
    return getGoogleMapsDirectionsUrl(training.location);
  };

  const getEventTitle = () => {
    if (!training) return "";
    return `(${training.client_name}) ${training.training_name}`;
  };

  const getSummaryPageUrl = () => {
    return `${window.location.origin}/formation-info/${trainingId}`;
  };

  const getEventDescription = () => {
    const summaryUrl = getSummaryPageUrl();
    let desc = `Formation ${training?.training_name || ""}`;
    if (trainer) {
      desc += `\nFormateur: ${trainer.first_name} ${trainer.last_name}`;
    }
    desc += `\n\nToutes les informations pratiques :\n${summaryUrl}`;
    return desc;
  };

  const generateIcsForDay = (schedule: Schedule) => {
    if (!training) return "";
    const startDate = schedule.day_date.replace(/-/g, "");
    const startTime = schedule.start_time.replace(/:/g, "").substring(0, 4) + "00";
    const endTime = schedule.end_time.replace(/:/g, "").substring(0, 4) + "00";
    const desc = getEventDescription().replace(/\n/g, "\\n");
    const dayLabel = format(parseISO(schedule.day_date), "d MMM", { locale: fr });

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SuperTilt//Formation//FR
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:${startDate}T${startTime}
DTEND:${startDate}T${endTime}
SUMMARY:${getEventTitle()} (${dayLabel})
LOCATION:${training.location}
DESCRIPTION:${desc}
URL:${getSummaryPageUrl()}
END:VEVENT
END:VCALENDAR`;
  };

  const handleAddToAppleCalendar = (schedule: Schedule) => {
    const icsContent = generateIcsForDay(schedule);
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const daySlug = schedule.day_date;
    link.download = `formation-${training?.training_name.replace(/\s+/g, "-").toLowerCase()}-${daySlug}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddToGoogleCalendar = (schedule: Schedule) => {
    if (!training) return;
    const startDate = schedule.day_date.replace(/-/g, "");
    const startTime = schedule.start_time.replace(/:/g, "").substring(0, 4) + "00";
    const endTime = schedule.end_time.replace(/:/g, "").substring(0, 4) + "00";
    const dayLabel = format(parseISO(schedule.day_date), "d MMM", { locale: fr });

    const url = new URL("https://www.google.com/calendar/render");
    url.searchParams.set("action", "TEMPLATE");
    url.searchParams.set("text", `${getEventTitle()} (${dayLabel})`);
    url.searchParams.set("dates", `${startDate}T${startTime}/${startDate}T${endTime}`);
    url.searchParams.set("details", getEventDescription());
    url.searchParams.set("location", training.location);

    window.open(url.toString(), "_blank");
  };

  const handleAddToOutlook = (schedule: Schedule) => {
    if (!training) return;
    const dayLabel = format(parseISO(schedule.day_date), "d MMM", { locale: fr });

    const url = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
    url.searchParams.set("subject", `${getEventTitle()} (${dayLabel})`);
    url.searchParams.set("body", getEventDescription());
    url.searchParams.set("location", training.location);
    url.searchParams.set("startdt", `${schedule.day_date}T${schedule.start_time}`);
    url.searchParams.set("enddt", `${schedule.day_date}T${schedule.end_time}`);

    window.open(url.toString(), "_blank");
  };

  const handleAddToYahoo = (schedule: Schedule) => {
    if (!training) return;
    const startDate = schedule.day_date.replace(/-/g, "");
    const startTime = schedule.start_time.replace(/:/g, "").substring(0, 4) + "00";
    const endTime = schedule.end_time.replace(/:/g, "").substring(0, 4) + "00";
    const dayLabel = format(parseISO(schedule.day_date), "d MMM", { locale: fr });

    const url = new URL("https://calendar.yahoo.com/");
    url.searchParams.set("v", "60");
    url.searchParams.set("title", `${getEventTitle()} (${dayLabel})`);
    url.searchParams.set("st", `${startDate}T${startTime}`);
    url.searchParams.set("et", `${startDate}T${endTime}`);
    url.searchParams.set("desc", getEventDescription());
    url.searchParams.set("in_loc", training.location);

    window.open(url.toString(), "_blank");
  };

  const getWhatsAppUrl = (phone: string) => {
    const cleanPhone = phone.replace(/\s+/g, "").replace(/^0/, "33");
    return `https://wa.me/${cleanPhone}`;
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const isElearning =
    training?.format_formation === "e_learning" ||
    training?.session_format === "distanciel_asynchrone";

  // ── Loading / Error states ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: c.background }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: c.primary }} />
      </div>
    );
  }

  if (error || !training) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: c.background }}>
        <div className="rounded-xl p-6 text-center shadow-sm" style={{ background: c.surfaceContainerLowest, color: c.onSurfaceVariant }}>
          <p>{error || "Formation introuvable"}</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-24" style={{ background: c.background, color: c.onSurface }}>
      {/* TopAppBar */}
      <header
        className="sticky top-0 z-50 flex justify-center items-center px-4 h-16 w-full border-b shadow-sm"
        style={{ background: c.surfaceContainerLowest, borderColor: `${c.outlineVariant}30` }}
      >
        <a href="https://www.supertilt.fr" target="_blank" rel="noopener noreferrer">
          <SupertiltLogo className="h-10" />
        </a>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-6">
        {/* ═══ SECTION: Infos ═══ */}
        <section ref={sectionInfos} className="space-y-4" id="section-infos">
          {/* Badge format */}
          {training.format_formation && (
            <div
              className="inline-flex items-center px-2 py-1 rounded text-xs font-bold uppercase tracking-wider"
              style={{ background: c.primaryContainer, color: c.onPrimaryContainer }}
            >
              {training.format_formation === "e_learning"
                ? "E-LEARNING"
                : training.session_format === "distanciel_synchrone"
                  ? "CLASSE VIRTUELLE"
                  : training.session_format === "distanciel_asynchrone"
                    ? "E-LEARNING ASYNCHRONE"
                    : "FORMATION"}
            </div>
          )}

          <h1
            className="text-3xl font-black leading-tight tracking-tight"
            style={{ color: c.onSurface }}
          >
            {training.training_name}
          </h1>
        </section>

        {/* ═══ Dates / Schedule ═══ */}
        <section className="space-y-4">
          {isElearning ? (
            /* E-learning: single card with date range */
            <div
              className="rounded-xl p-5 shadow-sm border"
              style={{ background: c.surfaceContainerLowest, borderColor: `${c.outlineVariant}30` }}
            >
              <div className="flex items-start gap-4 mb-3">
                <div className="p-3 rounded-lg" style={{ background: c.primaryContainer, color: c.onPrimaryContainer }}>
                  <MIcon icon="school" />
                </div>
                <div>
                  <h2 className="font-black text-xl leading-tight" style={{ color: c.onSurface }}>
                    Période de formation
                  </h2>
                  <p className="text-sm font-medium" style={{ color: c.onSurfaceVariant }}>
                    Du {formatDateLong(training.start_date)}
                    {training.end_date && ` au ${formatDateLong(training.end_date)}`}
                  </p>
                </div>
              </div>
              <p className="text-sm" style={{ color: c.onSurfaceVariant }}>
                Formation en e-learning accessible à votre rythme pendant cette période.
              </p>
            </div>
          ) : schedules.length > 0 ? (
            /* Synchronous: one card per day with calendar dropdown */
            schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="rounded-xl p-5 shadow-sm border"
                style={{ background: c.surfaceContainerLowest, borderColor: `${c.outlineVariant}30` }}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 rounded-lg" style={{ background: c.primaryContainer, color: c.onPrimaryContainer }}>
                    <MIcon icon="calendar_today" />
                  </div>
                  <div>
                    <h2 className="font-black text-xl leading-tight capitalize" style={{ color: c.onSurface }}>
                      {formatScheduleDate(schedule.day_date)}
                    </h2>
                    <p className="text-sm font-medium" style={{ color: c.onSurfaceVariant }}>
                      {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                    </p>
                  </div>
                </div>

                {/* Calendar dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="w-full py-4 rounded-xl font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                      style={{ background: c.primaryContainer, color: c.onPrimaryContainer }}
                    >
                      <MIcon icon="event" />
                      Ajouter à mon agenda
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-56">
                    <DropdownMenuItem onClick={() => handleAddToGoogleCalendar(schedule)}>
                      Google Calendar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddToAppleCalendar(schedule)}>
                      Apple Calendar (iCal)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddToOutlook(schedule)}>
                      Outlook.com
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddToAppleCalendar(schedule)}>
                      Outlook (Desktop)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddToYahoo(schedule)}>
                      Yahoo Calendar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          ) : (
            /* Fallback: simple date display */
            <div
              className="rounded-xl p-5 shadow-sm border"
              style={{ background: c.surfaceContainerLowest, borderColor: `${c.outlineVariant}30` }}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg" style={{ background: c.primaryContainer, color: c.onPrimaryContainer }}>
                  <MIcon icon="calendar_today" />
                </div>
                <div>
                  <h2 className="font-black text-xl leading-tight" style={{ color: c.onSurface }}>
                    {formatDateLong(training.start_date)}
                    {training.end_date && ` - ${formatDateLong(training.end_date)}`}
                  </h2>
                </div>
              </div>
            </div>
          )}

          {/* Timezone info for synchronous */}
          {!isElearning && schedules.length > 0 && (
            <div className="flex items-center gap-2 text-sm px-1" style={{ color: c.onSurfaceVariant }}>
              <MIcon icon="public" className="text-base" />
              <span>Horaires de Paris (Europe/Paris)</span>
              <span>·</span>
              <a
                href="https://www.worldtimebuddy.com/?pl=1&lid=2988507&h=2988507"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: c.primary }}
              >
                Convertir
              </a>
            </div>
          )}
        </section>

        {/* ═══ Objectifs ═══ */}
        {training.objectives && training.objectives.length > 0 && (
          <section
            className="rounded-xl p-5 border shadow-sm space-y-4"
            style={{ background: c.surfaceContainerLowest, borderColor: `${c.outlineVariant}30` }}
          >
            <h2 className="font-black text-lg uppercase tracking-tight" style={{ color: c.onSurface }}>
              Objectifs de la formation
            </h2>
            <ul className="space-y-3">
              {training.objectives.map((objective, index) => (
                <li key={index} className="flex items-start gap-3">
                  <MIcon icon="check_circle" className="text-xl" />
                  <span className="text-sm font-medium leading-snug" style={{ color: c.onSurfaceVariant }}>
                    {objective}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ═══ Prérequis ═══ */}
        {training.prerequisites && training.prerequisites.length > 0 && (
          <section
            className="rounded-xl p-5 border space-y-2"
            style={{ background: c.surfaceContainerLow, borderColor: `${c.outlineVariant}20` }}
          >
            <h2 className="font-black text-sm uppercase tracking-tight flex items-center gap-2" style={{ color: c.onSurface }}>
              <MIcon icon="info" className="text-sm" />
              Prérequis
            </h2>
            <ul className="space-y-1">
              {training.prerequisites.map((prerequisite, index) => (
                <p key={index} className="text-sm leading-relaxed" style={{ color: c.onSurfaceVariant }}>
                  {prerequisite}
                </p>
              ))}
            </ul>
          </section>
        )}

        {/* ═══ SECTION: Lieu ═══ */}
        {training.format_formation !== "e_learning" && (
          <section ref={sectionLieu} id="section-lieu">
            {isOnlineLocation() ? (
              /* Online / Visio */
              <div
                className="rounded-xl p-5 shadow-sm border space-y-4"
                style={{ background: c.surfaceContainerLowest, borderColor: `${c.outlineVariant}30` }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg" style={{ background: c.primaryContainer, color: c.onPrimaryContainer }}>
                    <MIcon icon="videocam" />
                  </div>
                  <div>
                    <h2 className="font-black text-xl leading-tight" style={{ color: c.onSurface }}>
                      Formation à distance
                    </h2>
                  </div>
                </div>
                {extractUrlFromLocation() ? (
                  <a
                    href={extractUrlFromLocation()!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 rounded-xl font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    style={{ background: c.primaryContainer, color: c.onPrimaryContainer }}
                  >
                    <MIcon icon="videocam" />
                    Se connecter à la visio
                  </a>
                ) : (
                  <>
                    <p className="text-base font-medium" style={{ color: c.onSurface }}>{training.location}</p>
                    <p className="text-sm" style={{ color: c.onSurfaceVariant }}>
                      Le lien de connexion vous sera communiqué par email avant la formation.
                    </p>
                  </>
                )}
              </div>
            ) : (
              /* In-person with map */
              <div
                className="rounded-xl overflow-hidden border shadow-sm"
                style={{ background: c.surfaceContainerHighest, borderColor: `${c.outlineVariant}20` }}
              >
                {/* Map embed */}
                <div className="relative h-32">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={getGoogleMapsEmbedUrl(training.location, googleMapsApiKey)}
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(to top, ${c.surfaceContainerHighest}, transparent)` }}
                  />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm">
                    <MIcon icon="location_on" className="text-sm" style={{ color: c.primary }} />
                    <span className="text-xs font-bold">
                      {training.location.split(",").pop()?.trim() || training.location}
                    </span>
                  </div>
                </div>
                <div className="p-4 flex justify-between items-center">
                  <div className="flex-1 pr-4">
                    <p className="text-sm font-bold leading-snug" style={{ color: c.onSurface }}>
                      {training.location}
                    </p>
                  </div>
                  <a
                    href={getDirectionsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-full shadow-md active:scale-90 transition-transform"
                    style={{ background: c.surfaceContainerLowest, color: c.primary }}
                  >
                    <MIcon icon="near_me" />
                  </a>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ═══ SECTION: Documents ═══ */}
        {(training.program_file_url || training.supports_url || reglementInterieurUrl) && (
          <section ref={sectionDocuments} id="section-documents" className="grid grid-cols-2 gap-3">
            {training.program_file_url && (
              <a
                href={training.program_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-4 border rounded-xl transition-colors"
                style={{
                  background: c.surfaceContainerLowest,
                  borderColor: `${c.outlineVariant}30`,
                  color: c.onTertiaryContainer,
                }}
              >
                <MIcon icon="description" className="mb-2" />
                <span className="text-xs font-bold text-center">Consulter le programme</span>
              </a>
            )}
            {training.supports_url && (
              <a
                href={training.supports_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-4 border rounded-xl transition-colors"
                style={{
                  background: c.surfaceContainerLowest,
                  borderColor: `${c.outlineVariant}30`,
                  color: c.onTertiaryContainer,
                }}
              >
                <MIcon icon="folder_open" className="mb-2" />
                <span className="text-xs font-bold text-center">Accéder aux supports</span>
              </a>
            )}
            {reglementInterieurUrl && (
              <a
                href={reglementInterieurUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-4 border rounded-xl transition-colors"
                style={{
                  background: c.surfaceContainerLowest,
                  borderColor: `${c.outlineVariant}30`,
                  color: c.onTertiaryContainer,
                }}
              >
                <MIcon icon="gavel" className="mb-2" />
                <span className="text-xs font-bold text-center">Règlement intérieur</span>
              </a>
            )}
          </section>
        )}

        {/* ═══ SECTION: Formateur ═══ */}
        {trainer && (
          <section
            ref={sectionFormateur}
            id="section-formateur"
            className="rounded-xl p-5 border mb-8"
            style={{ background: c.surfaceContainerLowest, borderColor: `${c.outlineVariant}30` }}
          >
            <div className="flex items-center gap-4 mb-5">
              <div className="relative">
                <Avatar className="w-16 h-16 border-2" style={{ borderColor: c.primaryContainer }}>
                  <AvatarImage src={trainer.photo_url || undefined} className="object-cover" />
                  <AvatarFallback className="text-xl">
                    {getInitials(trainer.first_name, trainer.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div
                  className="absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-white"
                  style={{ background: c.primary, color: c.onPrimary }}
                >
                  <MIcon icon="verified" fill className="text-[10px]" />
                </div>
              </div>
              <div>
                <h3 className="font-black text-lg leading-none" style={{ color: c.onSurface }}>
                  {trainer.first_name} {trainer.last_name}
                </h3>
                <p className="text-sm" style={{ color: c.onSurfaceVariant }}>Votre formateur</p>
              </div>
            </div>

            {/* Contact buttons */}
            <div className="flex flex-wrap gap-2">
              <a
                href={`mailto:${trainer.email}`}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm min-w-[80px] transition-colors"
                style={{ background: c.surfaceContainer, color: c.onSurface }}
              >
                <MIcon icon="mail" className="text-sm" />
                Email
              </a>
              {trainer.phone && (
                <>
                  <a
                    href={`tel:${trainer.phone}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm min-w-[80px] transition-colors"
                    style={{ background: c.surfaceContainer, color: c.onSurface }}
                  >
                    <MIcon icon="call" className="text-sm" />
                    Téléphone
                  </a>
                  <a
                    href={getWhatsAppUrl(trainer.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm min-w-[80px] transition-colors"
                    style={{ background: c.surfaceContainer, color: c.onSurface }}
                  >
                    <MIcon icon="chat" className="text-sm" />
                    WhatsApp
                  </a>
                </>
              )}
              {trainer.linkedin_url && (
                <a
                  href={trainer.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm min-w-[80px] transition-colors"
                  style={{ background: c.surfaceContainer, color: c.onSurface }}
                >
                  <MIcon icon="person" className="text-sm" />
                  LinkedIn
                </a>
              )}
              {trainer.cv_url && (
                <a
                  href={trainer.cv_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm min-w-[80px] transition-colors"
                  style={{ background: c.surfaceContainer, color: c.onSurface }}
                >
                  <MIcon icon="description" className="text-sm" />
                  CV
                </a>
              )}
            </div>

            {/* Contact info */}
            <div className="mt-4 pt-4 border-t text-sm space-y-1" style={{ borderColor: `${c.outlineVariant}30`, color: c.onSurfaceVariant }}>
              <p>En cas de problème le jour de la formation, n'hésitez pas à contacter votre formateur directement.</p>
            </div>
          </section>
        )}
      </main>

      {/* ═══ Bottom Navigation Bar ═══ */}
      <nav
        className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-3 backdrop-blur-md shadow-[0_-2px_10px_rgba(0,0,0,0.05)] border-t"
        style={{
          background: "rgba(255,255,255,0.9)",
          borderColor: `${c.outlineVariant}30`,
          paddingBottom: "env(safe-area-inset-bottom, 12px)",
        }}
      >
        <NavItem
          icon="info"
          label="Infos"
          active={activeNav === "infos"}
          onClick={() => scrollTo(sectionInfos)}
        />
        <NavItem
          icon="description"
          label="Documents"
          active={activeNav === "documents"}
          onClick={() => scrollTo(sectionDocuments)}
        />
        {training.format_formation !== "e_learning" && (
          <NavItem
            icon="location_on"
            label="Lieu"
            active={activeNav === "lieu"}
            onClick={() => scrollTo(sectionLieu)}
          />
        )}
        {trainer && (
          <NavItem
            icon="school"
            label="Formateur"
            active={activeNav === "formateur"}
            onClick={() => scrollTo(sectionFormateur)}
          />
        )}
      </nav>
    </div>
  );
};

// ── Bottom nav item ─────────────────────────────────────────────────────────

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center px-3 py-1 text-[11px] font-semibold transition-transform active:scale-90"
      style={{
        color: active ? "#92750a" : "#9ca3af",
        background: active ? "#fef9c333" : "transparent",
        borderRadius: "0.75rem",
      }}
    >
      <MIcon icon={icon} />
      {label}
    </button>
  );
}

export default TrainingSummary;
