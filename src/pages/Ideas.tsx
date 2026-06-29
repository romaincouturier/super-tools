import { useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, Plus, ThumbsUp, ArrowUpRight, Trash2, Image as ImageIcon, X, BarChart3, Loader2 } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/hooks/useConfirm";
import KanbanStatsDialog from "@/components/shared/kanban/KanbanStatsDialog";
import type { KanbanColumnDef, KanbanStatsItem } from "@/types/kanban";
import {
  useIdeas,
  IDEA_COLUMNS,
  IDEA_STATUS_CONFIG,
  IMPACT_WEIGHT,
  type Idea,
  type IdeaStatus,
  type SimilarIdea,
} from "@/hooks/useIdeas";

const STATS_COLUMN_COLORS: Record<IdeaStatus, string> = {
  nouvelle: "#3b82f6",
  a_l_etude: "#f59e0b",
  acceptee: "#10b981",
  promue: "#8b5cf6",
  realisee: "#22c55e",
  rejetee: "#ef4444",
};

const IDEA_STATS_COLUMNS: KanbanColumnDef[] = IDEA_COLUMNS.map((s, i) => ({
  id: s,
  name: IDEA_STATUS_CONFIG[s].label,
  position: i,
  color: STATS_COLUMN_COLORS[s],
}));

