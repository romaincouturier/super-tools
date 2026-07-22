import { useState, useRef, useEffect } from "react";
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
import {
  useCourses, useCreateCourse, useDeleteCourse, useUpdateCourse, useDuplicateCourse,
  useCourseFolders, useCreateCourseFolder, useRenameCourseFolder, useDeleteCourseFolder, useMoveCourseToFolder,
  useCourseEnrollmentCounts,
  type LmsCourse, type LmsCourseFolder,
} from "@/hooks/useLms";
import { Plus, BookOpen, Clock, Trash2, GraduationCap, Search, BarChart3, Users, HelpCircle, MessageSquare, ClipboardList, Link2, MoreVertical, Copy, Folder, FolderOpen, FolderPlus, ChevronRight, ChevronDown, Pencil, Settings2, Archive, ArchiveRestore, X, Info } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useConfirm } from "@/hooks/useConfirm";
import { useCommunityPendingPosts } from "@/hooks/useCommunityPendingPosts";
import CourseMetaDialog from "@/components/lms/CourseMetaDialog";
import {
  QUICK_VIEWS, EXPERTISE_OPTIONS, ACCESS_OPTIONS, STATUS_OPTIONS,
  DEFAULT_COURSE_META_FILTERS, courseMatchesMetaFilters,
  statusLabel, accessLabel, expertiseLabel,
  type CourseMetaFilters,
} from "@/lib/lmsCourseMeta";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  to_review: "bg-amber-500/10 text-amber-700 border-amber-200",
  archived: "bg-orange-500/10 text-orange-700 border-orange-200",
};

const accessColors: Record<string, string> = {
  gratuit: "bg-sky-500/10 text-sky-700 border-sky-200",
  payant: "bg-violet-500/10 text-violet-700 border-violet-200",
  intra: "bg-slate-500/10 text-slate-700 border-slate-200",
};

const difficultyLabels: Record<string, string> = {
  beginner: "🟢 Débutant",
  intermediate: "🟡 Intermédiaire",
  advanced: "🔴 Avancé",
};

