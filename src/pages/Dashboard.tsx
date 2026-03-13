import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Loader2,
  Award,
  FileText,
  Calendar,
  ClipboardCheck,
  TrendingUp,
  History,
  Newspaper,
  ClipboardList,
  Inbox,
  BarChart3,
  Kanban,
  Briefcase,
  GripVertical,
  Target,
  ImageIcon,
  CalendarDays,
  Database,
  Sparkles,
  MessageSquareWarning,
  LifeBuoy,
  Maximize2,
  Square,
  LayoutGrid,
  BookOpen,
  Star,
  LayoutDashboard,
  Users,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useModuleAccess, AppModule } from "@/hooks/useModuleAccess";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useUserPreference } from "@/hooks/useUserPreferences";
import { cn } from "@/lib/utils";
import DailyTodoPanel from "@/components/dashboard/DailyTodoPanel";
import UpcomingCalendarPanel from "@/components/dashboard/UpcomingCalendarPanel";

// ---------- types ----------

type ModuleSize = "full" | "normal" | "mini";

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  module: AppModule;
}

interface ModuleLayout {
  order: string[];
  sizes: Record<string, ModuleSize>;
  favorites?: string[];
}

// ---------- tool definitions ----------

const tools: Tool[] = [
  {
    id: "crm",
    name: "CRM",
    description: "Gérer le pipeline commercial et les opportunités",
    icon: <Kanban />,
    path: "/crm",
    module: "crm",
  },
  {
    id: "missions",
    name: "Missions",
    description: "Suivi des missions de conseil",
    icon: <Briefcase />,
    path: "/missions",
    module: "missions",
  },
  {
    id: "okr",
    name: "OKR",
    description: "Objectifs et Résultats Clés",
    icon: <Target />,
    path: "/okr",
    module: "okr",
  },
  {
    id: "medias",
    name: "Médiathèque",
    description: "Images et vidéos de toutes les missions",
    icon: <ImageIcon />,
    path: "/medias",
    module: "medias",
  },
  {
    id: "events",
    name: "Événements",
    description: "Gérer les événements, images et vidéos",
    icon: <CalendarDays />,
    path: "/events",
    module: "events",
  },
  {
    id: "contenu",
    name: "Contenu",
    description: "Gérer le marketing de contenu",
    icon: <Newspaper />,
    path: "/contenu",
    module: "contenu",
  },
  {
    id: "micro-devis",
    name: "Micro-devis",
    description: "Créer des devis rapides et simplifiés",
    icon: <FileText />,
    path: "/micro-devis",
    module: "micro_devis",
  },
  {
    id: "catalogue",
    name: "Catalogue",
    description: "Gérer le catalogue de formations",
    icon: <BookOpen />,
    path: "/catalogue",
    module: "formations",
  },
  {
    id: "formations",
    name: "Formations",
    description: "Gérer les formations et les participants",
    icon: <Calendar />,
    path: "/formations",
    module: "formations",
  },
  {
    id: "evaluations",
    name: "Évaluations",
    description: "Analyser les retours des participants",
    icon: <ClipboardCheck />,
    path: "/evaluations",
    module: "evaluations",
  },
  {
    id: "certificates",
    name: "Certificats",
    description: "Générer et envoyer des certificats de formation",
    icon: <Award />,
    path: "/certificates",
    module: "certificates",
  },
  {
    id: "ameliorations",
    name: "Améliorations",
    description: "Suivre les axes d'amélioration identifiés",
    icon: <TrendingUp />,
    path: "/ameliorations",
    module: "ameliorations",
  },
  {
    id: "besoins",
    name: "Besoins",
    description: "Consulter les besoins exprimés par les participants",
    icon: <ClipboardList />,
    path: "/besoins",
    module: "besoins",
  },
  {
    id: "historique",
    name: "Historique",
    description: "Consulter l'historique des actions",
    icon: <History />,
    path: "/historique",
    module: "historique",
  },
  {
    id: "emails",
    name: "Emails reçus",
    description: "Consulter les emails entrants",
    icon: <Inbox />,
    path: "/emails",
    module: "emails",
  },
  {
    id: "statistiques",
    name: "Statistiques",
    description: "Visualiser les statistiques et indicateurs",
    icon: <BarChart3 />,
    path: "/statistiques",
    module: "statistiques",
  },
  {
    id: "monitoring",
    name: "Monitoring",
    description: "Surveiller la taille de la base de données",
    icon: <Database />,
    path: "/monitoring",
    module: "monitoring",
  },
  {
    id: "arena",
    name: "AI Arena",
    description: "Discussions multi-agents IA",
    icon: <Sparkles />,
    path: "/arena",
    module: "arena",
  },
  {
    id: "reclamations",
    name: "Réclamations",
    description: "Gérer les réclamations clients (Qualiopi – Indicateur 31)",
    icon: <MessageSquareWarning />,
    path: "/reclamations",
    module: "reclamations",
  },
  {
    id: "support",
    name: "Support",
    description: "Bugs et demandes d'évolution remontés par les utilisateurs",
    icon: <LifeBuoy />,
    path: "/support",
    module: "support",
  },
  {
    id: "reseau",
    name: "Réseau",
    description: "Positionnement & cartographie de votre réseau professionnel",
    icon: <Users />,
    path: "/reseau",
    module: "reseau",
  },
];

