import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Calendar, ArrowUpDown, ChevronLeft, ChevronRight, Search, X, MapPin, Building } from "lucide-react";
import { parseISO, isPast, isFuture, isToday, differenceInDays } from "date-fns";
import { formatDateRange } from "@/lib/dateFormatters";
import ModuleLayout from "@/components/ModuleLayout";
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
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

interface Training {
  id: string;
  start_date: string;
  end_date: string | null;
  training_name: string;
  location: string;
  client_name: string;
  created_at: string;
  participant_count?: number;
}

interface TrainingAction {
  id: string;
  training_id: string;
  status: string;
}

interface ParticipantSearchData {
  training_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  sponsor_first_name: string | null;
  sponsor_last_name: string | null;
  sponsor_email: string | null;
}

type SortField = "date" | "title" | "client" | "location";
type SortOrder = "asc" | "desc";

const Formations = () => {
  const isMobile = useIsMobile();
  const { user, loading: authLoading, logout } = useAuth();
  const [dataLoading, setDataLoading] = useState(true);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [trainingActions, setTrainingActions] = useState<TrainingAction[]>([]);
  const [participantsByTraining, setParticipantsByTraining] = useState<Map<string, ParticipantSearchData[]>>(new Map());
  const [filter, setFilter] = useState<"upcoming" | "ongoing" | "past">("upcoming");
  const [searchQuery, setSearchQuery] = useState("");

  // Sorting state (for past trainings only)
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Pagination state (for past trainings only)
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchTrainings();
    }
  }, [user]);

  const fetchTrainings = async () => {
    const [trainingsResult, actionsResult, participantsResult] = await Promise.all([
      supabase
        .from("trainings")
        .select("*")
        .order("start_date", { ascending: true }),
      supabase
        .from("training_actions")
        .select("id, training_id, status")
        .eq("status", "pending"),
      supabase
        .from("training_participants")
        .select("training_id, first_name, last_name, email, sponsor_first_name, sponsor_last_name, sponsor_email"),
    ]);

    if (trainingsResult.error) {
      console.error("Error fetching trainings:", trainingsResult.error);
    } else {
      // Count participants per training & build search index
      const countMap = new Map<string, number>();
      const pMap = new Map<string, ParticipantSearchData[]>();
      (participantsResult.data || []).forEach((p) => {
        countMap.set(p.training_id, (countMap.get(p.training_id) || 0) + 1);
        const arr = pMap.get(p.training_id) || [];
        arr.push(p as ParticipantSearchData);
        pMap.set(p.training_id, arr);
      });
      setParticipantsByTraining(pMap);

      const trainingsWithCount = (trainingsResult.data || []).map((t) => ({
        ...t,
        participant_count: countMap.get(t.id) || 0,
      }));
      setTrainings(trainingsWithCount);
    }

    if (actionsResult.error) {
      console.error("Error fetching actions:", actionsResult.error);
    } else {
      setTrainingActions(actionsResult.data || []);
    }

    setDataLoading(false);
  };

  // Search helper: does a training match the query?
  const matchesSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return () => true;

    return (t: Training) => {
      // Match on training title or client name
      if (t.training_name.toLowerCase().includes(q)) return true;
      if (t.client_name.toLowerCase().includes(q)) return true;

      // Match on training-level sponsor
      const tSponsor = [
        (t as any).sponsor_first_name,
        (t as any).sponsor_last_name,
        (t as any).sponsor_email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (tSponsor.includes(q)) return true;

      // Match on participants & their sponsors
      const participants = participantsByTraining.get(t.id) || [];
      return participants.some((p) => {
        const haystack = [
          p.first_name,
          p.last_name,
          p.email,
          p.sponsor_first_name,
          p.sponsor_last_name,
          p.sponsor_email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    };
  }, [searchQuery, participantsByTraining]);

  // Filter trainings (null start_date = "formation permanente" → always ongoing)
  const isOngoing = (t: Training) => {
    if (!t.start_date) return true; // Permanent e-learning
    const startDate = parseISO(t.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isFuture(startDate) && !isToday(startDate)) return false;
    if (t.end_date) {
      const endDate = parseISO(t.end_date);
      endDate.setHours(23, 59, 59, 999);
      return endDate >= today;
    }
    return isToday(startDate);
  };

  const upcomingTrainings = useMemo(() =>
    trainings.filter((t) => {
      if (!t.start_date) return false; // Permanent → not "upcoming"
      const startDate = parseISO(t.start_date);
      return (isFuture(startDate) && !isToday(startDate)) && matchesSearch(t);
    }),
    [trainings, matchesSearch]
  );

  const ongoingTrainings = useMemo(() =>
    trainings.filter((t) => isOngoing(t) && matchesSearch(t)),
    [trainings, matchesSearch]
  );

  const pastTrainings = useMemo(() =>
    trainings.filter((t) => {
      if (!t.start_date) return false; // Permanent → not "past"
      if (isOngoing(t)) return false;
      const startDate = parseISO(t.start_date);
      if (isFuture(startDate) && !isToday(startDate)) return false;
      return matchesSearch(t);
    }),
    [trainings, matchesSearch]
  );

  // Check if a training has pending actions
  const hasActions = useMemo(() => {
    const actionsByTraining = new Set(trainingActions.map((a) => a.training_id));
    return (trainingId: string) => actionsByTraining.has(trainingId);
  }, [trainingActions]);

  // Sort past trainings
  const sortedPastTrainings = useMemo(() => {
    const sorted = [...pastTrainings].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison = (a.start_date ? new Date(a.start_date).getTime() : 0) - (b.start_date ? new Date(b.start_date).getTime() : 0);
          break;
        case "title":
          comparison = a.training_name.localeCompare(b.training_name, "fr");
          break;
        case "client":
          comparison = a.client_name.localeCompare(b.client_name, "fr");
          break;
        case "location":
          comparison = a.location.localeCompare(b.location, "fr");
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

  // Reset to page 1 when filter/sort/pageSize/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortField, sortOrder, pageSize, searchQuery]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "date" ? "desc" : "asc");
    }
  };

  const filteredTrainings = filter === "upcoming" ? upcomingTrainings : filter === "ongoing" ? ongoingTrainings : paginatedPastTrainings;

  // formatDateRange imported from @/lib/dateFormatters

  // Calculate days until training start
  const getDaysUntilStart = (startDate: string | null) => {
    if (!startDate) return null;
    const start = parseISO(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return differenceInDays(start, today);
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

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ModuleLayout>
      {/* Main content */}
      <main className="max-w-6xl mx-auto p-3 md:p-6">
        {/* Title */}
        <div className="flex items-center justify-between mb-4 md:mb-6 gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0 hidden md:block">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-lg md:text-2xl font-bold truncate">Formations</h1>
            </div>
          </div>
          <Button size={isMobile ? "icon" : "default"} onClick={() => navigate("/formations/new")} className="shrink-0">
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Nouvelle session</span>
          </Button>
        </div>

        {/* Tabs and table */}
        <Card>
          <CardHeader className="pb-3 px-3 md:px-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <Tabs value={filter} onValueChange={(v) => setFilter(v as "upcoming" | "ongoing" | "past")}>
                  <TabsList className="h-8 md:h-9">
                    <TabsTrigger value="upcoming" className="text-xs md:text-sm px-2 md:px-3">
                      À venir ({upcomingTrainings.length})
                    </TabsTrigger>
                    <TabsTrigger value="ongoing" className="text-xs md:text-sm px-2 md:px-3">
                      En cours ({ongoingTrainings.length})
                    </TabsTrigger>
                    <TabsTrigger value="past" className="text-xs md:text-sm px-2 md:px-3">
                      Passées ({pastTrainings.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Pagination controls for past trainings - desktop only */}
                {!isMobile && filter === "past" && pastTrainings.length > 0 && (
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
                )}
              </div>

              {/* Search input - full width on mobile */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isMobile ? "Rechercher…" : "Rechercher participant, commanditaire, formation…"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 w-full md:w-[340px]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            {filteredTrainings.length === 0 && filter === "upcoming" ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? (
                  <>
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Aucune formation à venir ne correspond à « {searchQuery} »</p>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            ) : filteredTrainings.length === 0 && filter === "ongoing" ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? (
                  <>
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Aucune formation en cours ne correspond à « {searchQuery} »</p>
                  </>
                ) : (
                  <>
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Aucune formation en cours</p>
                  </>
                )}
              </div>
            ) : filteredTrainings.length === 0 && filter === "past" ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? (
                  <>
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Aucune formation passée ne correspond à « {searchQuery} »</p>
                  </>
                ) : (
                  <>
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Aucune formation passée</p>
                  </>
                )}
              </div>
            ) : isMobile ? (
              <>
                {/* Mobile: card list */}
                <div className="space-y-3">
                  {filteredTrainings.map((training) => {
                    const daysUntil = getDaysUntilStart(training.start_date);
                    const isUpcoming = filter === "upcoming";

                    return (
                      <div
                        key={training.id}
                        className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 active:bg-muted/70 transition-colors"
                        onClick={() => navigate(`/formations/${training.id}`)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="font-medium text-sm leading-tight">
                            {training.training_name}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {(training.participant_count ?? 0) > 0 && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                {training.participant_count}
                              </Badge>
                            )}
                            {hasActions(training.id) && (
                              <span
                                className="inline-block w-2 h-2 rounded-full bg-warning"
                                title="Actions programmées"
                              />
                            )}
                            {isUpcoming && daysUntil >= 0 && (
                              <Badge
                                variant={daysUntil <= 7 ? "default" : "secondary"}
                                className={`text-xs px-1.5 py-0 ${daysUntil <= 2 ? "bg-warning text-warning-foreground" : ""}`}
                              >
                                J-{daysUntil}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateRange(training.start_date, training.end_date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {training.client_name}
                          </Badge>
                          {training.location && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {training.location}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination footer for past trainings - mobile */}
                {filter === "past" && totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                      {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, sortedPastTrainings.length)} / {sortedPastTrainings.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs px-2">
                        {currentPage}/{totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Desktop: table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader field="date">Date</SortableHeader>
                      <SortableHeader field="client">Client</SortableHeader>
                      <SortableHeader field="title">Formation</SortableHeader>
                      <SortableHeader field="location">Lieu</SortableHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrainings.map((training) => {
                      const daysUntil = getDaysUntilStart(training.start_date);
                      const isUpcoming = filter === "upcoming";

                      return (
                        <TableRow
                          key={training.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/formations/${training.id}`)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {formatDateRange(training.start_date, training.end_date)}
                              {isUpcoming && daysUntil >= 0 && (
                                <Badge
                                  variant={daysUntil <= 7 ? "default" : "secondary"}
                                  className={`text-xs px-1.5 py-0 ${daysUntil <= 2 ? "bg-warning text-warning-foreground" : ""}`}
                                >
                                  J-{daysUntil}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{training.client_name}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {training.training_name}
                              {(training.participant_count ?? 0) > 0 && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                  {training.participant_count}
                                </Badge>
                              )}
                              {hasActions(training.id) && (
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full bg-warning"
                                  title="Actions programmées"
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{training.location}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination footer for past trainings - desktop */}
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
    </ModuleLayout>
  );
};

export default Formations;
