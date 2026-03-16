import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ModuleLayout from "@/components/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import {
  useCourse, useUpdateCourse,
  useCourseModules, useCreateModule, useUpdateModule, useDeleteModule,
  useModuleLessons, useCourseLessons, useCreateLesson, useUpdateLesson, useDeleteLesson,
  useCourseEnrollments,
  LmsModule, LmsLesson,
} from "@/hooks/useLms";
import {
  Plus, GripVertical, ChevronDown, ChevronRight,
  FileText, Video, HelpCircle, ClipboardList, Trash2, Save,
  Eye, Users, Settings, BookOpen, Pencil,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";
import LmsLessonEditor from "@/components/lms/LessonEditor";
import LmsQuizBuilder from "@/components/lms/QuizBuilder";
import LmsForumSection from "@/components/lms/ForumSection";
import LmsEnrollmentManager from "@/components/lms/EnrollmentManager";

const lessonTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  text: FileText,
  video: Video,
  quiz: HelpCircle,
  assignment: ClipboardList,
};

const lessonTypeLabels: Record<string, string> = {
  text: "Texte",
  video: "Vidéo",
  quiz: "Quiz",
  assignment: "Devoir",
};

function ModuleBlock({ mod, courseId }: { mod: LmsModule; courseId: string }) {
  const [expanded, setExpanded] = useState(true);
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(mod.title);
  const { data: lessons = [] } = useModuleLessons(mod.id);
  const createLesson = useCreateLesson();
  const deleteLesson = useDeleteLesson();
  const updateModule = useUpdateModule();
  const deleteModule = useDeleteModule();
  const [selectedLesson, setSelectedLesson] = useState<LmsLesson | null>(null);
  const [addLessonType, setAddLessonType] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAddLesson = async (type: string) => {
    await createLesson.mutateAsync({
      module_id: mod.id,
      title: `Nouvelle leçon`,
      lesson_type: type,
      position: lessons.length,
    });
    setAddLessonType(null);
    toast({ title: "Leçon ajoutée" });
  };

  const handleSaveTitle = async () => {
    await updateModule.mutateAsync({ id: mod.id, title });
    setEditTitle(false);
  };

  return (
    <Card className="border-l-4 border-l-primary/30">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CardHeader className="py-3">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            {editTitle ? (
              <div className="flex items-center gap-2 flex-1">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8" autoFocus />
                <Button size="sm" variant="ghost" onClick={handleSaveTitle}>
                  <Save className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <CardTitle
                className="text-sm font-medium flex-1 cursor-pointer"
                onClick={() => setEditTitle(true)}
              >
                {mod.title}
              </CardTitle>
            )}
            <Badge variant="outline" className="text-xs">{lessons.length} leçons</Badge>
            {mod.is_prerequisite_gated && (
              <Badge variant="secondary" className="text-xs">🔒 Prérequis</Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => deleteModule.mutateAsync(mod.id)}
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            {lessons.map((lesson) => {
              const Icon = lessonTypeIcons[lesson.lesson_type] || FileText;
              return (
                <div
                  key={lesson.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-md border bg-background hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedLesson(lesson)}
                >
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{lesson.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {lessonTypeLabels[lesson.lesson_type]}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLesson.mutateAsync(lesson.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              );
            })}

            {/* Add lesson buttons */}
            <div className="flex gap-2 pt-2">
              {["text", "video", "quiz", "assignment"].map((type) => {
                const Icon = lessonTypeIcons[type];
                return (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleAddLesson(type)}
                  >
                    <Icon className="w-3.5 h-3.5 mr-1" />
                    {lessonTypeLabels[type]}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Lesson Editor Dialog */}
      {selectedLesson && (
        <Dialog open={!!selectedLesson} onOpenChange={() => setSelectedLesson(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                {selectedLesson.title}
              </DialogTitle>
            </DialogHeader>
            {selectedLesson.lesson_type === "quiz" ? (
              <LmsQuizBuilder lesson={selectedLesson} courseId={courseId} />
            ) : (
              <LmsLessonEditor lesson={selectedLesson} />
            )}
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

export default function LmsCourseBuilder() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { data: course, isLoading } = useCourse(courseId);
  const { data: modules = [] } = useCourseModules(courseId);
  const updateCourse = useUpdateCourse();
  const createModule = useCreateModule();
  const { toast } = useToast();

  const [tab, setTab] = useState("content");

  if (isLoading || !course) {
    return (
      <ModuleLayout>
        <div className="container py-12 text-center text-muted-foreground">Chargement...</div>
      </ModuleLayout>
    );
  }

  const handleAddModule = async () => {
    await createModule.mutateAsync({
      course_id: course.id,
      title: `Module ${modules.length + 1}`,
      position: modules.length,
    });
    toast({ title: "Module ajouté" });
  };

  const togglePublish = async () => {
    const newStatus = course.status === "published" ? "draft" : "published";
    await updateCourse.mutateAsync({ id: course.id, status: newStatus });
    toast({ title: newStatus === "published" ? "Cours publié !" : "Cours repassé en brouillon" });
  };

  return (
    <ModuleLayout>
      <div className="container py-6 max-w-5xl space-y-6">
        <PageHeader
          icon={BookOpen}
          title={course.title}
          subtitle={course.description}
          backTo="/lms"
          actions={
            <>
              <Badge variant="outline" className={course.status === "published" ? "bg-emerald-500/10 text-emerald-700" : ""}>
                {course.status === "published" ? "Publié" : "Brouillon"}
              </Badge>
              <Button variant={course.status === "published" ? "outline" : "default"} onClick={togglePublish}>
                <Eye className="w-4 h-4 mr-2" />
                {course.status === "published" ? "Dépublier" : "Publier"}
              </Button>
            </>
          }
        />

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="content">
              <BookOpen className="w-4 h-4 mr-2" /> Contenu
            </TabsTrigger>
            <TabsTrigger value="enrollments">
              <Users className="w-4 h-4 mr-2" /> Apprenants
            </TabsTrigger>
            <TabsTrigger value="forum">
              <FileText className="w-4 h-4 mr-2" /> Forum
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-2" /> Paramètres
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4 mt-4">
            {modules.map((mod) => (
              <ModuleBlock key={mod.id} mod={mod} courseId={course.id} />
            ))}
            <Button variant="outline" onClick={handleAddModule} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Ajouter un module
            </Button>
          </TabsContent>

          <TabsContent value="enrollments" className="mt-4">
            <LmsEnrollmentManager courseId={course.id} />
          </TabsContent>

          <TabsContent value="forum" className="mt-4">
            <LmsForumSection courseId={course.id} />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <CourseSettings course={course} />
          </TabsContent>
        </Tabs>
      </div>
    </ModuleLayout>
  );
}

function CourseSettings({ course }: { course: { id: string; title: string; description: string | null; difficulty_level: string | null; estimated_duration_minutes: number } }) {
  const updateCourse = useUpdateCourse();
  const [form, setForm] = useState({
    title: course.title,
    description: course.description || "",
    difficulty_level: course.difficulty_level || "beginner",
    estimated_duration_minutes: course.estimated_duration_minutes || 0,
  });
  const { toast } = useToast();

  const handleSave = async () => {
    await updateCourse.mutateAsync({ id: course.id, ...form });
    toast({ title: "Paramètres sauvegardés" });
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <Label>Titre du cours</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Niveau</Label>
            <Select value={form.difficulty_level} onValueChange={(v) => setForm({ ...form, difficulty_level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Débutant</SelectItem>
                <SelectItem value="intermediate">Intermédiaire</SelectItem>
                <SelectItem value="advanced">Avancé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Durée estimée (min)</Label>
            <Input
              type="number"
              value={form.estimated_duration_minutes}
              onChange={(e) => setForm({ ...form, estimated_duration_minutes: +e.target.value })}
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={updateCourse.isPending}>
          <Save className="w-4 h-4 mr-2" /> Sauvegarder
        </Button>
      </CardContent>
    </Card>
  );
}
