import { Copy, Check, X, Plus } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBookShareLinks, useCreateShareLink, useRevokeShareLink } from '@/hooks/useBook';
import type { BookShareLink } from '@/types/book';

interface BookShareLinksManagerProps {
  albumId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function CopyLinkButton({ link }: { link: BookShareLink }) {
  const { copied, copy } = useCopyToClipboard({ defaultToastTitle: "Lien copié" });

  function handleCopy() {
    const url = `${window.location.origin}/book/share/${link.token}`;
    copy(url);
  }

  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

export default function BookShareLinksManager({
  albumId,
  open,
  onOpenChange,
}: BookShareLinksManagerProps) {
  const [prospectName, setProspectName] = useState('');
  const { data: links = [], isLoading } = useBookShareLinks(albumId);
  const createLink = useCreateShareLink();
  const revokeLink = useRevokeShareLink();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!prospectName.trim()) return;
    await createLink.mutateAsync({ albumId, prospectName: prospectName.trim() });
    setProspectName('');
  }

  function handleRevoke(link: BookShareLink) {
    revokeLink.mutate({ id: link.id, albumId });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Liens de partage</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Create new link */}
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
              placeholder="Nom du prospect"
              className="flex-1"
              disabled={createLink.isPending}
            />
            <Button
              type="submit"
              disabled={createLink.isPending || !prospectName.trim()}
              className="shrink-0"
            >
              <Plus className="w-4 h-4 mr-1" />
              Créer un lien
            </Button>
          </form>

          <Separator />

          {/* Links list */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : links.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun lien créé</p>
          ) : (
            <div className="space-y-3">
              {links.map((link) => {
                const isRevoked = link.revoked_at != null;
                return (
                  <div
                    key={link.id}
                    className={`p-3 rounded-lg border space-y-2 ${isRevoked ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-medium ${isRevoked ? 'line-through text-muted-foreground' : ''}`}
                      >
                        {link.prospect_name}
                      </span>
                      <div className="flex items-center gap-1">
                        {isRevoked ? (
                          <Badge variant="secondary" className="text-xs">Révoqué</Badge>
                        ) : (
                          <>
                            <CopyLinkButton link={link} />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleRevoke(link)}
                              disabled={revokeLink.isPending}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Créé le {format(new Date(link.created_at), 'd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
