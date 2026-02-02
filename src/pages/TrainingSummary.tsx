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
  CalendarPlus,
  FileText,
  User,
  Mail,
  Phone,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import SupertiltLogo from "@/components/SupertiltLogo";

interface Training {
  id: string;
  training_name: string;
  start_date: string;
  end_date: string | null;
  location: string;
  program_file_url: string | null;
  trainer_id: string | null;
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
        .select("id, training_name, start_date, end_date, location, program_file_url, trainer_id")
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

  const generateIcsContent = () => {
    if (!training || schedules.length === 0) return "";

    const events = schedules.map((schedule) => {
      const startDate = schedule.day_date.replace(/-/g, "");
      const startTime = schedule.start_time.replace(/:/g, "").substring(0, 4) + "00";
      const endTime = schedule.end_time.replace(/:/g, "").substring(0, 4) + "00";

      return `BEGIN:VEVENT
DTSTART:${startDate}T${startTime}
DTEND:${startDate}T${endTime}
SUMMARY:${training.training_name}
LOCATION:${training.location}
DESCRIPTION:Formation ${training.training_name}${trainer ? ` - Formateur: ${trainer.first_name} ${trainer.last_name}` : ""}
END:VEVENT`;
    });

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SuperTilt//Formation//FR
CALSCALE:GREGORIAN
METHOD:PUBLISH
${events.join("\n")}
END:VCALENDAR`;
  };

  const handleAddToCalendar = () => {
    const icsContent = generateIcsContent();
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `formation-${training?.training_name.replace(/\s+/g, "-").toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          <div className="flex items-center justify-center mb-4">
            <SupertiltLogo className="h-12" />
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

        {/* Dates and Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Dates et horaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            {schedules.length > 0 ? (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="font-medium capitalize">
                      {formatScheduleDate(schedule.day_date)}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                {format(parseISO(training.start_date), "d MMMM yyyy", { locale: fr })}
                {training.end_date &&
                  ` - ${format(parseISO(training.end_date), "d MMMM yyyy", { locale: fr })}`}
              </p>
            )}

            <Button onClick={handleAddToCalendar} className="mt-4 w-full sm:w-auto">
              <CalendarPlus className="h-4 w-4 mr-2" />
              Ajouter à mon agenda
            </Button>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Lieu de formation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">{training.location}</p>

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

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a href={getGoogleMapsUrl()} target="_blank" rel="noopener noreferrer">
                  <MapPin className="h-4 w-4 mr-2" />
                  Voir sur Google Maps
                </a>
              </Button>
              <Button asChild>
                <a href={getDirectionsUrl()} target="_blank" rel="noopener noreferrer">
                  <Navigation className="h-4 w-4 mr-2" />
                  Venir
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Program */}
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

        {/* Trainer Contact */}
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
                  <AvatarImage src={trainer.photo_url || undefined} />
                  <AvatarFallback className="text-xl">
                    {getInitials(trainer.first_name, trainer.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">
                    {trainer.first_name} {trainer.last_name}
                  </h3>
                  <div className="space-y-1 text-muted-foreground">
                    <a
                      href={`mailto:${trainer.email}`}
                      className="flex items-center gap-2 hover:text-primary transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      {trainer.email}
                    </a>
                    {trainer.phone && (
                      <a
                        href={`tel:${trainer.phone}`}
                        className="flex items-center gap-2 hover:text-primary transition-colors"
                      >
                        <Phone className="h-4 w-4" />
                        {trainer.phone}
                      </a>
                    )}
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
