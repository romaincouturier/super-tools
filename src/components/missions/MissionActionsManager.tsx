import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  Plus,
  Trash2,
  GripVertical,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";

interface MissionAction {
  id: string;
  mission_id: string;
  title: string;
  status: string;
  position: number;
}

interface MissionActionsManagerProps {
  missionId: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  todo: { label: "À faire", color: "#6b7280", icon: <Clock className="h-3 w-3" /> },
  in_progress: { label: "En cours", color: "#3b82f6", icon: <ArrowRight className="h-3 w-3" /> },
  done: { label: "Terminé", color: "#22c55e", icon: <CheckCircle2 className="h-3 w-3" /> },
};

const MissionActionsManager = ({ missionId }: MissionActionsManagerProps) => {
  const [actions, setActions] = useState<MissionAction[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchActions = async () => {
    const { data } = await supabase
      .from("mission_actions")
      .select("*")
      .eq("mission_id", missionId)
      .order("position", { ascending: true });
    setActions(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchActions();
  }, [missionId]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const maxPos = actions.length > 0 ? Math.max(...actions.map((a) => a.position)) + 1 : 0;
    const { error } = await supabase.from("mission_actions").insert({
      mission_id: missionId,
      title: newTitle.trim(),
      status: "todo",
      position: maxPos,
    });
    if (error) {
      toastError(toast, error instanceof Error ? error : "Erreur inconnue");
      return;
    }
    setNewTitle("");
    fetchActions();
  };

  const handleStatusChange = async (action: MissionAction) => {
    const order = ["todo", "in_progress", "done"];
    const nextIndex = (order.indexOf(action.status) + 1) % order.length;
    const nextStatus = order[nextIndex];
    await supabase
      .from("mission_actions")
      .update({ status: nextStatus })
      .eq("id", action.id);
    fetchActions();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("mission_actions").delete().eq("id", id);
    fetchActions();
  };

  const grouped = {
    todo: actions.filter((a) => a.status === "todo"),
    in_progress: actions.filter((a) => a.status === "in_progress"),
    done: actions.filter((a) => a.status === "done"),
  };

  return (
    <div className="space-y-4">
      {/* Add new action */}
      <div className="flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nouvelle action..."
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1"
        />
        <Button variant="outline" size="sm" onClick={handleAdd} disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {(["todo", "in_progress", "done"] as const).map((status) => {
          const config = statusConfig[status];
          const items = grouped[status];
          return (
            <div key={status} className="flex-1 min-w-[180px]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                <span className="text-sm font-semibold">{config.label}</span>
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  {items.length}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {items.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center gap-2 p-2 border rounded-lg bg-background hover:shadow-sm transition-shadow group"
                  >
                    <button
                      onClick={() => handleStatusChange(action)}
                      className="shrink-0 hover:opacity-80"
                      title="Changer le statut"
                    >
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                        style={{
                          borderColor: config.color,
                          backgroundColor: status === "done" ? config.color : "transparent",
                        }}
                      >
                        {status === "done" && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                    <span
                      className={`text-sm flex-1 ${status === "done" ? "line-through text-muted-foreground" : ""}`}
                    >
                      {action.title}
                    </span>
                    <button
                      onClick={() => handleDelete(action.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {items.length === 0 && (
                  <div
                    className="border border-dashed rounded-lg p-3 text-center text-xs text-muted-foreground"
                    style={{ borderColor: config.color + "40" }}
                  >
                    —
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MissionActionsManager;
