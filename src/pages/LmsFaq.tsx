import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { GraduationCap, Plus, Pencil, Trash2, HelpCircle, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { useFaqItems, useCreateFaqItem, useUpdateFaqItem, useDeleteFaqItem, type FaqItem } from "@/hooks/useFaq";

function FaqForm({
  initial,
  maxPosition,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<FaqItem>;
  maxPosition: number;
  onSubmit: (v: { question: string; answer: string; position: number }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [position, setPosition] = useState(initial?.position ?? maxPosition);

  return (
    <div className="space-y-4">
      <div>
        <Label>Question</Label>
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex: Je n'arrive pas à accéder à ma formation"
        />
      </div>
      <div>
        <Label>Réponse</Label>
        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Rédigez la réponse visible par les apprenants..."
          rows={4}
        />
      </div>
      <div>
        <Label>Position (ordre d'affichage)</Label>
        <Input
          type="number"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          min={0}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button
          onClick={() => onSubmit({ question, answer, position })}
          disabled={!question.trim() || !answer.trim() || loading}
          className="flex-1"
        >
          {loading ? "Enregistrement..." : "Enregistrer"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
  );
}

export default function LmsFaq() {
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useFaqItems();
  const createItem = useCreateFaqItem();
  const updateItem = useUpdateFaqItem();
  const deleteItem = useDeleteFaqItem();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<FaqItem | null>(null);

  const maxPosition = items.length > 0 ? Math.max(...items.map((i) => i.position)) + 1 : 0;

  const handleCreate = async (v: { question: string; answer: string; position: number }) => {
    await createItem.mutateAsync(v);
    toast({ title: "Question ajoutée" });
    setCreateOpen(false);
  };

  const handleUpdate = async (v: { question: string; answer: string; position: number }) => {
    if (!editItem) return;
    await updateItem.mutateAsync({ id: editItem.id, updates: v });
    toast({ title: "Question mise à jour" });
    setEditItem(null);
  };

  const handleToggle = async (item: FaqItem) => {
    await updateItem.mutateAsync({ id: item.id, updates: { is_active: !item.is_active } });
  };

  const handleDelete = async (item: FaqItem) => {
    const ok = await confirm({
      title: "Supprimer cette question ?",
      description: "Elle ne sera plus visible dans l'espace apprenant.",
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    await deleteItem.mutateAsync(item.id);
    toast({ title: "Question supprimée" });
  };

  return (
    <ModuleLayout>
      <ConfirmDialog />
      <div className="container py-6 space-y-6 max-w-3xl">
        <PageHeader
          icon={GraduationCap}
          title="FAQ — Questions fréquentes"
          backTo="/lms"
        />

        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {items.filter((i) => i.is_active).length} question{items.filter((i) => i.is_active).length !== 1 ? "s" : ""} visible{items.filter((i) => i.is_active).length !== 1 ? "s" : ""} dans l'espace apprenant
          </p>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Nouvelle question
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter une question fréquente</DialogTitle>
              </DialogHeader>
              <FaqForm
                maxPosition={maxPosition}
                onSubmit={handleCreate}
                onCancel={() => setCreateOpen(false)}
                loading={createItem.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-16" />
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <HelpCircle className="w-10 h-10 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">Aucune question pour l'instant</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id} className={item.is_active ? "" : "opacity-50"}>
                <CardContent className="py-4 flex items-start gap-3">
                  <GripVertical className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.question}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.answer}</p>
                    <p className="text-xs text-muted-foreground mt-1">Position {item.position}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={() => handleToggle(item)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => setEditItem(item)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la question</DialogTitle>
          </DialogHeader>
          {editItem && (
            <FaqForm
              initial={editItem}
              maxPosition={maxPosition}
              onSubmit={handleUpdate}
              onCancel={() => setEditItem(null)}
              loading={updateItem.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  );
}
