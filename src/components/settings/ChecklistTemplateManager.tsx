import { useState } from "react";
import { Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronRight, GripVertical, Globe, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useChecklistTemplates,
  useCreateChecklistTemplate,
  useUpdateChecklistTemplate,
  useDeleteChecklistTemplate,
  useCreateChecklistTemplateItem,
  useUpdateChecklistTemplateItem,
  useDeleteChecklistTemplateItem,
} from "@/hooks/useLogisticsChecklist";
import type { ChecklistTemplate, ChecklistTemplateItem, LogisticsEntityType } from "@/types/logistics";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useAuth } from "@/hooks/useAuth";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  mission: "Mission",
  training: "Formation",
};

// ── New template form ──────────────────────────────────────────────────────

function NewTemplateForm({ isAdmin, userId, onClose }: { isAdmin: boolean; userId: string; onClose: () => void }) {
  const { toast } = useToast();
  const createTemplate = useCreateChecklistTemplate();
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState<LogisticsEntityType | "both">("both");
  const [isGlobal, setIsGlobal] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createTemplate.mutateAsync({
        name: trimmed,
        entity_type: entityType === "both" ? null : entityType,
        is_global: isGlobal && isAdmin,
        user_id: isGlobal && isAdmin ? null : userId,
      });
      toast({ title: "Modèle créé" });
      onClose();
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Impossible de créer le modèle.");
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nom du modèle</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Mission longue durée"
            className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type d'entité</Label>
          <Select value={entityType} onValueChange={(v) => setEntityType(v as LogisticsEntityType | "both")}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Missions et formations</SelectItem>
              <SelectItem value="mission">Mission uniquement</SelectItem>
              <SelectItem value="training">Formation uniquement</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {isAdmin && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is-global"
            checked={isGlobal}
            onChange={(e) => setIsGlobal(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="is-global" className="text-xs cursor-pointer">
            Modèle global (visible par toute l'équipe)
          </Label>
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4 mr-1" />Annuler</Button>
        <Button size="sm" onClick={handleSave} disabled={!name.trim() || createTemplate.isPending}>
          <Save className="h-4 w-4 mr-1" />Créer
        </Button>
      </div>
    </div>
  );
}

// ── Template item row ──────────────────────────────────────────────────────

function TemplateItemRow({ item, onDelete }: { item: ChecklistTemplateItem; onDelete: () => void }) {
  const { toast } = useToast();
  const updateItem = useUpdateChecklistTemplateItem();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [dayOffset, setDayOffset] = useState(String(item.day_offset));
  const [notifyDays, setNotifyDays] = useState(item.notify_days_before != null ? String(item.notify_days_before) : "");

  const saveEdit = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    try {
      await updateItem.mutateAsync({
        id: item.id,
        updates: {
          label: trimmed,
          day_offset: parseInt(dayOffset, 10) || 0,
          notify_days_before: notifyDays ? parseInt(notifyDays, 10) || null : null,
        },
      });
      setEditing(false);
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Impossible de modifier.");
    }
  };

  if (editing) {
    return (
      <li className="flex items-start gap-2 rounded border bg-muted/20 p-2">
        <GripVertical className="h-4 w-4 mt-2 text-muted-foreground/40 shrink-0" />
        <div className="flex-1 grid grid-cols-3 gap-2">
          <div className="col-span-3 space-y-1">
            <Label className="text-xs">Label</Label>
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-7 text-sm"
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(false); }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Décalage (jours)</Label>
            <Input
              type="number"
              value={dayOffset}
              onChange={(e) => setDayOffset(e.target.value)}
              placeholder="0"
              className="h-7 text-sm"
              title="-7 = J-7 avant la date de début"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rappel (j avant)</Label>
            <Input
              type="number"
              min="0"
              value={notifyDays}
              onChange={(e) => setNotifyDays(e.target.value)}
              placeholder="—"
              className="h-7 text-sm"
            />
          </div>
          <div className="flex items-end gap-1 justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
            <Button size="icon" className="h-7 w-7" onClick={saveEdit} disabled={updateItem.isPending}><Save className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 group rounded hover:bg-muted/40 px-2 py-1">
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
      <span className="text-sm flex-1">{item.label}</span>
      {item.day_offset !== 0 && (
        <span className="text-xs text-muted-foreground shrink-0">
          {item.day_offset > 0 ? `J+${item.day_offset}` : `J${item.day_offset}`}
        </span>
      )}
      {item.notify_days_before != null && (
        <span className="text-xs text-muted-foreground shrink-0">🔔 {item.notify_days_before}j</span>
      )}
      <Button
        variant="ghost" size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100"
        onClick={() => setEditing(true)}
      ><Pencil className="h-3 w-3" /></Button>
      <Button
        variant="ghost" size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
        onClick={onDelete}
      ><Trash2 className="h-3 w-3" /></Button>
    </li>
  );
}

// ── New item form ──────────────────────────────────────────────────────────

function NewItemForm({ templateId, nextPosition, onClose }: { templateId: string; nextPosition: number; onClose: () => void }) {
  const { toast } = useToast();
  const createItem = useCreateChecklistTemplateItem();
  const [label, setLabel] = useState("");
  const [dayOffset, setDayOffset] = useState("0");
  const [notifyDays, setNotifyDays] = useState("");

  const handleSave = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    try {
      await createItem.mutateAsync({
        template_id: templateId,
        label: trimmed,
        day_offset: parseInt(dayOffset, 10) || 0,
        notify_days_before: notifyDays ? parseInt(notifyDays, 10) || null : null,
        legacy_field: null,
        position: nextPosition,
      });
      setLabel(""); setDayOffset("0"); setNotifyDays("");
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Impossible d'ajouter l'item.");
    }
  };

  return (
    <li className="border rounded-lg p-2 bg-muted/20 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-3 space-y-1">
          <Label className="text-xs">Label</Label>
          <Input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex : Train réservé"
            className="h-7 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Décalage (jours)</Label>
          <Input
            type="number"
            value={dayOffset}
            onChange={(e) => setDayOffset(e.target.value)}
            placeholder="0"
            className="h-7 text-sm"
            title="-7 = J-7 avant la date de début"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rappel (j avant)</Label>
          <Input
            type="number"
            min="0"
            value={notifyDays}
            onChange={(e) => setNotifyDays(e.target.value)}
            placeholder="—"
            className="h-7 text-sm"
          />
        </div>
        <div className="flex items-end gap-1 justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
          <Button size="icon" className="h-7 w-7" onClick={handleSave} disabled={!label.trim() || createItem.isPending}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground px-1">Décalage : 0 = date de début, -7 = J-7 avant le début, 1 = lendemain.</p>
    </li>
  );
}

// ── Template card (collapsible) ───────────────────────────────────────────

function TemplateCard({ template, canEdit }: { template: ChecklistTemplate; canEdit: boolean }) {
  const { toast } = useToast();
  const updateTemplate = useUpdateChecklistTemplate();
  const deleteTemplate = useDeleteChecklistTemplate();
  const deleteItem = useDeleteChecklistTemplateItem();

  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(template.name);
  const [addingItem, setAddingItem] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const items: ChecklistTemplateItem[] = (template.items ?? []).sort((a, b) => a.position - b.position);

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === template.name) { setNameDraft(template.name); setEditingName(false); return; }
    try {
      await updateTemplate.mutateAsync({ id: template.id, updates: { name: trimmed } });
      setEditingName(false);
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Impossible de renommer.");
    }
  };

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <div
          className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/30 select-none"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}

          {editingName && canEdit ? (
            <Input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={saveName}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameDraft(template.name); setEditingName(false); } }}
              className="h-7 text-sm flex-1"
            />
          ) : (
            <span className="text-sm font-medium flex-1">{template.name}</span>
          )}

          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {template.entity_type && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {ENTITY_TYPE_LABELS[template.entity_type] ?? template.entity_type}
              </Badge>
            )}
            {template.is_global
              ? <Badge variant="secondary" className="text-xs px-1.5 py-0 gap-1"><Globe className="h-2.5 w-2.5" />Global</Badge>
              : <Badge variant="outline" className="text-xs px-1.5 py-0 gap-1"><User className="h-2.5 w-2.5" />Personnel</Badge>
            }
            <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
            {canEdit && (
              <>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingName(true)} title="Renommer"><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} title="Supprimer"><Trash2 className="h-3 w-3" /></Button>
              </>
            )}
          </div>
        </div>

        {open && (
          <div className="border-t px-3 py-2 space-y-1">
            <ul className="space-y-0.5">
              {items.map((item) => (
                <TemplateItemRow
                  key={item.id}
                  item={item}
                  onDelete={() => deleteItem.mutateAsync(item.id).catch((err) => toastError(toast, err))}
                />
              ))}
              {items.length === 0 && !addingItem && (
                <li className="text-xs text-muted-foreground py-1 px-2">Aucun item.</li>
              )}
              {addingItem && (
                <NewItemForm
                  templateId={template.id}
                  nextPosition={items.length}
                  onClose={() => setAddingItem(false)}
                />
              )}
            </ul>
            {canEdit && !addingItem && (
              <Button variant="ghost" size="sm" className="text-xs h-7 mt-1" onClick={() => setAddingItem(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Ajouter un item
              </Button>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {template.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les items du modèle seront supprimés. Les checklists déjà importées ne sont pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTemplate.mutateAsync(template.id).catch((err) => toastError(toast, err))}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ChecklistTemplateManager() {
  const { isAdmin } = useModuleAccess();
  const { user } = useAuth({ disableRedirect: true });
  const { data: templates = [], isLoading } = useChecklistTemplates();
  const [addingTemplate, setAddingTemplate] = useState(false);

  const globalTemplates = templates.filter((t) => t.is_global);
  const personalTemplates = templates.filter((t) => !t.is_global);

  if (isLoading) return <div className="flex justify-center py-6"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Modèles de checklist logistique</CardTitle>
              <CardDescription>
                Créez des groupes d'items réutilisables à importer en un clic dans une mission ou formation.
                Le décalage (jours) est calculé à partir de la date de début de l'entité.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddingTemplate(true)} disabled={addingTemplate}>
              <Plus className="h-4 w-4 mr-1" />Nouveau modèle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {addingTemplate && user && (
            <NewTemplateForm
              isAdmin={!!isAdmin}
              userId={user.id}
              onClose={() => setAddingTemplate(false)}
            />
          )}

          {globalTemplates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Modèles globaux</p>
              {globalTemplates.map((t) => (
                <TemplateCard key={t.id} template={t} canEdit={!!isAdmin} />
              ))}
            </div>
          )}

          {personalTemplates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mes modèles</p>
              {personalTemplates.map((t) => (
                <TemplateCard key={t.id} template={t} canEdit={true} />
              ))}
            </div>
          )}

          {templates.length === 0 && !addingTemplate && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun modèle. Cliquez sur "Nouveau modèle" pour commencer.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
