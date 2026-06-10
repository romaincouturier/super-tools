import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Paperclip, Download } from "lucide-react";
import { formatFileSize } from "@/lib/file-utils";
import type { FileBlockContent, FileBlockItem } from "@/types/lms-blocks";

interface Props {
  content: FileBlockContent;
}

export default function FileBlockViewer({ content }: Props) {
  const files: FileBlockItem[] = content.files && content.files.length > 0
    ? content.files
    : content.url
      ? [{ url: content.url, name: content.name || "Fichier", size: content.size ?? null }]
      : [];

  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      {files.map((f, i) => (
        <div key={`${f.url}-${i}`} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 bg-muted rounded-lg border">
          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
            <Paperclip className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium break-words">{f.name || "Fichier"}</p>
              {f.size != null && f.size > 0 && (
                <p className="text-sm text-muted-foreground">{formatFileSize(f.size)}</p>
              )}
            </div>
          </div>
          <Button asChild className="w-full sm:w-auto shrink-0">
            <a href={f.url} target="_blank" rel="noopener noreferrer" download>
              <Download className="w-4 h-4 mr-2" /> Télécharger
            </a>
          </Button>
        </div>
      ))}
      {content.description_html && (
        <div
          className="prose prose-sm max-w-none break-words"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.description_html) }}
        />
      )}
    </div>
  );
}
