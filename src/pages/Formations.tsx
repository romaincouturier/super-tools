import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, Plus, Calendar, ArrowLeft } from "lucide-react";
import { format, parseISO, isPast } from "date-fns";
import { fr } from "date-fns/locale";
import SupertiltLogo from "@/components/SupertiltLogo";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface Training {
  id: string;
  start_date: string;
  end_date: string | null;
  training_name: string;
  location: string;
  client_name: string;
  created_at: string;
}

const Formations = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await fetchTrainings();
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchTrainings = async () => {
    const { data, error } = await supabase
      .from("trainings")
      .select("*")
      .order("start_date", { ascending: true });

    if (error) {
      console.error("Error fetching trainings:", error);
      return;
    }

    setTrainings(data || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const filteredTrainings = trainings.filter((training) => {
    const startDate = parseISO(training.start_date);
    const isUpcoming = !isPast(startDate);
    return filter === "upcoming" ? isUpcoming : !isUpcoming;
  });

  const formatDateRange = (startDate: string, endDate: string | null) => {
    const start = parseISO(startDate);
    if (!endDate) {
      return format(start, "d MMMM yyyy", { locale: fr });
    }
    const end = parseISO(endDate);
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${format(start, "d", { locale: fr })} - ${format(end, "d MMMM yyyy", { locale: fr })}`;
    }
    return `${format(start, "d MMM", { locale: fr })} - ${format(end, "d MMM yyyy", { locale: fr })}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-foreground text-background py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SupertiltLogo className="h-10" invert />
            <span className="text-xl font-bold">SuperTools</span>
          </div>
          {user && <UserMenu user={user} onLogout={handleLogout} />}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-6">
        {/* Back button and title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Gestion des formations</h1>
            </div>
          </div>
          <Button onClick={() => navigate("/formations/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une formation
          </Button>
        </div>

        {/* Tabs and table */}
        <Card>
          <CardHeader className="pb-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as "upcoming" | "past")}>
              <TabsList>
                <TabsTrigger value="upcoming">
                  À venir ({trainings.filter(t => !isPast(parseISO(t.start_date))).length})
                </TabsTrigger>
                <TabsTrigger value="past">
                  Passées ({trainings.filter(t => isPast(parseISO(t.start_date))).length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {filteredTrainings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">
                  {filter === "upcoming"
                    ? "Aucune formation à venir"
                    : "Aucune formation passée"}
                </p>
                {filter === "upcoming" && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate("/formations/new")}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Créer votre première formation
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Formation</TableHead>
                    <TableHead>Lieu</TableHead>
                    <TableHead>Client</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrainings.map((training) => (
                    <TableRow
                      key={training.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/formations/${training.id}`)}
                    >
                      <TableCell className="font-medium">
                        {formatDateRange(training.start_date, training.end_date)}
                      </TableCell>
                      <TableCell>{training.training_name}</TableCell>
                      <TableCell>{training.location}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{training.client_name}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Formations;
