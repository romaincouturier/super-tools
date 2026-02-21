import { Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
}

interface CardAttachmentsTabProps {
  attachments: Attachment[];
  isLoading: boolean;
  cardId: string;
  userEmail: string;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteAttachment: (params: {
    id: string;
    cardId: string;
    fileName: string;
    filePath: string;
    actorEmail: string;
  }) => void;
  isUploading: boolean;
}

const CardAttachmentsTab = ({
  attachments,
  isLoading,
  cardId,
  userEmail,
  onFileUpload,
  onDeleteAttachment,
  isUploading,
}: CardAttachmentsTabProps) => {
  return (
    <div className="space-y-4 mt-4">
      <div>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={onFileUpload}
        />
        <Button
          variant="outline"
          onClick={() => document.getElementById("file-upload")?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Ajouter un fichier
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {attachments.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune pièce jointe</p>
        )}
        {attachments.map((att) => (
          <div
            key={att.id}
            className="flex items-center justify-between p-2 bg-muted rounded"
          >
            <button
              className="flex items-center gap-2 hover:text-primary transition-colors text-left min-w-0"
              onClick={async () => {
                try {
                  const { data } = await supabase.storage
                    .from("crm-attachments")
                    .createSignedUrl(att.file_path, 3600);
                  if (data?.signedUrl) {
                    window.open(data.signedUrl, "_blank", "noopener");
                  }
                } catch (e) {
                  console.error("Error opening attachment:", e);
                }
              }}
            >
              <Paperclip className="h-4 w-4 shrink-0" />
              <span className="text-sm truncate underline">{att.file_name}</span>
              {att.file_size && (
                <span className="text-xs text-muted-foreground">
                  ({Math.round(att.file_size / 1024)} KB)
                </span>
              )}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() =>
                onDeleteAttachment({
                  id: att.id,
                  cardId,
                  fileName: att.file_name,
                  filePath: att.file_path,
                  actorEmail: userEmail,
                })
              }
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CardAttachmentsTab;