function IdeaCard({
  idea,
  onVote,
  onStatus,
  onPromote,
  onDelete,
}: {
  idea: Idea;
  onVote: (i: Idea) => void;
  onStatus: (id: string, s: IdeaStatus) => void;
  onPromote: (i: Idea) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2 w-full">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm leading-snug break-words">{idea.title}</p>
        <Button
          variant={idea.has_voted ? "default" : "outline"}
          size="sm"
          className="h-7 shrink-0 gap-1 px-2"
          onClick={() => onVote(idea)}
          title={idea.has_voted ? "Retirer mon vote" : "Voter pour cette idée"}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          {idea.vote_count}
        </Button>
      </div>

      {idea.description && (
        <p className="text-xs text-muted-foreground break-words line-clamp-4">{idea.description}</p>
      )}

      {idea.image_url && (
        <a href={idea.image_url} target="_blank" rel="noreferrer">
          <img src={idea.image_url} alt="" className="rounded-md max-h-32 w-full object-cover border" />
        </a>
      )}

      {idea.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {idea.tags.map((t) => (
            <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{t}</span>
          ))}
        </div>
      )}

      {(idea.ai_category || idea.ai_impact || idea.ai_effort) && (
        <div className="flex flex-wrap gap-1">
          {idea.ai_category && <Badge variant="outline" className="text-[10px]">{idea.ai_category}</Badge>}
          {idea.ai_impact && <Badge variant="secondary" className="text-[10px]">Impact {idea.ai_impact}</Badge>}
          {idea.ai_effort && <Badge variant="secondary" className="text-[10px]">Effort {idea.ai_effort}</Badge>}
        </div>
      )}

      <div className="flex items-center gap-1.5 pt-1">
        <Select value={idea.status} onValueChange={(v) => onStatus(idea.id, v as IdeaStatus)}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IDEA_COLUMNS.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {IDEA_STATUS_CONFIG[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!idea.promoted_to_improvement_id && (
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            title="Promouvoir en amélioration"
            onClick={() => onPromote(idea)}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          title="Supprimer"
          onClick={() => onDelete(idea.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function NewIdeaDialog({
  open,
  onOpenChange,
  onCreate,
  onFindSimilar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (input: { title: string; description: string; tags: string[]; file: File | null }) => Promise<void>;
  onFindSimilar: (query: string) => Promise<SimilarIdea[]>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [similar, setSimilar] = useState<SimilarIdea[]>([]);
  const [searching, setSearching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = title.trim();
    if (q.length < 4) { setSimilar([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try { setSimilar(await onFindSimilar(q)); } finally { setSearching(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [title, onFindSimilar]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setTags("");
    setFile(null);
    setSimilar([]);
  };

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        title,
        description,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        file,
      });
      reset();
      onOpenChange(false);
    } catch {
      /* toast géré dans le hook */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle idée</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="idea-title">Titre *</Label>
            <Input
              id="idea-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Décrivez l'idée en une phrase"
              autoFocus
            />
            {(searching || similar.length > 0) && (
              <div className="rounded-md border bg-muted/40 p-2 mt-1.5">
                <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  {searching && <Loader2 className="h-3 w-3 animate-spin" />}
                  Idées proches déjà existantes
                </p>
                <ul className="mt-1 space-y-0.5">
                  {similar.map((s) => (
                    <li key={s.id} className="text-xs flex items-center gap-1.5">
                      <span className={`px-1 rounded text-[10px] ${IDEA_STATUS_CONFIG[s.status].color}`}>
                        {IDEA_STATUS_CONFIG[s.status].label}
                      </span>
                      <span className="truncate">{s.title}</span>
                    </li>
                  ))}
                  {!searching && similar.length === 0 && (
                    <li className="text-xs text-muted-foreground">Aucune idée similaire — c'est nouveau 👍</li>
                  )}
                </ul>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idea-desc">Description (optionnel)</Label>
            <Textarea
              id="idea-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Détaillez si besoin"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idea-tags">Tags (séparés par des virgules)</Label>
            <Input
              id="idea-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="produit, ux, urgent"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Image / PDF (optionnel)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-2 text-sm">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="truncate flex-1">{file.name}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFile(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Joindre un fichier
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={!title.trim() || saving}>
            {saving ? <Spinner className="mr-2" /> : null}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Ideas() {
  const { ideas, grouped, loading, createIdea, toggleVote, changeStatus, promoteIdea, removeIdea, findSimilarIdeas } = useIdeas();
  const { confirm, ConfirmDialog } = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const statsItems: KanbanStatsItem[] = useMemo(
    () =>
      ideas.map((i) => ({
        id: i.id,
        columnId: i.status,
        createdAt: i.created_at,
        completedAt: i.status === "realisee" || i.status === "rejetee" ? i.updated_at : null,
        value: i.ai_impact ? IMPACT_WEIGHT[i.ai_impact] ?? 1 : 1,
      })),
    [ideas],
  );

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Supprimer cette idée ?",
      description: "Cette action est irréversible.",
    });
    if (ok) removeIdea(id);
  };

  return (
    <ModuleLayout>
      <main className="max-w-7xl mx-auto p-3 md:p-6">
        <PageHeader
          icon={Lightbulb}
          title="Boîte à idées"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setStatsOpen(true)} title="Statistiques">
                <BarChart3 className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Statistiques</span>
              </Button>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Nouvelle idée</span>
              </Button>
            </div>
          }
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-primary" />
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {IDEA_COLUMNS.map((status) => (
              <div key={status} className="w-72 shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-sm font-medium">{IDEA_STATUS_CONFIG[status].label}</span>
                  <Badge variant="secondary" className="text-xs">{grouped[status].length}</Badge>
                </div>
                <div className="space-y-2">
                  {grouped[status].map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onVote={toggleVote}
                      onStatus={changeStatus}
                      onPromote={promoteIdea}
                      onDelete={handleDelete}
                    />
                  ))}
                  {grouped[status].length === 0 && (
                    <p className="text-xs text-muted-foreground px-1 py-4 text-center">—</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <NewIdeaDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreate={createIdea}
          onFindSimilar={findSimilarIdeas}
        />
        <KanbanStatsDialog
          open={statsOpen}
          onOpenChange={setStatsOpen}
          columns={IDEA_STATS_COLUMNS}
          items={statsItems}
          doneColumnIds={["realisee", "rejetee"]}
          wonColumnIds={["realisee"]}
          lostColumnIds={["rejetee"]}
        />
        <ConfirmDialog />
      </main>
    </ModuleLayout>
  );
}
