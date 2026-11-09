import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import {
  useCreateSocialTheme,
  useDeleteSocialTheme,
  useSocialThemes,
  useUpdateSocialTheme,
} from "@/hooks/useSocialContents";
import { toastError } from "@/lib/toastError";
import { cn } from "@/lib/utils";
import { THEME_COLORS, type SocialTheme } from "@/services/socialContents";

/** Première couleur de la palette qu'aucun thème n'utilise, la première sinon. */
export function nextThemeColor(themes: Pick<SocialTheme, "color">[]): string {
  const used = new Set(themes.map((t) => t.color.toLowerCase()));
  return THEME_COLORS.find((c) => !used.has(c)) ?? THEME_COLORS[0];
}

function ColorPicker({ value, label, onChange }: { value: string; label: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="h-6 w-6 shrink-0 rounded-full border"
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <div className="flex gap-1.5" role="group" aria-label="Couleurs">
          {THEME_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Couleur ${c}`}
              aria-pressed={c === value}
              onClick={() => { onChange(c); setOpen(false); }}
              className={cn("h-6 w-6 rounded-full border-2", c === value ? "border-foreground" : "border-transparent")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Marque les champs de renommage : Échap y annule la saisie au lieu de fermer le dialogue. */
const RENAME_ATTR = "data-theme-rename";

function isRenameField(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && target.hasAttribute(RENAME_ATTR);
}

function ThemeRow({ theme, onRename, onRecolor, onDelete }: {
  theme: SocialTheme;
  /** Résout à false si le renommage est refusé (l'erreur est déjà affichée). */
  onRename: (theme: SocialTheme, name: string) => Promise<boolean>;
  onRecolor: (theme: SocialTheme, color: string) => void;
  onDelete: (theme: SocialTheme) => void;
}) {
  const [name, setName] = useState(theme.name);
  useEffect(() => setName(theme.name), [theme.name]);

  const commitName = async () => {
    if (name.trim() === theme.name) {
      setName(theme.name);
      return;
    }
    if (!(await onRename(theme, name))) setName(theme.name);
  };

  return (
    <li className="flex items-center gap-2" data-testid={`social-theme-${theme.id}`}>
      <ColorPicker
        value={theme.color}
        label={`Couleur du thème ${theme.name}`}
        onChange={(color) => onRecolor(theme, color)}
      />
      <Input
        {...{ [RENAME_ATTR]: "" }}
        aria-label={`Nom du thème ${theme.name}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setName(theme.name);
          }
        }}
        className="h-8"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Supprimer le thème ${theme.name}`}
        onClick={() => onDelete(theme)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

interface SocialSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SocialSettingsDialog({ open, onOpenChange }: SocialSettingsDialogProps) {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { data: themes = [], isLoading, isError, refetch } = useSocialThemes();
  const create = useCreateSocialTheme();
  const remove = useDeleteSocialTheme();
  // Deux mutations distinctes : un changement de couleur ne masque jamais l'erreur d'un renommage.
  // Elles vivent ici, pas dans les lignes, pour survivre à la fermeture du dialogue.
  const rename = useUpdateSocialTheme();
  const recolor = useUpdateSocialTheme();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string | null>(null);
  const color = newColor ?? nextThemeColor(themes);

  const handleCreate = () => {
    if (!newName.trim()) return;
    create.mutate({ name: newName, color }, {
      onSuccess: () => {
        setNewName("");
        setNewColor(null);
      },
      onError: (e) => toastError(toast, e),
    });
  };

  const handleRename = async (theme: SocialTheme, name: string): Promise<boolean> => {
    try {
      await rename.mutateAsync({ id: theme.id, name });
      return true;
    } catch (e) {
      toastError(toast, e);
      return false;
    }
  };

  const handleRecolor = (theme: SocialTheme, color: string) => {
    recolor.mutate({ id: theme.id, color }, { onError: (e) => toastError(toast, e) });
  };

  /** Fermer avec un renommage en cours le valide : la perte du focus déclenche l'enregistrement. */
  const handleOpenChange = (next: boolean) => {
    if (!next && isRenameField(document.activeElement)) document.activeElement.blur();
    onOpenChange(next);
  };

  const handleDelete = async (theme: SocialTheme) => {
    const ok = await confirm({
      title: `Supprimer le thème « ${theme.name} » ?`,
      description: "Les contenus de ce thème sont conservés, sans thème.",
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    remove.mutate(theme.id, { onError: (e) => toastError(toast, e) });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
        onEscapeKeyDown={(e) => { if (isRenameField(e.target)) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Réglages des contenus sociaux</DialogTitle>
          <DialogDescription>Paramètres communs du module.</DialogDescription>
        </DialogHeader>
        <section className="space-y-3" aria-labelledby="social-settings-themes">
          <h3 id="social-settings-themes" className="text-sm font-semibold">Thèmes</h3>
          {isError ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground" role="alert">
              <p>Impossible de charger les thèmes.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Réessayer</Button>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : themes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun thème pour l'instant. Créez-en un pour classer vos contenus et filtrer le calendrier.
            </p>
          ) : (
            <ul className="space-y-2">
              {themes.map((t) => <ThemeRow key={t.id} theme={t} onRename={handleRename} onRecolor={handleRecolor} onDelete={handleDelete} />)}
            </ul>
          )}
          <form
            className="flex items-center gap-2 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
          >
            <ColorPicker value={color} label="Couleur du nouveau thème" onChange={setNewColor} />
            <Input
              aria-label="Nom du nouveau thème"
              placeholder="Nouveau thème"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8"
            />
            <Button type="submit" size="sm" disabled={!newName.trim() || create.isPending}>
              {create.isPending ? <Spinner size="sm" /> : <><Plus className="h-4 w-4 mr-1" /> Ajouter</>}
            </Button>
          </form>
        </section>
      </DialogContent>
      <ConfirmDialog />
    </Dialog>
  );
}
