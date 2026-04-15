import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileText, Upload, Trash2, Paperclip } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { ParticipantFile } from "@/services/participants";

interface ParticipantFilesProps {
  participantId: string;
  participantFiles: ParticipantFile[];
  uploadingFile: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteFile: (file: ParticipantFile) => void;
}

const ParticipantFiles = ({
  participantId,
  participantFiles,
  uploadingFile,
  handleFileUpload,
  handleDeleteFile,
}: ParticipantFilesProps) => {
  return (
    <>
      {/* Fichiers libres */}
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <Paperclip className="h-4 w-4" />
            Fichiers joints ({participantFiles.length})
          </Label>
          <Label
            htmlFor={`participant-file-${participantId}`}
            className="cursor-pointer"
          >
            <input
              id={`participant-file-${participantId}`}
              type="file"
              multiple
              className="hidden"
              disabled={uploadingFile}
              onChange={handleFileUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingFile}
              asChild
            >
              <span>
                {uploadingFile ? (
                  <Spinner className="mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Ajouter des fichiers
              </span>
            </Button>
          </Label>
        </div>
      </div>
      {participantFiles.length > 0 && (
        <div className="space-y-2">
          {participantFiles.map((pf) => (
            <div
              key={pf.id}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg min-w-0"
            >
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <a
                href={pf.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm text-primary hover:underline truncate"
              >
                {pf.file_name}
              </a>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {new Date(pf.uploaded_at).toLocaleDateString("fr-FR")}
              </span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Supprimer ce fichier ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Le fichier &quot;{pf.file_name}&quot; sera supprimé
                      définitivement.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteFile(pf)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default ParticipantFiles;
