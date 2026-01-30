import { useState, useEffect } from "react";
import { Upload, FileText, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ProgramFile {
  id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
}

interface ProgramSelectorProps {
  programFileUrl: string;
  onProgramChange: (url: string) => void;
  userId: string;
}

const ProgramSelector = ({ programFileUrl, onProgramChange, userId }: ProgramSelectorProps) => {
  const [programFiles, setProgramFiles] = useState<ProgramFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchProgramFiles();
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

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "Le fichier ne doit pas dépasser 10 Mo.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `programs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("training-programs")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("training-programs")
        .getPublicUrl(filePath);

      // Save to program_files table
      const { error: dbError } = await supabase
        .from("program_files")
        .insert({
          file_name: file.name,
          file_url: publicUrl,
          uploaded_by: userId,
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
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error.message || "Une erreur est survenue lors de l'upload.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
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
                    {uploading ? "Upload en cours..." : "Cliquez pour uploader un PDF (max 10 Mo)"}
                  </span>
                </Label>
              </div>

              {programFileUrl && (
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
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => selectProgram(file.file_url)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                        programFileUrl === file.file_url
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-muted/50 hover:bg-muted border-2 border-transparent"
                      )}
                    >
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 text-sm truncate">{file.file_name}</span>
                      {programFileUrl === file.file_url && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </button>
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
