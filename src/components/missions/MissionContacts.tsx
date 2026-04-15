import { useState } from "react";
import { Plus, Trash2, Star, Loader2, User, Phone, Mail, Briefcase } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useMissionContacts,
  useCreateMissionContact,
  useUpdateMissionContact,
  useDeleteMissionContact,
} from "@/hooks/useMissions";
import { MissionContact } from "@/types/missions";

const LANGUAGE_OPTIONS = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
  { value: "zh", label: "中文" },
];

interface MissionContactsProps {
  missionId: string;
}

const MissionContacts = ({ missionId }: MissionContactsProps) => {
  const { toast } = useToast();
  const { data: contacts, isLoading } = useMissionContacts(missionId);
  const createContact = useCreateMissionContact();
  const updateContact = useUpdateMissionContact();
  const deleteContact = useDeleteMissionContact();

  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAddContact = async () => {
    try {
      const isPrimary = !contacts || contacts.length === 0;
      const result = await createContact.mutateAsync({
        mission_id: missionId,
        is_primary: isPrimary,
        language: "fr",
      });
      setEditingId(result.id);
    } catch (err: unknown) {
      toast({ title: "Erreur", description: (err instanceof Error ? err.message : "Erreur inconnue"), variant: "destructive" });
    }
  };

  const handleUpdate = async (contact: MissionContact, field: string, value: string | boolean) => {
    try {
      await updateContact.mutateAsync({
        id: contact.id,
        missionId,
        updates: { [field]: value || null },
      });
    } catch (err: unknown) {
      toast({ title: "Erreur", description: (err instanceof Error ? err.message : "Erreur inconnue"), variant: "destructive" });
    }
  };

  const handleSetPrimary = async (contact: MissionContact) => {
    try {
      await updateContact.mutateAsync({
        id: contact.id,
        missionId,
        updates: { is_primary: true },
      });
      toast({ title: "Contact principal défini" });
    } catch (err: unknown) {
      toast({ title: "Erreur", description: (err instanceof Error ? err.message : "Erreur inconnue"), variant: "destructive" });
    }
  };

  const handleDelete = async (contact: MissionContact) => {
    const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "ce contact";
    if (!confirm(`Supprimer ${name} ?`)) return;
    try {
      await deleteContact.mutateAsync({ id: contact.id, missionId });
      toast({ title: "Contact supprimé" });
    } catch (err: unknown) {
      toast({ title: "Erreur", description: (err instanceof Error ? err.message : "Erreur inconnue"), variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Contacts</h4>
        <Button size="sm" variant="outline" onClick={handleAddContact} disabled={createContact.isPending}>
          {createContact.isPending ? (
            <Spinner className="mr-1" />
          ) : (
            <Plus className="h-4 w-4 mr-1" />
          )}
          Ajouter
        </Button>
      </div>

      {(!contacts || contacts.length === 0) ? (
        <p className="text-sm text-muted-foreground text-center py-3">
          Aucun contact. Ajoutez des contacts pour cette mission.
        </p>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              isEditing={editingId === contact.id}
              onToggleEdit={() => setEditingId(editingId === contact.id ? null : contact.id)}
              onUpdate={handleUpdate}
              onSetPrimary={handleSetPrimary}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ContactCardProps {
  contact: MissionContact;
  isEditing: boolean;
  onToggleEdit: () => void;
  onUpdate: (contact: MissionContact, field: string, value: string | boolean) => void;
  onSetPrimary: (contact: MissionContact) => void;
  onDelete: (contact: MissionContact) => void;
}

const ContactCard = ({ contact, isEditing, onToggleEdit, onUpdate, onSetPrimary, onDelete }: ContactCardProps) => {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  const langLabel = LANGUAGE_OPTIONS.find((l) => l.value === contact.language)?.label || contact.language;

  return (
    <div className={`p-3 rounded-lg border transition-colors ${contact.is_primary ? "border-primary/50 bg-primary/5" : "bg-muted/30"}`}>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => !contact.is_primary && onSetPrimary(contact)}
          className={`shrink-0 ${contact.is_primary ? "text-yellow-500" : "text-muted-foreground/40 hover:text-yellow-400"}`}
          title={contact.is_primary ? "Contact principal" : "Définir comme contact principal"}
        >
          <Star className={`h-4 w-4 ${contact.is_primary ? "fill-current" : ""}`} />
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggleEdit}>
          {name ? (
            <span className="font-medium text-sm">{name}</span>
          ) : (
            <span className="text-sm text-muted-foreground italic">Nouveau contact</span>
          )}
          {contact.role && (
            <span className="text-xs text-muted-foreground ml-2">({contact.role})</span>
          )}
        </div>

        <span className="text-xs text-muted-foreground shrink-0">{langLabel}</span>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-500 hover:text-red-600 shrink-0"
          onClick={() => onDelete(contact)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Compact info when not editing */}
      {!isEditing && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground pl-6 cursor-pointer" onClick={onToggleEdit}>
          {contact.email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {contact.email}
            </span>
          )}
          {contact.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {contact.phone}
            </span>
          )}
          {!contact.email && !contact.phone && (
            <span className="italic">Cliquer pour modifier</span>
          )}
        </div>
      )}

      {/* Edit form */}
      {isEditing && (
        <div className="space-y-2 mt-2 pl-6">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Prénom</Label>
              <Input
                defaultValue={contact.first_name || ""}
                onBlur={(e) => onUpdate(contact, "first_name", e.target.value)}
                placeholder="Prénom"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Nom</Label>
              <Input
                defaultValue={contact.last_name || ""}
                onBlur={(e) => onUpdate(contact, "last_name", e.target.value)}
                placeholder="Nom"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              defaultValue={contact.email || ""}
              onBlur={(e) => onUpdate(contact, "email", e.target.value)}
              placeholder="email@exemple.com"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Téléphone</Label>
              <Input
                defaultValue={contact.phone || ""}
                onBlur={(e) => onUpdate(contact, "phone", e.target.value)}
                placeholder="+33 6 12 34 56 78"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Rôle</Label>
              <Input
                defaultValue={contact.role || ""}
                onBlur={(e) => onUpdate(contact, "role", e.target.value)}
                placeholder="ex: DRH, Responsable formation"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Langue</Label>
            <Select
              value={contact.language || "fr"}
              onValueChange={(v) => onUpdate(contact, "language", v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionContacts;
