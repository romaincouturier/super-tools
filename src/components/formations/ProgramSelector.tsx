import { useState, useEffect, useRef } from "react";
import { Upload, FileText, Check, Loader2, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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

interface ProgramFile {
  id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
  uploaded_by: string;
}

interface ProgramSelectorProps {
  programFileUrl: string;
  onProgramChange: (url: string) => void;
  onPrerequisitesExtracted?: (prerequisites: string[]) => void;
  userId: string;
}

const ProgramSelector = ({ 
  programFileUrl, 
  onProgramChange, 
  onPrerequisitesExtracted,
  userId 
}: ProgramSelectorProps) => {
  const [programFiles, setProgramFiles] = useState<ProgramFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [extractingPrerequisites, setExtractingPrerequisites] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const getAuthenticatedUserId = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    const id = data.session?.user?.id;
    if (!id) {
      throw new Error("Vous devez être connecté pour uploader un fichier.");
    }
    return id;
  };

  const extractPrerequisitesFromPdf = async (pdfUrl: string) => {
    if (!onPrerequisitesExtracted) return;
    
    setExtractingPrerequisites(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-objectives-from-pdf", {
        body: { pdfUrl, extractType: "prerequisites" },
      });

      if (error) throw error;

      if (data?.prerequisites && Array.isArray(data.prerequisites) && data.prerequisites.length > 0) {
        onPrerequisitesExtracted(data.prerequisites);
        toast({
          title: "Prérequis extraits",
          description: `${data.prerequisites.length} prérequis extrait(s) du programme. Vous pouvez les modifier.`,
        });
      } else {
        toast({
          title: "Aucun prérequis trouvé",
          description: "L'IA n'a pas pu extraire de prérequis du PDF. Ajoutez-les manuellement.",
          variant: "default",
        });
      }
    } catch (error: unknown) {
      console.error("Error extracting prerequisites:", error);
      toast({
        title: "Extraction impossible",
        description: "Impossible d'extraire les prérequis automatiquement. Ajoutez-les manuellement.",
        variant: "default",
      });
    } finally {
      setExtractingPrerequisites(false);
    }
  };

  useEffect(() => {
    fetchProgramFiles();

    // Keep a local copy of the current authenticated user id.
    // This avoids relying on a parent prop that may transiently be empty.
    supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user?.id ?? null);
    });
  }, []);

  const fetchProgramFiles = async () => {
    const { data, error } = await supabase
      .from("program_files")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching program files:", error);
    } else {
      setProgramFiles(data || []);
    }
    setLoadingFiles(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget;
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.includes("pdf")) {
      toast({
        title: "Format non supporté",
        description: "Seuls les fichiers PDF sont acceptés.",
        variant: "destructive",
      });
      return;
    }



    setUploading(true);

    try {
      // Ensure the request is authenticated (otherwise RLS will reject inserts).
      const authedUserId = await getAuthenticatedUserId();

      // Workaround for persistent Storage RLS insert failures:
      // we request a signed upload token from a backend function (service-role),
      // then upload directly with that token.
      const { data: signedData, error: signedError } = await supabase.functions.invoke(
        "create-program-upload-url",
        { body: { originalFileName: file.name } }
      );

      if (signedError) throw signedError;

      const path = (signedData as any)?.path as string | undefined;
      const token = (signedData as any)?.token as string | undefined;
      const publicUrl = (signedData as any)?.publicUrl as string | undefined;

      if (!path || !token || !publicUrl) {
        console.error("[ProgramSelector] Invalid signed upload response:", signedData);
        throw new Error("Réponse d'upload invalide. Veuillez réessayer.");
      }

      console.log("[ProgramSelector] Signed upload prepared", {
        authedUserId,
        path,
      });

      const { error: uploadError } = await supabase.storage
        .from("training-programs")
        .uploadToSignedUrl(path, token, file);

      if (uploadError) throw uploadError;

      // Save to program_files table
      const { error: dbError } = await supabase
        .from("program_files")
        .insert({
          file_name: file.name,
          file_url: publicUrl,
          uploaded_by: authedUserId,
        });

      if (dbError) throw dbError;

      // Update selected program
      onProgramChange(publicUrl);

      // Refresh list
      await fetchProgramFiles();

      toast({
        title: "Programme uploadé",
        description: "Le fichier a été ajouté à votre bibliothèque.",
      });

      // Auto-extract prerequisites after upload
      if (onPrerequisitesExtracted) {
        await extractPrerequisitesFromPdf(publicUrl);
      }
    } catch (error: unknown) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de l'upload.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);

      // UX fix: selecting the same file twice won't fire onChange unless we reset the input.
      try {
        inputEl.value = "";
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch {
        // no-op
      }
    }
  };

  const handleDeleteFile = async (file: ProgramFile) => {
    setDeletingFileId(file.id);
    try {
      // Extract the file path from the URL
      const urlParts = file.file_url.split("/");
      const filePath = `programs/${urlParts[urlParts.length - 1]}`;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("training-programs")
        .remove([filePath]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
        // Continue anyway to delete from DB
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("program_files")
        .delete()
        .eq("id", file.id);

      if (dbError) throw dbError;

      // If deleted file was selected, clear selection
      if (programFileUrl === file.file_url) {
        onProgramChange("");
      }

      // Refresh list
      await fetchProgramFiles();

      toast({
        title: "Programme supprimé",
        description: "Le fichier a été retiré de votre bibliothèque.",
      });
    } catch (error: unknown) {
      console.error("Delete error:", error);
      toast({
        title: "Erreur de suppression",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    } finally {
      setDeletingFileId(null);
    }
  };

  const selectProgram = (url: string) => {
    onProgramChange(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Programme de formation
        </CardTitle>
        <CardDescription>
          Uploadez un nouveau programme ou sélectionnez-en un depuis votre bibliothèque
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="upload" className="flex-1">
              <Upload className="h-4 w-4 mr-2" />
              Nouveau fichier
            </TabsTrigger>
            <TabsTrigger value="library" className="flex-1">
              <FileText className="h-4 w-4 mr-2" />
              Bibliothèque ({programFiles.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="program-upload"
                  ref={fileInputRef}
                />
                <Label
                  htmlFor="program-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  ) : (
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {uploading ? "Upload en cours..." : "Cliquez pour uploader un PDF"}
                  </span>
                </Label>
              </div>

              {programFileUrl && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm flex-1 truncate">Programme sélectionné</span>
                    <a
                      href={programFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Voir
                    </a>
                  </div>
                  
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="library" className="mt-4">
            {loadingFiles ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : programFiles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun programme dans votre bibliothèque
              </p>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {programFiles.map((file) => (
                    <div
                      key={file.id}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                        programFileUrl === file.file_url
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-muted/50 hover:bg-muted border-2 border-transparent"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => selectProgram(file.file_url)}
                        className="flex-1 flex items-center gap-3 text-left"
                      >
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 text-sm truncate">{file.file_name}</span>
                        {programFileUrl === file.file_url && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                      {file.uploaded_by === (sessionUserId ?? userId) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              disabled={deletingFileId === file.id}
                            >
                              {deletingFileId === file.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce programme ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Le fichier "{file.file_name}" sera définitivement supprimé de votre bibliothèque.
                                Cette action est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteFile(file)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ProgramSelector;
