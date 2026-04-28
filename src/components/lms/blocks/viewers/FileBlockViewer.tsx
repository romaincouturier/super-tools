import { Button } from "@/components/ui/button";
import { Paperclip, Download } from "lucide-react";
import { formatFileSize } from "@/lib/file-utils";
import type { FileBlockContent } from "@/types/lms-blocks";

interface Props {
  content: FileBlockContent;
}

export default function FileBlockViewer({ content }: Props) {
  if (!content.url) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 bg-muted rounded-lg border">
        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
          <Paperclip className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium break-words">{content.name || "Fichier"}</p>
            {content.size != null && content.size > 0 && (
              <p className="text-sm text-muted-foreground">{formatFileSize(content.size)}</p>
            )}
          </div>
        </div>
        <Button asChild className="w-full sm:w-auto shrink-0">
          <a href={content.url} target="_blank" rel="noopener noreferrer" download>
            <Download className="w-4 h-4 mr-2" /> Télécharger
          </a>
        </Button>
      </div>
      {content.description_html && (
        <div
          className="prose prose-sm max-w-none break-words"
          dangerouslySetInnerHTML={{ __html: content.description_html }}
        />
      )}
    </div>
  );
}
