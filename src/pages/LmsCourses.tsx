import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCourses, useCreateCourse, useDeleteCourse, LmsCourse } from "@/hooks/useLms";
import { Plus, BookOpen, Clock, Users, Trash2, GraduationCap, Search, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  archived: "bg-orange-500/10 text-orange-700 border-orange-200",
};

const difficultyLabels: Record<string, string> = {
  beginner: "🟢 Débutant",
  intermediate: "🟡 Intermédiaire",
  advanced: "🔴 Avancé",
};

export default function LmsCourses() {
  const navigate = useNavigate();
  const { data: courses = [], isLoading } = useCourses();
  const createCourse = useCreateCourse();
  const deleteCourse = useDeleteCourse();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", description: "", difficulty_level: "beginner" });

  const filtered = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    await createCourse.mutateAsync(form as any);
    setForm({ title: "", description: "", difficulty_level: "beginner" });
    setOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Supprimer ce cours et tout son contenu ?")) return;
    await deleteCourse.mutateAsync(id);
  };

  const stats = {
    total: courses.length,
    published: courses.filter((c) => c.status === "published").length,
    totalMinutes: courses.reduce((acc, c) => acc + (c.estimated_duration_minutes || 0), 0),
  };

  return (
    <ModuleLayout>
      <div className="container py-6 space-y-6 max-w-7xl">
        <PageHeader
          icon={GraduationCap}
          title="LMS — Cours en ligne"
          backTo="/dashboard"
        />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <BookOpen className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Cours</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <BarChart3 className="w-8 h-8 text-emerald-600" />
              <div>
                <p className="text-2xl font-bold">{stats.published}</p>
                <p className="text-sm text-muted-foreground">Publiés</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Clock className="w-8 h-8 text-amber-600" />
              <div>
                <p className="text-2xl font-bold">{Math.round(stats.totalMinutes / 60)}h</p>
                <p className="text-sm text-muted-foreground">Contenu total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un cours..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Nouveau cours
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un cours</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Titre</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Ex: Prise de parole en public"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Décrivez le contenu du cours..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Niveau</Label>
                  <Select
                    value={form.difficulty_level}
                    onValueChange={(v) => setForm({ ...form, difficulty_level: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">🟢 Débutant</SelectItem>
                      <SelectItem value="intermediate">🟡 Intermédiaire</SelectItem>
                      <SelectItem value="advanced">🔴 Avancé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} disabled={!form.title.trim() || createCourse.isPending} className="w-full">
                  {createCourse.isPending ? "Création..." : "Créer le cours"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Course Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-48" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <GraduationCap className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium text-muted-foreground">Aucun cours</p>
              <p className="text-sm text-muted-foreground mt-1">
                Créez votre premier cours pour commencer
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((course) => (
              <Card
                key={course.id}
                className="cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => navigate(`/lms/${course.id}`)}
              >
                {course.cover_image_url && (
                  <div className="h-32 bg-muted rounded-t-lg overflow-hidden">
                    <img
                      src={course.cover_image_url}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">{course.title}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 shrink-0 h-8 w-8"
                      onClick={(e) => handleDelete(e, course.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {course.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={statusColors[course.status]}>
                      {course.status === "draft" ? "Brouillon" : course.status === "published" ? "Publié" : "Archivé"}
                    </Badge>
                    <Badge variant="outline">
                      {difficultyLabels[course.difficulty_level || "beginner"]}
                    </Badge>
                    {course.estimated_duration_minutes > 0 && (
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        {course.estimated_duration_minutes} min
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ModuleLayout>
  );
}
