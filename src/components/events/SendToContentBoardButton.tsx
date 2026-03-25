import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Newspaper, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateWithDayOfWeek } from "@/lib/dateFormatters";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Event } from "@/types/events";

const CARD_TYPES = [
  { value: "article", label: "Article" },
  { value: "post_linkedin", label: "Post LinkedIn" },
  { value: "post_instagram", label: "Post Instagram" },
  { value: "newsletter", label: "Newsletter" },
  { value: "video", label: "Vidéo" },
] as const;

interface SendToContentBoardButtonProps {
  event: Event;
}

export default function SendToContentBoardButton({ event }: SendToContentBoardButtonProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<{ id: string; name: string }[]>([]);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [cardType, setCardType] = useState("article");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("content_columns")
      .select("id, name")
      .order("display_order", { ascending: true })
      .then(({ data }) => {
        const cols = data || [];
        setColumns(cols);
        if (cols.length > 0 && !selectedColumn) {
          setSelectedColumn(cols[0].id);
        }
      });
  }, [open]);

  const handleSend = async () => {
    if (!selectedColumn) return;
    setSending(true);
    try {
      // Get max display_order in target column
      const { data: existing } = await supabase
        .from("content_cards")
        .select("display_order")
        .eq("column_id", selectedColumn)
        .order("display_order", { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

      const locationInfo = event.location
        ? `📍 ${event.location_type === "visio" ? "Visio" : event.location}`
        : "";

      const description = [
        `📅 ${formatDateWithDayOfWeek(event.event_date)}${event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""}`,
        locationInfo,
        event.description ? `\n${event.description}` : "",
        `\n🔗 [Voir l'événement](/events/${event.id})`,
      ]
        .filter(Boolean)
        .join("\n");

      const { error } = await supabase.from("content_cards").insert({
        title: event.title,
        description,
        column_id: selectedColumn,
        display_order: nextOrder,
        card_type: cardType,
        tags: JSON.stringify(["événement"]),
      });

      if (error) throw error;

      toast.success("Carte créée dans le board contenus", {
        action: {
          label: "Voir",
          onClick: () => navigate("/content"),
        },
      });
      setOpen(false);
    } catch (error) {
      console.error("Error sending to content board:", error);
      toast.error("Erreur lors de la création de la carte");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Newspaper className="h-4 w-4 mr-1" />
          Board contenus
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Envoyer au board contenus</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Créer une carte contenu à partir de l'événement <strong>{event.title}</strong>.
          </p>
          <div className="space-y-2">
            <Label>Colonne cible</Label>
            <Select value={selectedColumn} onValueChange={setSelectedColumn}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une colonne..." />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type de contenu</Label>
            <Select value={cardType} onValueChange={setCardType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={sending || !selectedColumn}>
            {sending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Créer la carte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