export default function LmsCourses() {
  const navigate = useNavigate();
  const { data: courses = [], isLoading } = useCourses();
  const { data: pendingData } = useCommunityPendingPosts();
  const pendingPerCourse = pendingData?.perCourse ?? {};
  const pendingTotal = pendingData?.total ?? 0;
  const createCourse = useCreateCourse();
  const deleteCourse = useDeleteCourse();
  const updateCourse = useUpdateCourse();
  const duplicateCourse = useDuplicateCourse();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Folders
  const { data: folders = [] } = useCourseFolders();
  const createFolder = useCreateCourseFolder();
  const renameFolder = useRenameCourseFolder();
  const deleteFolder = useDeleteCourseFolder();
  const moveCourse = useMoveCourseToFolder();
  const [activeFolderId, setActiveFolderId] = useState<string | null | "root">(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingFolderId) folderInputRef.current?.select();
  }, [editingFolderId]);

  const rootFolders = folders.filter((f) => !f.parent_id);
  const subFolders = (parentId: string) => folders.filter((f) => f.parent_id === parentId);

  const handleCreateFolder = async (parentId?: string) => {
    const name = newFolderName.trim() || "Nouveau dossier";
    try {
      await createFolder.mutateAsync({ name, parent_id: parentId ?? null });
    } catch (err) {
      toastError(toast, err);
    }
    setNewFolderName("");
  };

  const commitFolderRename = async () => {
    if (!editingFolderId || !editingFolderName.trim()) { setEditingFolderId(null); return; }
    try {
      await renameFolder.mutateAsync({ id: editingFolderId, name: editingFolderName.trim() });
    } catch (err) {
      toastError(toast, err);
    }
    setEditingFolderId(null);
  };

  const handleDeleteFolder = async (id: string) => {
    const ok = await confirm({
      title: "Supprimer ce dossier ?",
      description: "Les cours qu'il contient seront déplacés à la racine.",
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteFolder.mutateAsync(id);
      if (activeFolderId === id) setActiveFolderId("root");
    } catch (err) {
      toastError(toast, err);
    }
  };
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editInputRef.current?.select();
  }, [editingId]);

  const startEdit = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditingTitle(title);
  };

  const commitEdit = async () => {
    if (!editingId || !editingTitle.trim()) { setEditingId(null); return; }
    try {
      await updateCourse.mutateAsync({ id: editingId, title: editingTitle.trim() });
    } catch (err) {
      toastError(toast, err);
    }
    setEditingId(null);
  };
  const [form, setForm] = useState({ title: "", description: "", difficulty_level: "beginner" });

  const { data: enrollmentCounts = {} } = useCourseEnrollmentCounts();
  const [filters, setFilters] = useState<CourseMetaFilters>(DEFAULT_COURSE_META_FILTERS);
  const [metaCourse, setMetaCourse] = useState<LmsCourse | null>(null);

  const hasActiveFilters =
    search.trim() !== "" ||
    filters.view !== "catalogue_actif" ||
    filters.expertise !== "all" ||
    filters.access !== "all" ||
    filters.status !== "all";

  const activeView = QUICK_VIEWS.find((v) => v.key === filters.view);

  const resetFilters = () => {
    setSearch("");
    setFilters(DEFAULT_COURSE_META_FILTERS);
  };

  const toReviewCount = courses.filter((c) => c.status === "to_review").length;
  const archivedCount = courses.filter((c) => c.status === "archived").length;

  const filtered = courses.filter((c) => {
    if (!courseMatchesMetaFilters(c, filters)) return false;
    const matchSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (search.trim()) return true; // search ignores folder filter
    if (activeFolderId === "root") return !c.folder_id;
    if (activeFolderId === null) return true; // "all"
    return c.folder_id === activeFolderId;
  });

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    await createCourse.mutateAsync(form as Record<string, unknown>);
    setForm({ title: "", description: "", difficulty_level: "beginner" });
    setOpen(false);
  };

  const handleDuplicate = async (e: React.MouseEvent, id: string, mode: "structure" | "full") => {
    e.stopPropagation();
    setDuplicatingId(id);
    try {
      await duplicateCourse.mutateAsync({ courseId: id, mode });
      toast({ title: mode === "full" ? "Cours dupliqué avec contenus" : "Structure dupliquée" });
    } catch (err) {
      toastError(toast, err);
    }
    setDuplicatingId(null);
  };

  const handleArchiveToggle = async (e: React.MouseEvent, course: LmsCourse) => {
    e.stopPropagation();
    const isArchived = course.status === "archived";
    try {
      await updateCourse.mutateAsync({ id: course.id, status: isArchived ? "draft" : "archived" });
      toast({ title: isArchived ? "Cours restauré en brouillon" : "Cours archivé" });
    } catch (err) {
      toastError(toast, err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "Supprimer cet e-learning ?",
      description: "Cette action supprimera définitivement le cours et tout son contenu (leçons, blocs, quiz). Elle est irréversible.",
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    await deleteCourse.mutateAsync(id);
  };

  const stats = {
    total: courses.length,
    published: courses.filter((c) => c.status === "published").length,
    totalMinutes: courses.reduce((acc, c) => acc + (c.estimated_duration_minutes || 0), 0),
  };

  return (
    <ModuleLayout>
      <ConfirmDialog />
      <CourseMetaDialog course={metaCourse} onClose={() => setMetaCourse(null)} />
      <div className="flex h-full">

        {/* Folder sidebar */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r bg-muted/30 p-3 gap-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dossiers</span>
            <button
              onClick={() => handleCreateFolder()}
              title="Nouveau dossier"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <FolderPlus size={14} />
            </button>
          </div>

          {/* All courses */}
          <button
            onClick={() => setActiveFolderId(null)}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm w-full text-left transition-colors ${activeFolderId === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            <BookOpen size={14} /> Tous les cours
            <span className="ml-auto text-xs opacity-60">{courses.length}</span>
          </button>

          {/* Root = uncategorized */}
          <button
            onClick={() => setActiveFolderId("root")}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm w-full text-left transition-colors ${activeFolderId === "root" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            <Folder size={14} /> Sans dossier
            <span className="ml-auto text-xs opacity-60">{courses.filter((c) => !c.folder_id).length}</span>
          </button>

          {rootFolders.map((folder) => {
            const subs = subFolders(folder.id);
            const isExpanded = expandedFolders.has(folder.id);
            const courseCount = courses.filter((c) => c.folder_id === folder.id).length;
            return (
              <div key={folder.id}>
                <div className={`group flex items-center gap-1 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${activeFolderId === folder.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  <button
                    className="flex items-center gap-1.5 flex-1 text-left"
                    onClick={() => setActiveFolderId(folder.id)}
                  >
                    {subs.length > 0 && (
                      <span onClick={(e) => { e.stopPropagation(); setExpandedFolders((s) => { const n = new Set(s); n.has(folder.id) ? n.delete(folder.id) : n.add(folder.id); return n; }); }}>
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                    )}
                    {editingFolderId === folder.id ? (
                      <input
                        ref={folderInputRef}
                        className="flex-1 bg-transparent border-b border-current outline-none text-sm"
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onBlur={commitFolderRename}
                        onKeyDown={(e) => { if (e.key === "Enter") commitFolderRename(); if (e.key === "Escape") setEditingFolderId(null); }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <FolderOpen size={14} />
                        <span className="flex-1 truncate">{folder.name}</span>
                        <span className="text-xs opacity-60">{courseCount}</span>
                      </>
                    )}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-black/10" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical size={12} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name); }}>
                        Renommer
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCreateFolder(folder.id)}>
                        <FolderPlus size={13} className="mr-2" /> Sous-dossier
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteFolder(folder.id)}>
                        <Trash2 size={13} className="mr-2" /> Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {isExpanded && subs.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveFolderId(sub.id)}
                    className={`flex items-center gap-2 pl-7 pr-2 py-1.5 rounded-md text-sm w-full text-left transition-colors ${activeFolderId === sub.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    <Folder size={13} />
                    <span className="flex-1 truncate">{sub.name}</span>
                    <span className="text-xs opacity-60">{courses.filter((c) => c.folder_id === sub.id).length}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </aside>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
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
              <BarChart3 className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.published}</p>
                <p className="text-sm text-muted-foreground">Publiés</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Clock className="w-8 h-8 text-accent-foreground" />
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/lms/apprenants")}>
              <Users className="w-4 h-4 mr-2" /> Apprenants
            </Button>
            <Button variant="outline" onClick={() => navigate("/lms/communautes")} className="relative">
              <MessageSquare className="w-4 h-4 mr-2" /> Communautés
              {pendingTotal > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 min-w-[18px]">
                  {pendingTotal}
                </span>
              )}
            </Button>
            <Button variant="outline" onClick={() => navigate("/lms/faq")}>
              <HelpCircle className="w-4 h-4 mr-2" /> FAQ
            </Button>
            <Button variant="outline" onClick={() => navigate("/lms/deposits")}>
              <ClipboardList className="w-4 h-4 mr-2" /> Travaux déposés
            </Button>
            <Button variant="outline" onClick={() => navigate("/lms/binomes")}>
              <Link2 className="w-4 h-4 mr-2" /> Binômes
            </Button>
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
        </div>

        {/* Mobile folder navigation (hidden on lg where sidebar is visible) */}
        {folders.length > 0 && (
          <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setActiveFolderId(null)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${activeFolderId === null ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              <BookOpen size={13} /> Tous
            </button>
            <button
              onClick={() => setActiveFolderId("root")}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${activeFolderId === "root" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              <Folder size={13} /> Sans dossier
            </button>
            {rootFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setActiveFolderId(folder.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${activeFolderId === folder.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                <FolderOpen size={13} /> {folder.name}
              </button>
            ))}
            <button
              onClick={() => handleCreateFolder()}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border border-dashed border-border hover:bg-muted transition-colors"
              title="Nouveau dossier"
            >
              <FolderPlus size={13} />
            </button>
          </div>
        )}

        {/* Vues rapides + filtres */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {QUICK_VIEWS.map((v) => {
              const isActive = filters.view === v.key;
              const count = v.key === "a_verifier" ? toReviewCount : v.key === "archives" ? archivedCount : null;
              return (
                <button
                  key={v.key}
                  onClick={() => setFilters({ ...filters, view: v.key })}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${isActive ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                >
                  {v.label}
                  {count !== null && count > 0 && (
                    <span className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] ${v.key === "a_verifier" ? "bg-amber-500 text-white" : isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {activeView && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">Affichage : {activeView.label}</span> — {activeView.hint}
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filters.expertise} onValueChange={(v) => setFilters({ ...filters, expertise: v })}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Expertise" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les expertises</SelectItem>
                {EXPERTISE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.access} onValueChange={(v) => setFilters({ ...filters, access: v })}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Accès" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les accès</SelectItem>
                {ACCESS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="w-4 h-4 mr-1" /> Réinitialiser les filtres
              </Button>
            )}
          </div>
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
                {hasActiveFilters
                  ? "Aucun cours ne correspond aux filtres"
                  : "Créez votre premier cours pour commencer"}
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
                    {editingId === course.id ? (
                      <input
                        ref={editInputRef}
                        className="flex-1 text-base font-semibold border-b border-primary bg-transparent outline-none px-0 py-0.5"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <CardTitle
                        className="text-base line-clamp-2 flex items-center gap-2 cursor-text"
                        onDoubleClick={(e) => startEdit(e, course.id, course.title)}
                        title="Double-cliquer pour renommer"
                      >
                        {course.title}
                        {(pendingPerCourse[course.id] ?? 0) > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0" title={`${pendingPerCourse[course.id]} message(s) en attente`}>
                            {pendingPerCourse[course.id]}
                          </Badge>
                        )}
                      </CardTitle>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0 h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                          disabled={duplicatingId === course.id}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={(e) => startEdit(e, course.id, course.title)}>
                          <Pencil className="w-4 h-4 mr-2" /> Renommer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setMetaCourse(course); }}>
                          <Settings2 className="w-4 h-4 mr-2" /> Paramètres
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => handleDuplicate(e, course.id, "structure")}>
                          <Copy className="w-4 h-4 mr-2" /> Dupliquer (structure)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleDuplicate(e, course.id, "full")}>
                          <Copy className="w-4 h-4 mr-2" /> Dupliquer (avec contenus)
                        </DropdownMenuItem>
                        {folders.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                                <Folder className="w-4 h-4 mr-2" /> Déplacer vers
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent onClick={(e) => e.stopPropagation()}>
                                {course.folder_id && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveCourse.mutate({ courseId: course.id, folderId: null }); }}>
                                    <Folder className="w-4 h-4 mr-2" /> Sans dossier
                                  </DropdownMenuItem>
                                )}
                                {folders.map((f) => (
                                  <DropdownMenuItem
                                    key={f.id}
                                    disabled={course.folder_id === f.id}
                                    onClick={(e) => { e.stopPropagation(); moveCourse.mutate({ courseId: course.id, folderId: f.id }); }}
                                  >
                                    {f.parent_id ? <span className="ml-4" /> : null}
                                    <Folder className="w-4 h-4 mr-2" /> {f.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => handleArchiveToggle(e, course)}>
                          {course.status === "archived" ? (
                            <><ArchiveRestore className="w-4 h-4 mr-2" /> Restaurer</>
                          ) : (
                            <><Archive className="w-4 h-4 mr-2" /> Archiver</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => handleDelete(e, course.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {course.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={statusColors[course.status] ?? statusColors.draft}>
                      {statusLabel(course.status)}
                    </Badge>
                    <Badge variant="outline" className={accessColors[course.access_type ?? "gratuit"]}>
                      {accessLabel(course.access_type)}
                    </Badge>
                    {expertiseLabel(course.expertise) && (
                      <Badge variant="outline">{expertiseLabel(course.expertise)}</Badge>
                    )}
                    <Badge variant="outline">
                      {difficultyLabels[course.difficulty_level || "beginner"]}
                    </Badge>
                    {course.estimated_duration_minutes > 0 && (
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        {course.estimated_duration_minutes} min
                      </Badge>
                    )}
                    {(enrollmentCounts[course.id] ?? 0) > 0 && (
                      <Badge variant="outline" title="Apprenants inscrits">
                        <Users className="w-3 h-3 mr-1" />
                        {enrollmentCounts[course.id]}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
        </div>
      </div>
    </ModuleLayout>
  );
}
