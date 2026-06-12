import { useCallback, useRef, useState } from 'react';
import { Upload, X, ImageIcon, Video } from 'lucide-react';
import { resolveContentType } from '@/lib/file-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUploadProduction } from '@/hooks/useBook';
import { extractExifData } from '@/lib/book-exif';

interface FileEntry {
  file: File;
  title: string;
  fileType: 'image' | 'video';
}

interface BookUploadDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  albumId: string;
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,video/mp4,video/quicktime';

function detectFileType(file: File): 'image' | 'video' {
  return resolveContentType(file).startsWith('video/') ? 'video' : 'image';
}

function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

export default function BookUploadDialog({ open, onOpenChange, albumId }: BookUploadDialogProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const uploadProduction = useUploadProduction();

  const tags = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const newEntries: FileEntry[] = Array.from(incoming).map((f) => ({
      file: f,
      title: stripExtension(f.name),
      fileType: detectFileType(f),
    }));
    setFiles((prev) => [...prev, ...newEntries]);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTitle(index: number, title: string) {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, title } : f)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadedCount(0);

    for (const entry of files) {
      const exif = await extractExifData(entry.file);
      await uploadProduction.mutateAsync({
        albumId,
        file: entry.file,
        title: entry.title,
        notes: notes.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        exifDate: exif.exif_date,
        exifWidth: exif.exif_width,
        exifHeight: exif.exif_height,
      });
      setUploadedCount((c) => c + 1);
    }

    setIsUploading(false);
    resetAndClose();
  }

  function resetAndClose() {
    setFiles([]);
    setNotes('');
    setTagsInput('');
    setUploadedCount(0);
    setIsUploading(false);
    onOpenChange(false);
  }

  const progress = files.length > 0 ? Math.round((uploadedCount / files.length) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={isUploading ? undefined : onOpenChange}>
      <DialogContent className="w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter des productions</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Glissez-déposez des fichiers ou <span className="text-primary underline">parcourir</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, MP4, MOV</p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                  {entry.fileType === 'video' ? (
                    <Video className="w-4 h-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ImageIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                  )}
                  <Badge variant="outline" className="text-xs shrink-0">
                    {entry.fileType}
                  </Badge>
                  <Input
                    value={entry.title}
                    onChange={(e) => updateTitle(i, e.target.value)}
                    className="h-7 text-sm flex-1"
                    disabled={isUploading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removeFile(i)}
                    disabled={isUploading}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes sur ces productions"
              rows={2}
              disabled={isUploading}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags (séparés par des virgules)</Label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="facilitation, atelier, stratégie"
              disabled={isUploading}
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Progress */}
          {isUploading && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {uploadedCount}/{files.length} uploadées
              </p>
              <Progress value={progress} />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={resetAndClose}
              disabled={isUploading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isUploading || files.length === 0}>
              {isUploading ? 'Upload en cours...' : `Uploader ${files.length > 0 ? `(${files.length})` : ''}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
