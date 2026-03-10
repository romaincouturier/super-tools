import { Loader2, Search, History, Mail, Copy, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DevisHistoryItem } from "@/types/formations";

interface DevisHistoryDialogProps {
  historyDialogOpen: boolean;
  setHistoryDialogOpen: (open: boolean) => void;
  historySearch: string;
  setHistorySearch: (search: string) => void;
  loadingHistory: boolean;
  filteredHistory: DevisHistoryItem[];
  onDuplicate: (item: DevisHistoryItem) => void;
  onDelete: (item: DevisHistoryItem) => void;
}

export default function DevisHistoryDialog({
  historyDialogOpen,
  setHistoryDialogOpen,
  historySearch,
  setHistorySearch,
  loadingHistory,
  filteredHistory,
  onDuplicate,
  onDelete,
}: DevisHistoryDialogProps) {
  return (
    <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="w-4 h-4 mr-2" />
          Historique
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historique des devis envoyés</DialogTitle>
          <DialogDescription>
            Retrouvez les devis envoyés précédemment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par email, formation ou client..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* History list */}
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {historySearch ? "Aucun résultat trouvé" : "Aucun devis envoyé"}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 space-y-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">
                        {item.details?.formation_name || "Formation"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        <span>{item.recipient_email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDuplicate(item)}
                        title="Dupliquer ce devis"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Dupliquer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(item)}
                        title="Supprimer ce devis"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Client : {item.details?.client_name || "—"}</span>
                    <span>Participants : {item.details?.nb_participants || "—"}</span>
                    <span className="capitalize">
                      {item.details?.type_subrogation === "les2" ? "2 versions" :
                       item.details?.type_subrogation === "avec" ? "Avec subrogation" : "Sans subrogation"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
