import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NetworkContact, WarmthLevel } from "@/types/reseau";

const WARMTH_CONFIG: Record<WarmthLevel, { label: string; color: string }> = {
  hot: { label: "Chaud", color: "bg-red-100 text-red-800" },
  warm: { label: "Tiède", color: "bg-orange-100 text-orange-800" },
  cold: { label: "Froid", color: "bg-blue-100 text-blue-800" },
};

interface ContactsListProps {
  contacts: NetworkContact[];
  onCreate: (input: { name: string; context?: string; warmth: WarmthLevel }) => void;
  onDelete: (id: string) => void;
}

const ContactsList = ({ contacts, onCreate, onDelete }: ContactsListProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [warmth, setWarmth] = useState<WarmthLevel>("warm");

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), context: context.trim() || undefined, warmth });
    setName("");
    setContext("");
    setWarmth("warm");
    setDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">
          Mes contacts ({contacts.length})
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input
                placeholder="Nom du contact"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="Contexte (ex: ancien client, collègue...)"
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
              <Select value={warmth} onValueChange={(v) => setWarmth(v as WarmthLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">Chaud — contact récent, relation forte</SelectItem>
                  <SelectItem value="warm">Tiède — connu mais pas récemment</SelectItem>
                  <SelectItem value="cold">Froid — contact lointain</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} disabled={!name.trim()} className="w-full">
                Ajouter
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun contact pour le moment. Lancez la cartographie pour commencer.
          </p>
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => {
              const w = WARMTH_CONFIG[contact.warmth];
              return (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{contact.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${w.color}`}>
                        {w.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {contact.context && (
                        <span className="text-xs text-muted-foreground truncate">
                          {contact.context}
                        </span>
                      )}
                      {contact.last_contact_date && (
                        <span className="text-xs text-muted-foreground">
                          · Dernier contact : {new Date(contact.last_contact_date).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(contact.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContactsList;
