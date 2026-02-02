import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, Plus, Calendar, ArrowLeft, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Training {
  id: string;
  start_date: string;
  end_date: string | null;
  training_name: string;
  location: string;
  client_name: string;
  created_at: string;
}

type SortField = "date" | "title" | "client";
type SortOrder = "asc" | "desc";

const Formations = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  
  // Sorting state (for past trainings only)
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  
  // Pagination state (for past trainings only)
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);
  
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

  // Filter trainings
  const upcomingTrainings = useMemo(() => 
    trainings.filter((t) => !isPast(parseISO(t.start_date))),
    [trainings]
  );

  const pastTrainings = useMemo(() => 
    trainings.filter((t) => isPast(parseISO(t.start_date))),
    [trainings]
  );

  // Sort past trainings
  const sortedPastTrainings = useMemo(() => {
    const sorted = [...pastTrainings].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "date":
          comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
          break;
        case "title":
          comparison = a.training_name.localeCompare(b.training_name, "fr");
          break;
        case "client":
          comparison = a.client_name.localeCompare(b.client_name, "fr");
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    return sorted;
  }, [pastTrainings, sortField, sortOrder]);

  // Paginate past trainings
  const paginatedPastTrainings = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedPastTrainings.slice(startIndex, startIndex + pageSize);
  }, [sortedPastTrainings, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedPastTrainings.length / pageSize);

  // Reset to page 1 when filter/sort/pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortField, sortOrder, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "date" ? "desc" : "asc");
    }
  };

  const filteredTrainings = filter === "upcoming" ? upcomingTrainings : paginatedPastTrainings;

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

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {filter === "past" && (
          <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === field ? "text-primary" : "text-muted-foreground"}`} />
        )}
      </div>
    </TableHead>
  );

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
            <div className="flex items-center justify-between">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as "upcoming" | "past")}>
                <TabsList>
                  <TabsTrigger value="upcoming">
                    À venir ({upcomingTrainings.length})
                  </TabsTrigger>
                  <TabsTrigger value="past">
                    Passées ({pastTrainings.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              {/* Pagination controls for past trainings */}
              {filter === "past" && pastTrainings.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Afficher</span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => setPageSize(parseInt(value))}
                    >
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredTrainings.length === 0 && filter === "upcoming" ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Aucune formation à venir</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/formations/new")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Créer votre première formation
                </Button>
              </div>
            ) : filteredTrainings.length === 0 && filter === "past" ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Aucune formation passée</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader field="date">Date</SortableHeader>
                      <SortableHeader field="title">Formation</SortableHeader>
                      <TableHead>Lieu</TableHead>
                      <SortableHeader field="client">Client</SortableHeader>
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

                {/* Pagination footer for past trainings */}
                {filter === "past" && totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, sortedPastTrainings.length)} sur {sortedPastTrainings.length} formations
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm px-2">
                        Page {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Formations;
