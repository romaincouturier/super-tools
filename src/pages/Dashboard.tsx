import { useState, useEffect, useMemo } from "react";
import { Loader2, Award, FileText, Calendar, ClipboardCheck, TrendingUp, History, Newspaper, ClipboardList, Inbox, BarChart3, Kanban, Briefcase, GripVertical } from "lucide-react";
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
import AppHeader from "@/components/AppHeader";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useModuleAccess, AppModule } from "@/hooks/useModuleAccess";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useUserPreference } from "@/hooks/useUserPreferences";
import { cn } from "@/lib/utils";

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  module: AppModule;
}

const tools: Tool[] = [
  {
    id: "crm",
    name: "CRM",
    description: "Gérer le pipeline commercial et les opportunités",
    icon: <Kanban className="w-10 h-10" />,
    path: "/crm",
    module: "crm",
  },
  {
    id: "missions",
    name: "Missions",
    description: "Suivi des missions de conseil",
    icon: <Briefcase className="w-10 h-10" />,
    path: "/missions",
    module: "missions",
  },
  {
    id: "contenu",
    name: "Contenu",
    description: "Gérer le marketing de contenu",
    icon: <Newspaper className="w-10 h-10" />,
    path: "/contenu",
    module: "contenu",
  },
  {
    id: "micro-devis",
    name: "Micro-devis",
    description: "Créer des devis rapides et simplifiés",
    icon: <FileText className="w-10 h-10" />,
    path: "/micro-devis",
    module: "micro_devis",
  },
  {
    id: "formations",
    name: "Formations",
    description: "Gérer les formations et les participants",
    icon: <Calendar className="w-10 h-10" />,
    path: "/formations",
    module: "formations",
  },
  {
    id: "evaluations",
    name: "Évaluations",
    description: "Analyser les retours des participants",
    icon: <ClipboardCheck className="w-10 h-10" />,
    path: "/evaluations",
    module: "evaluations",
  },
  {
    id: "certificates",
    name: "Certificats",
    description: "Générer et envoyer des certificats de formation",
    icon: <Award className="w-10 h-10" />,
    path: "/certificates",
    module: "certificates",
  },
  {
    id: "ameliorations",
    name: "Améliorations",
    description: "Suivre les axes d'amélioration identifiés",
    icon: <TrendingUp className="w-10 h-10" />,
    path: "/ameliorations",
    module: "ameliorations",
  },
  {
    id: "besoins",
    name: "Besoins",
    description: "Consulter les besoins exprimés par les participants",
    icon: <ClipboardList className="w-10 h-10" />,
    path: "/besoins",
    module: "besoins",
  },
  {
    id: "historique",
    name: "Historique",
    description: "Consulter l'historique des actions",
    icon: <History className="w-10 h-10" />,
    path: "/historique",
    module: "historique",
  },
  {
    id: "emails",
    name: "Emails reçus",
    description: "Consulter les emails entrants",
    icon: <Inbox className="w-10 h-10" />,
    path: "/emails",
    module: "emails",
  },
  {
    id: "statistiques",
    name: "Statistiques",
    description: "Visualiser les statistiques et indicateurs",
    icon: <BarChart3 className="w-10 h-10" />,
    path: "/statistiques",
    module: "statistiques",
  },
];

// Sortable card component
interface SortableToolCardProps {
  tool: Tool;
  onClick: () => void;
}

const SortableToolCard = ({ tool, onClick }: SortableToolCardProps) => {
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

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-2 shadow-md hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group p-5 relative",
        isDragging && "opacity-50 shadow-xl z-50"
      )}
      onClick={onClick}
    >
      {/* Drag handle */}
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
          {tool.icon}
        </div>
        <div>
          <CardTitle className="text-lg">{tool.name}</CardTitle>
          <CardDescription className="text-sm">
            {tool.description}
          </CardDescription>
        </div>
      </div>
    </Card>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { hasAccess, loading: accessLoading } = useModuleAccess();

  // Default order is the order defined in the tools array
  const defaultOrder = tools.map((t) => t.id);

  // Load saved module order from user preferences
  const {
    value: savedOrder,
    loading: prefsLoading,
    save: saveOrder,
  } = useUserPreference<string[]>("module_order", defaultOrder);

  // Local state for the current order (for immediate UI feedback)
  const [moduleOrder, setModuleOrder] = useState<string[]>(defaultOrder);

  // Update local order when saved order loads
  useEffect(() => {
    if (savedOrder && savedOrder.length > 0) {
      // Ensure all current modules are included (in case new modules were added)
      const currentModuleIds = tools.map((t) => t.id);
      const validSavedOrder = savedOrder.filter((id) => currentModuleIds.includes(id));
      const newModules = currentModuleIds.filter((id) => !savedOrder.includes(id));
      setModuleOrder([...validSavedOrder, ...newModules]);
    }
  }, [savedOrder]);

  // Filter tools based on user access and sort by saved order
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

      // Update the full order (including non-accessible modules)
      const newFullOrder = [...moduleOrder];
      const accessibleIds = newAccessibleOrder.map((t) => t.id);

      // Replace accessible module positions in the full order
      let accessibleIndex = 0;
      for (let i = 0; i < newFullOrder.length; i++) {
        if (accessibleIds.includes(newFullOrder[i])) {
          newFullOrder[i] = accessibleIds[accessibleIndex];
          accessibleIndex++;
        }
      }

      setModuleOrder(newFullOrder);

      // Save to database
      try {
        await saveOrder(newFullOrder);
      } catch (error) {
        console.error("Failed to save module order:", error);
      }
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
    <div className="min-h-screen bg-background">
      <AppHeader showOnboarding />

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Tools Section */}
        <section>
          <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>
          {accessibleTools.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <p>Aucun module disponible.</p>
              <p className="text-sm mt-2">Contactez l'administrateur pour obtenir des accès.</p>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {accessibleTools.map((tool) => (
                    <SortableToolCard
                      key={tool.id}
                      tool={tool}
                      onClick={() => navigate(tool.path)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