// ---------- size helpers ----------

const SIZE_COL_SPAN: Record<ModuleSize, string> = {
  full: "md:col-span-12",
  normal: "md:col-span-4",
  mini: "md:col-span-1",
};

const SIZE_LABELS: Record<ModuleSize, string> = {
  full: "Pleine largeur",
  normal: "Normal",
  mini: "Mini",
};

const SIZES: ModuleSize[] = ["full", "normal", "mini"];

// ---------- size selector button ----------

interface SizeSelectorProps {
  currentSize: ModuleSize;
  onSizeChange: (size: ModuleSize) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

const SizeSelector = ({ currentSize, onSizeChange, isFavorite, onToggleFavorite }: SizeSelectorProps) => (
  <TooltipProvider delayDuration={200}>
    <div className="flex items-center gap-0.5 bg-background/90 backdrop-blur border rounded-md p-0.5 shadow-sm">
      {SIZES.map((size) => {
        const Icon =
          size === "full" ? Maximize2 : size === "normal" ? Square : LayoutGrid;
        return (
          <Tooltip key={size}>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  "p-1 rounded transition-colors",
                  currentSize === size
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onSizeChange(size);
                }}
              >
                <Icon className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {SIZE_LABELS[size]}
            </TooltipContent>
          </Tooltip>
        );
      })}
      <div className="w-px h-3 bg-border mx-0.5" />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "p-1 rounded transition-colors",
              isFavorite
                ? "text-yellow-500 hover:text-yellow-600"
                : "hover:bg-muted text-muted-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
          >
            <Star className={cn("h-3 w-3", isFavorite && "fill-current")} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        </TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
);

// ---------- card components per size ----------

interface SortableToolCardProps {
  tool: Tool;
  size: ModuleSize;
  onClick: () => void;
  onSizeChange: (size: ModuleSize) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

const SortableToolCard = ({
  tool,
  size,
  onClick,
  onSizeChange,
  isFavorite,
  onToggleFavorite,
}: SortableToolCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tool.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (size === "mini") {
    return (
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "border-2 shadow-sm hover:shadow-md hover:border-primary/50 transition-all cursor-pointer group relative p-2",
          SIZE_COL_SPAN.mini,
          isDragging && "opacity-50 shadow-xl z-50"
        )}
        onClick={onClick}
      >
        {/* Controls — appear on hover */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <SizeSelector currentSize={size} onSizeChange={onSizeChange} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />
        </div>
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 right-1 p-0.5 rounded hover:bg-muted cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <div className="p-2 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <span className="[&>svg]:w-5 [&>svg]:h-5">{tool.icon}</span>
          </div>
          <span className="text-xs font-medium leading-tight truncate w-full">
            {tool.name}
          </span>
        </div>
      </Card>
    );
  }

