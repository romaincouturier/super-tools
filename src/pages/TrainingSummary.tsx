import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  MapPin,
  Calendar,
  Clock,
  Navigation,
  FileText,
  User,
  Mail,
  Phone,
  Loader2,
  ExternalLink,
  Target,
  CheckCircle2,
  ChevronDown,
  Linkedin,
  MessageCircle,
  Video,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SupertiltLogo from "@/components/SupertiltLogo";

interface Training {
  id: string;
  training_name: string;
  start_date: string;
  end_date: string | null;
  location: string;
  program_file_url: string | null;
  trainer_id: string | null;
  objectives: string[] | null;
  prerequisites: string[] | null;
  format_formation: string | null;
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

const TrainingSummary = () => {
  const { trainingId } = useParams<{ trainingId: string }>();
  const [training, setTraining] = useState<Training | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (trainingId) {
      fetchTrainingData();
    }
  }, [trainingId]);

  const fetchTrainingData = async () => {
    try {
      // Fetch training
      const { data: trainingData, error: trainingError } = await supabase
        .from("trainings")
        .select("id, training_name, start_date, end_date, location, program_file_url, trainer_id, objectives, prerequisites, format_formation")
        .eq("id", trainingId)
        .single();

      if (trainingError) throw trainingError;
      if (!trainingData) {
        setError("Formation introuvable");
        return;
      }

      setTraining(trainingData);

      // Fetch schedules
      const { data: schedulesData } = await supabase
        .from("training_schedules")
        .select("*")
        .eq("training_id", trainingId)
        .order("day_date");

      setSchedules(schedulesData || []);

      // Fetch trainer if exists
      if (trainingData.trainer_id) {
        const { data: trainerData } = await supabase
          .from("trainers")
          .select("*")
          .eq("id", trainingData.trainer_id)
          .single();

        setTrainer(trainerData);
      }
    } catch (err) {
      console.error("Error fetching training data:", err);
      setError("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const formatScheduleDate = (dateStr: string) => {
    return format(parseISO(dateStr), "EEEE d MMMM yyyy", { locale: fr });
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  // Check if location is online (visio/distanciel)
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
      training.format_formation === "distanciel"
    );
  };

  // Extract URL from location if it's a link
  const extractUrlFromLocation = () => {
    if (!training) return null;
    const urlMatch = training.location.match(/(https?:\/\/[^\s]+)/);
    return urlMatch ? urlMatch[0] : null;
  };

  const getGoogleMapsUrl = () => {
    if (!training) return "";
    const address = training.location.replace(/ /g, "+");
    return `https://maps.google.com/maps/place/${address}`;
  };

  const getDirectionsUrl = () => {
    if (!training) return "";
    const address = encodeURIComponent(training.location);
    return `https://www.google.com/maps/dir/?api=1&destination=${address}`;
  };

  // Summary page URL to include in calendar invites
  const getSummaryPageUrl = () => {
    return `${window.location.origin}/formation-info/${trainingId}`;
  };

  // Build description for calendar events including summary page link
  const getEventDescription = () => {
    const summaryUrl = getSummaryPageUrl();
    let desc = `Formation ${training?.training_name || ""}`;
    if (trainer) {
      desc += `\nFormateur: ${trainer.first_name} ${trainer.last_name}`;
    }
    desc += `\n\nToutes les informations pratiques :\n${summaryUrl}`;
    return desc;
  };

  // Generate ICS for a single day
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
SUMMARY:${training.training_name} (${dayLabel})
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
    url.searchParams.set("text", `${training.training_name} (${dayLabel})`);
    url.searchParams.set("dates", `${startDate}T${startTime}/${startDate}T${endTime}`);
    url.searchParams.set("details", getEventDescription());
    url.searchParams.set("location", training.location);

    window.open(url.toString(), "_blank");
  };

  const handleAddToOutlook = (schedule: Schedule) => {
    if (!training) return;
    const dayLabel = format(parseISO(schedule.day_date), "d MMM", { locale: fr });

    const url = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
    url.searchParams.set("subject", `${training.training_name} (${dayLabel})`);
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
    url.searchParams.set("title", `${training.training_name} (${dayLabel})`);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !training) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">{error || "Formation introuvable"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center">
            <a href="https://www.supertilt.fr" target="_blank" rel="noopener noreferrer">
              <SupertiltLogo className="h-12" />
            </a>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Training Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">{training.training_name}</h1>
          <p className="text-muted-foreground">
            Bienvenue à cette formation ! Retrouvez ci-dessous toutes les informations pratiques.
          </p>
        </div>

        {/* Program - FIRST */}
        {training.program_file_url && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Programme de formation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <a
                  href={training.program_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Consulter le programme
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Objectives */}
        {training.objectives && training.objectives.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Objectifs de la formation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {training.objectives.map((objective, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Prerequisites */}
        {training.prerequisites && training.prerequisites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Prérequis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {training.prerequisites.map((prerequisite, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary font-medium">•</span>
                    <span>{prerequisite}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Dates and Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {training.format_formation === "e_learning" ? "Période de formation" : "Dates et horaires"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {training.format_formation === "e_learning" ? (
              <div className="space-y-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium">
                    Du {format(parseISO(training.start_date), "d MMMM yyyy", { locale: fr })}
                    {training.end_date &&
                      ` au ${format(parseISO(training.end_date), "d MMMM yyyy", { locale: fr })}`}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Formation en e-learning accessible à votre rythme pendant cette période.
                </p>
              </div>
            ) : schedules.length > 0 ? (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg gap-3"
                  >
                    <div className="flex-1">
                      <div className="font-medium capitalize">
                        {formatScheduleDate(schedule.day_date)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Clock className="h-4 w-4" />
                        {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Ajouter à mon agenda</span>
                          <span className="sm:hidden">Agenda</span>
                          <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => handleAddToGoogleCalendar(schedule)}>
                          <img src="https://www.google.com/favicon.ico" alt="Google" className="h-4 w-4 mr-2" />
                          Google Calendar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddToAppleCalendar(schedule)}>
                          <Calendar className="h-4 w-4 mr-2" />
                          Apple Calendar (iCal)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddToOutlook(schedule)}>
                          <img src="https://outlook.live.com/favicon.ico" alt="Outlook" className="h-4 w-4 mr-2" />
                          Outlook.com
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddToAppleCalendar(schedule)}>
                          <Calendar className="h-4 w-4 mr-2" />
                          Outlook (Desktop)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddToYahoo(schedule)}>
                          <img src="https://www.yahoo.com/favicon.ico" alt="Yahoo" className="h-4 w-4 mr-2" />
                          Yahoo Calendar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <Globe className="h-4 w-4" />
                  <span>Horaires de Paris (Europe/Paris)</span>
                  <span>•</span>
                  <a
                    href="https://www.worldtimebuddy.com/?pl=1&lid=2988507&h=2988507"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Convertir dans mon fuseau horaire
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">
                {format(parseISO(training.start_date), "d MMMM yyyy", { locale: fr })}
                {training.end_date &&
                  ` - ${format(parseISO(training.end_date), "d MMMM yyyy", { locale: fr })}`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Location - Hide for e-learning */}
        {training.format_formation !== "e_learning" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isOnlineLocation() ? (
                  <Video className="h-5 w-5 text-primary" />
                ) : (
                  <MapPin className="h-5 w-5 text-primary" />
                )}
                {isOnlineLocation() ? "Formation à distance" : "Lieu de formation"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isOnlineLocation() ? (
                <>
                  {extractUrlFromLocation() ? (
                    <Button size="lg" asChild className="w-full sm:w-auto">
                      <a
                        href={extractUrlFromLocation()!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Video className="h-5 w-5 mr-2" />
                        Se connecter à la visio
                      </a>
                    </Button>
                  ) : (
                    <>
                      <p className="text-lg">{training.location}</p>
                      <p className="text-sm text-muted-foreground">
                        Le lien de connexion vous sera communiqué par email avant la formation.
                      </p>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <p className="text-lg">{training.location}</p>
                    <Button size="sm" asChild>
                      <a href={getDirectionsUrl()} target="_blank" rel="noopener noreferrer">
                        <Navigation className="h-4 w-4 mr-2" />
                        Venir
                      </a>
                    </Button>
                  </div>

                  {/* Google Maps embed */}
                  <div className="aspect-video w-full rounded-lg overflow-hidden border">
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(training.location)}`}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Trainer Contact - LAST */}
        {trainer && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Votre formateur
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage 
                    src={trainer.photo_url || undefined} 
                    className="object-cover"
                  />
                  <AvatarFallback className="text-xl">
                    {getInitials(trainer.first_name, trainer.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <h3 className="text-xl font-semibold">
                    {trainer.first_name} {trainer.last_name}
                  </h3>
                  
                  {/* Contact buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={`mailto:${trainer.email}`}>
                        <Mail className="h-4 w-4 mr-2" />
                        Email
                      </a>
                    </Button>
                    
                    {trainer.phone && (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <a href={`tel:${trainer.phone}`}>
                            <Phone className="h-4 w-4 mr-2" />
                            Téléphone
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={getWhatsAppUrl(trainer.phone)} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-4 w-4 mr-2" />
                            WhatsApp
                          </a>
                        </Button>
                      </>
                    )}
                    
                    {trainer.linkedin_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={trainer.linkedin_url} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="h-4 w-4 mr-2" />
                          LinkedIn
                        </a>
                      </Button>
                    )}

                    {trainer.cv_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={trainer.cv_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4 mr-2" />
                          CV
                        </a>
                      </Button>
                    )}
                  </div>

                  {/* Contact info details */}
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{trainer.email}</p>
                    {trainer.phone && <p>{trainer.phone}</p>}
                  </div>
                </div>
              </div>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">
                En cas de problème le jour de la formation, n'hésitez pas à contacter votre formateur directement.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground py-8">
          <p>À bientôt pour cette formation !</p>
        </div>
      </main>
    </div>
  );
};

export default TrainingSummary;
