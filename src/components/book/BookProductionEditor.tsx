import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateProduction } from '@/hooks/useBook';
import type { BookProduction } from '@/types/book';
import { toastError } from '@/lib/toastError';
import { toast } from '@/hooks/use-toast';

export default function BookProductionEditor({ production, onClose }: { production: BookProduction; onClose: () => void }) {
  const [title, setTitle] = useState(production.title);
  const [tags, setTags] = useState(production.tags.join(', '));
  const [notes, setNotes] = useState(production.notes ?? '');
  const update = useUpdateProduction();
  async function save() {
    try {
      await update.mutateAsync({ id: production.id, albumId: production.album_id, title: title.trim(), tags: [...new Set(tags.split(',').map(t => t.trim()).filter(Boolean))], notes: notes.trim() || null });
      onClose();
    } catch (error) {
      toastError(toast, error);
    }
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent><DialogHeader><DialogTitle>Modifier le visuel</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor="book-title">Titre</Label><Input id="book-title" value={title} maxLength={180} onChange={e => setTitle(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="book-tags">Tags (séparés par des virgules)</Label><Input id="book-tags" value={tags} onChange={e => setTags(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="book-notes">Description</Label><Textarea id="book-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={() => void save()} disabled={!title.trim() || update.isPending}>Enregistrer</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}