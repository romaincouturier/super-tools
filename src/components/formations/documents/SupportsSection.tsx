import { useEffect, useMemo, useState } from "react";
import { BookOpen, FileText, Link as LinkIcon, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useCourses } from "@/hooks/useLms";
import {
  deleteEntityDocumentFile,
  uploadEntityDocument,
} from "@/hooks/useEntityDocuments";
import { toastError } from "@/lib/toastError";

export type SupportsType = "url" | "file" | "lms";

interface SupportsSectionProps {
  trainingId: string;
  initialType: SupportsType;
  initialUrl: string | null;
  initialFileName: string | null;
  initialLmsCourseId: string | null;
  saveSupportsType: (type: SupportsType) => Promise<void>;
  saveSupportsUrl: (url: string) => Promise<void>;
  saveSupportsFile: (url: string | null, fileName: string | null) => Promise<void>;
  saveSupportsLmsCourseId: (courseId: string | null) => Promise<void>;
  onUpdate?: () => void;
}

const SupportsSection = ({
  trainingId,
  initialType,
  initialUrl,
  initialFileName,
  initialLmsCourseId,
  saveSupportsType,
  saveSupportsUrl,
  saveSupportsFile,
  saveSupportsLmsCourseId,
  onUpdate,
}: SupportsSectionProps) => {
  const { toast } = useToast();
  const { data: courses = [], isLoading: loadingCourses } = useCourses();

  const [type, setType] = useState<SupportsType>(initialType);
  const [url, setUrl] = useState(initialUrl || "");
  const [fileUrl, setFileUrl] = useState<string | null>(initialType === "file" ? initialUrl : null);
  const [fileName, setFileName] = useState<string | null>(initialFileName);
  const [lmsCourseId, setLmsCourseId] = useState<string | null>(initialLmsCourseId);
  const [savingUrl, setSavingUrl] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);

  useEffect(() => { setType(initialType); }, [initialType]);
  useEffect(() => { setUrl(initialType === "url" ? (initialUrl || "") : ""); }, [initialType, initialUrl]);
  useEffect(() => { setFileUrl(initialType === "file" ? initialUrl : null); }, [initialType, initialUrl]);
  useEffect(() => { setFileName(initialFileName); }, [initialFileName]);
  useEffect(() => { setLmsCourseId(initialLmsCourseId); }, [initialLmsCourseId]);

  const publishedCourses = useMemo(
    () => courses.filter((c) => c.status === "published"),
    [courses],
  );

  const handleTypeChange = async (next: string) => {
    const nextType = next as SupportsType;
    if (nextType === type) return;
    setType(nextType);
    try {
      await saveSupportsType(nextType);
      onUpdate?.();
    } catch (error: unknown) {
      console.error("Support type save error:", error);
      toastError(toast, error instanceof Error ? error : "Impossible de changer le type de support.");
    }
  };

  const handleUrlBlur = async () => {
    if (url === (initialUrl || "")) return;
    setSavingUrl(true);
    try {
      await saveSupportsUrl(url);
      onUpdate?.();
      toast({ title: "Lien enregistré", description: "Le lien vers les supports a été mis à jour." });
    } catch (error: unknown) {
      console.error("Supports URL save error:", error);
      toastError(toast, error instanceof Error ? error : "Impossible d'enregistrer le lien.");
    } finally {
      setSavingUrl(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const publicUrl = await uploadEntityDocument(file, "training", trainingId);
      await saveSupportsFile(publicUrl, file.name);
      setFileUrl(publicUrl);
      setFileName(file.name);
      onUpdate?.();
      toast({ title: "Fichier ajouté", description: "Le fichier support a été uploadé." });
    } catch (error: unknown) {
      console.error("Supports file upload error:", error);
      toastError(toast, error instanceof Error ? error : "Impossible d'uploader le fichier.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleFileDelete = async () => {
    if (!fileUrl) return;
    try {
      await deleteEntityDocumentFile(fileUrl, "training");
      await saveSupportsFile(null, null);
      setFileUrl(null);
      setFileName(null);
      onUpdate?.();
      toast({ title: "Fichier supprimé" });
    } catch (error: unknown) {
      console.error("Supports file delete error:", error);
      toastError(toast, error instanceof Error ? error : "Impossible de supprimer le fichier.");
    }
  };

  const handleCourseChange = async (courseId: string) => {
    const next = courseId === "__none__" ? null : courseId;
    setLmsCourseId(next);
    setSavingCourse(true);
    try {
      await saveSupportsLmsCourseId(next);
      onUpdate?.();
      if (next) {
        toast({
          title: "Cours LMS lié",
          description: "Les participants (actuels et futurs) seront inscrits automatiquement.",
        });
      }
    } catch (error: unknown) {
      console.error("Supports LMS course save error:", error);
      toastError(toast, error instanceof Error ? error : "Impossible de lier le cours e-learning.");
    } finally {
      setSavingCourse(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <BookOpen className="h-4 w-4" />
        Supports de formation
      </Label>

      <RadioGroup value={type} onValueChange={handleTypeChange} className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <RadioGroupItem value="url" id="supports-type-url" />
          <LinkIcon className="h-3.5 w-3.5" />
          URL
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <RadioGroupItem value="file" id="supports-type-file" />
          <FileText className="h-3.5 w-3.5" />
          Fichier
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <RadioGroupItem value="lms" id="supports-type-lms" />
          <BookOpen className="h-3.5 w-3.5" />
          E-learning
        </label>
      </RadioGroup>

      {type === "url" && (
        <div className="flex items-center gap-2">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={handleUrlBlur}
            placeholder="https://drive.google.com/..."
            disabled={savingUrl}
          />
          {savingUrl && <Spinner />}
        </div>
      )}

      {type === "file" && (
        <div>
          {fileUrl ? (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm text-primary hover:underline truncate"
              >
                {fileName || "Fichier support"}
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={handleFileDelete}
                aria-label="Supprimer le fichier"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div>
              <Input
                type="file"
                id="supports-file-upload"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <Label htmlFor="supports-file-upload" className="cursor-pointer">
                <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                  <span>
                    {uploading ? <Spinner className="mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Uploader un fichier
                  </span>
                </Button>
              </Label>
            </div>
          )}
        </div>
      )}

      {type === "lms" && (
        <div className="flex items-center gap-2">
          <Select
            value={lmsCourseId ?? "__none__"}
            onValueChange={handleCourseChange}
            disabled={loadingCourses || savingCourse}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingCourses ? "Chargement..." : "Sélectionner un cours"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Aucun cours</SelectItem>
              {publishedCourses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
              {publishedCourses.length === 0 && !loadingCourses && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  Aucun cours publié
                </div>
              )}
            </SelectContent>
          </Select>
          {savingCourse && <Spinner />}
        </div>
      )}

      {type === "lms" && lmsCourseId && (
        <p className="text-xs text-muted-foreground">
          Les participants de cette formation sont inscrits automatiquement au cours.
        </p>
      )}
    </div>
  );
};

export default SupportsSection;