  if (size === "full") {
    return (
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "border-2 shadow-md hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group relative p-5",
          SIZE_COL_SPAN.full,
          isDragging && "opacity-50 shadow-xl z-50"
        )}
        onClick={onClick}
      >
        {/* Controls — appear on hover */}
        <div className="absolute top-2 right-10 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <SizeSelector currentSize={size} onSizeChange={onSizeChange} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />
        </div>
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 p-1 rounded hover:bg-muted cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex items-center gap-6">
          <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
            <span className="[&>svg]:w-12 [&>svg]:h-12">{tool.icon}</span>
          </div>
          <div className="min-w-0">
            <CardTitle className="text-xl">{tool.name}</CardTitle>
            <CardDescription className="text-sm mt-1">
              {tool.description}
            </CardDescription>
          </div>
        </div>
      </Card>
    );
  }

  // Normal (default)
  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-2 shadow-md hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group p-5 relative",
        SIZE_COL_SPAN.normal,
        isDragging && "opacity-50 shadow-xl z-50"
      )}
      onClick={onClick}
    >
      {/* Controls — appear on hover */}
      <div className="absolute top-2 right-10 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <SizeSelector currentSize={size} onSizeChange={onSizeChange} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />
      </div>
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 p-1 rounded hover:bg-muted cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex items-center gap-4">
        <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <span className="[&>svg]:w-10 [&>svg]:h-10">{tool.icon}</span>
        </div>
        <div className="min-w-0">
          <CardTitle className="text-lg">{tool.name}</CardTitle>
          <CardDescription className="text-sm">
            {tool.description}
          </CardDescription>
        </div>
      </div>
    </Card>
  );
};

// ---------- Dashboard ----------

