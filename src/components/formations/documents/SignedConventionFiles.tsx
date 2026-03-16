import { useState } from "react";
import { Trash2, CheckCircle, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { sanitizeFileName } from "@/lib/file-utils";

interface SignedConventionFilesProps {
  trainingId: string;
  signedConventionUrls: string[];
  setSignedConventionUrls: (urls: string[]) => void;
  onUpdate?: () => void;
}

const SignedConventionFiles = ({
  trainingId,
  signedConventionUrls,
  setSignedConventionUrls,
  onUpdate,
}: SignedConventionFilesProps) => {
  const [uploadingSignedConvention, setUploadingSignedConvention] = useState(false);
  const { toast } = useToast();

  const handleSignedConventionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingSignedConvention(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.includes("pdf") && !file.type.includes("image")) {
          toast({ title: "Format non supporté", description: "Seuls les fichiers PDF et images sont acceptés.", variant: "destructive" });
          continue;
        }
        const fileExt = file.name.split(".").pop();
        const baseName = file.name.replace(`.${fileExt}`, "");
        const sanitizedName = sanitizeFileName(baseName);
        const fileName = `${trainingId}/convention_signee_${Date.now()}_${sanitizedName}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from("training-documents").upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from("training-documents").getPublicUrl(fileName);
        newUrls.push(publicUrl);
      }

      if (newUrls.length > 0) {
        const allUrls = [...signedConventionUrls, ...newUrls];
        const { error: updateError } = await supabase.from("trainings").update({ signed_convention_urls: allUrls }).eq("id", trainingId);
        if (updateError) throw updateError;
        setSignedConventionUrls(allUrls);
        onUpdate?.();
        toast({ title: "Convention signée uploadée", description: `${newUrls.length} fichier(s) ajouté(s).` });
      }
    } catch (error: unknown) {
      console.error("Upload error:", error);
      toast({ title: "Erreur d'upload", description: error instanceof Error ? error.message : "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setUploadingSignedConvention(false);
      e.target.value = "";
    }
  };

  const handleDeleteSignedConvention = async (urlToDelete: string) => {
    try {
      const updatedUrls = signedConventionUrls.filter(url => url !== urlToDelete);
      const { error: updateError } = await supabase.from("trainings").update({ signed_convention_urls: updatedUrls }).eq("id", trainingId);
      if (updateError) throw updateError;

      const path = urlToDelete.split("/training-documents/")[1];
      if (path) await supabase.storage.from("training-documents").remove([path]);

      setSignedConventionUrls(updatedUrls);
      onUpdate?.();
      toast({ title: "Fichier supprimé", description: "La convention signée a été retirée." });
    } catch (error: unknown) {
      console.error("Delete error:", error);
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Impossible de supprimer le fichier.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept=".pdf,image/*"
        multiple
        onChange={handleSignedConventionUpload}
        disabled={uploadingSignedConvention}
        className="hidden"
        id="signed-convention-upload"
      />
      {signedConventionUrls.length > 0 && (
        <div className="space-y-1">
          {signedConventionUrls.map((url, index) => {
            const fileName = decodeURIComponent(url.split("/").pop() || `Fichier ${index + 1}`);
            return (
              <div key={index} className="flex items-center gap-2 p-1.5 bg-muted/50 border border-border rounded text-xs">
                <CheckCircle className="h-3 w-3 text-green-600 shrink-0" />
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline flex-1 truncate">
                  {fileName}
                </a>
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => handleDeleteSignedConvention(url)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Suppress unused import warning — Upload icon is used in parent via dropdown label referencing "signed-convention-upload"
void Upload;

export default SignedConventionFiles;