const DEFAULT_SIZE: ModuleSize = "normal";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { hasAccess, loading: accessLoading } = useModuleAccess();

  const defaultOrder = tools.map((t) => t.id);
  const defaultLayout: ModuleLayout = {
    order: defaultOrder,
    sizes: {},
  };

  // Load saved layout (order + sizes) from user preferences
  const {
    value: savedLayout,
    loading: prefsLoading,
    save: saveLayout,
  } = useUserPreference<ModuleLayout>("module_layout", defaultLayout);

  // Local state for immediate UI feedback
  const [moduleOrder, setModuleOrder] = useState<string[]>(defaultOrder);
  const [moduleSizes, setModuleSizes] = useState<Record<string, ModuleSize>>(
    {}
  );
  const [favorites, setFavorites] = useState<string[]>([]);

  // Migrate from old "module_order" preference — read once
  const { value: legacyOrder } = useUserPreference<string[]>(
    "module_order",
    []
  );

  // Restore layout on load
  useEffect(() => {
    if (savedLayout) {
      const currentModuleIds = tools.map((t) => t.id);

      // If savedLayout has an order, use it
      if (savedLayout.order && savedLayout.order.length > 0) {
        const validSavedOrder = savedLayout.order.filter((id) =>
          currentModuleIds.includes(id)
        );
        const newModules = currentModuleIds.filter(
          (id) => !savedLayout.order.includes(id)
        );
        setModuleOrder([...validSavedOrder, ...newModules]);
      } else if (legacyOrder && legacyOrder.length > 0) {
        // Fall back to legacy order
        const validLegacy = legacyOrder.filter((id) =>
          currentModuleIds.includes(id)
        );
        const newModules = currentModuleIds.filter(
          (id) => !legacyOrder.includes(id)
        );
        setModuleOrder([...validLegacy, ...newModules]);
      }

      if (savedLayout.sizes) {
        setModuleSizes(savedLayout.sizes);
      }
      if (savedLayout.favorites) {
        setFavorites(savedLayout.favorites);
      }
    }
  }, [savedLayout, legacyOrder]);

  // Persist layout helper
  const persistLayout = useCallback(
    async (order: string[], sizes: Record<string, ModuleSize>, favs: string[]) => {
      try {
        await saveLayout({ order, sizes, favorites: favs });
      } catch (error) {
        console.error("Failed to save layout:", error);
      }
    },
    [saveLayout]
  );

  // Get size for a module
  const getSize = useCallback(
    (id: string): ModuleSize => moduleSizes[id] || DEFAULT_SIZE,
    [moduleSizes]
  );

  // Change size for a module
  const handleSizeChange = useCallback(
    (id: string, newSize: ModuleSize) => {
      const updated = { ...moduleSizes, [id]: newSize };
      setModuleSizes(updated);
      persistLayout(moduleOrder, updated, favorites);
    },
    [moduleSizes, moduleOrder, favorites, persistLayout]
  );

  // Toggle favorite for a module
  const handleToggleFavorite = useCallback(
    (id: string) => {
      const updated = favorites.includes(id)
        ? favorites.filter((f) => f !== id)
        : [...favorites, id];
      setFavorites(updated);
      persistLayout(moduleOrder, moduleSizes, updated);
    },
    [favorites, moduleOrder, moduleSizes, persistLayout]
  );

  // Filter & sort tools
  const accessibleTools = useMemo(() => {
    const filtered = tools.filter((tool) => hasAccess(tool.module));
    return filtered.sort((a, b) => {
      const indexA = moduleOrder.indexOf(a.id);
      const indexB = moduleOrder.indexOf(b.id);
      return indexA - indexB;
    });
  }, [hasAccess, moduleOrder]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = accessibleTools.findIndex((t) => t.id === active.id);
      const newIndex = accessibleTools.findIndex((t) => t.id === over.id);
      const newAccessibleOrder = arrayMove(accessibleTools, oldIndex, newIndex);

      // Rebuild full order
      const newFullOrder = [...moduleOrder];
      const accessibleIds = newAccessibleOrder.map((t) => t.id);

      let accessibleIndex = 0;
      for (let i = 0; i < newFullOrder.length; i++) {
        if (accessibleIds.includes(newFullOrder[i])) {
          newFullOrder[i] = accessibleIds[accessibleIndex];
          accessibleIndex++;
        }
      }

      setModuleOrder(newFullOrder);
      persistLayout(newFullOrder, moduleSizes, favorites);
    }
  };

  if (loading || accessLoading || prefsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ModuleLayout>
      <div className="max-w-[1400px] mx-auto p-6">
        <PageHeader icon={LayoutDashboard} title="Tableau de bord" />
        <div className="flex gap-6">
          {/* Module grid — left */}
          <section className="flex-1 min-w-0">
            {accessibleTools.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <p>Aucun module disponible.</p>
                <p className="text-sm mt-2">
                  Contactez l'administrateur pour obtenir des accès.
                </p>
              </Card>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={accessibleTools.map((t) => t.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {accessibleTools.map((tool) => (
                      <SortableToolCard
                        key={tool.id}
                        tool={tool}
                        size={getSize(tool.id)}
                        onClick={() => navigate(tool.path)}
                        onSizeChange={(s) => handleSizeChange(tool.id, s)}
                        isFavorite={favorites.includes(tool.id)}
                        onToggleFavorite={() => handleToggleFavorite(tool.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </section>

          {/* Daily TODO + Calendar — right column */}
          <aside className="hidden lg:flex lg:flex-col w-80 shrink-0 gap-4 sticky top-6 self-start max-h-[calc(100vh-6rem)]">
            <Card className="p-4 min-h-0 flex-1 flex flex-col overflow-hidden">
              <UpcomingCalendarPanel />
            </Card>
            <Card className="p-4 min-h-0 flex-1 flex flex-col overflow-hidden">
              <DailyTodoPanel />
            </Card>
          </aside>
        </div>
      </div>
    </ModuleLayout>
  );
};

export default Dashboard;
