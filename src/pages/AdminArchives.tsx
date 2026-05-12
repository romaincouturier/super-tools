import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Upload, Search, X, Loader2, FileText, FileImage, File, Trash2, Calendar, Tag, AlertCircle, RotateCcw } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { toastError } from "@/lib/toastError";
import {
  fetchAdminDocuments,
  fetchAdminDocumentYears,
  uploadAdminDocument,
  deleteAdminDocument,
  ARCHIVE_CATEGORIES,
  type AdminDocument,
} from "@/services/adminDocuments";

function fileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-5 w-5 text-muted-foreground" />;
  if (mimeType.startsWith("image/")) return <FileImage className="h-5 w-5 text-blue-500" />;
  if (mimeType === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

function statusBadge(doc: AdminDocument) {
  if (doc.analysis_status === "pending") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analyse en cours…
      </span>
    );
  }
  if (doc.analysis_status === "failed") {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="h-3 w-3" />
        Analyse échouée
      </span>
    );
  }
  return null;
}

export default function AdminArchives() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);

  const { data: years = [] } = useQuery({
    queryKey: ["admin-document-years"],
    queryFn: fetchAdminDocumentYears,
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["admin-documents", selectedYear, selectedCategory, search],
    queryFn: () =>
      fetchAdminDocuments({
        year: selectedYear,
        category: selectedCategory,
        search: search.trim() || undefined,
      }),
    refetchInterval: (query) => {
      const docs = query.state.data ?? [];
      return docs.some((d: AdminDocument) => d.analysis_status === "pending") ? 3000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
      queryClient.invalidateQueries({ queryKey: ["admin-document-years"] });
      toast({ title: "Document supprimé" });
    },
    onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur lors de la suppression"),
  });

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setUploadingCount((c) => c + files.length);
      let uploaded = 0;
      for (const file of files) {
        try {
          await uploadAdminDocument(file);
          uploaded++;
        } catch (err) {
          toastError(toast, err instanceof Error ? err : `Échec upload : ${file.name}`);
        } finally {
          setUploadingCount((c) => c - 1);
        }
      }
      if (uploaded > 0) {
        queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
        queryClient.invalidateQueries({ queryKey: ["admin-document-years"] });
        toast({ title: `${uploaded} document${uploaded > 1 ? "s" : ""} ajouté${uploaded > 1 ? "s" : ""}`, description: "Analyse en cours…" });
      }
    },
    [toast, queryClient],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    handleFiles(files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleOpenDocument = async (doc: AdminDocument) => {
    // Some browsers (Brave Shields, ad-blockers, strict tracking protection)
    // block direct navigation to *.supabase.co. Fetch the file through the
    // Supabase SDK and open it as a local blob: URL to bypass the block.
    try {
      const marker = "/admin-archives/";
      const idx = doc.file_url.indexOf(marker);
      const path = idx >= 0 ? doc.file_url.slice(idx + marker.length).split("?")[0] : null;
      if (!path) throw new Error("Chemin de fichier introuvable");

      const { data, error } = await supabase.storage.from("admin-archives").download(path);
      if (error || !data) throw error ?? new Error("Téléchargement impossible");

      const mime = doc.mime_type || data.type || "application/octet-stream";
      const blob = data.type ? data : new Blob([data], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      const win = window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (!win) {
        // Popup bloqué : on déclenche un téléchargement direct
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = doc.file_name || "document";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      // Libère l'URL après quelques secondes (laisse le temps au viewer)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e: any) {
      console.error("[AdminArchives] open document failed", e);
      toast({
        title: "Impossible d'ouvrir le document",
        description:
          e?.message ??
          "Votre navigateur bloque l'accès au stockage. Essayez de désactiver Brave Shields / le bloqueur sur ce site.",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setSelectedYear(null);
    setSelectedCategory(null);
    setSearch("");
  };

  const hasActiveFilters = selectedYear !== null || selectedCategory !== null || search.trim() !== "";

  return (
    <ModuleLayout>
      <PageHeader
        icon={Archive}
        title="Archives administratives"
        subtitle="Tous vos documents classés automatiquement par l'IA"
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleInputChange}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingCount > 0}
            >
              {uploadingCount > 0 ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploadingCount > 0 ? `Upload en cours (${uploadingCount})…` : "Ajouter des documents"}
            </Button>
          </>
        }
      />

      <div className="flex gap-6 p-6 min-h-0 flex-1">
        {/* Sidebar filtres */}
        <aside className="w-52 flex-shrink-0 space-y-6">
          {/* Années */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Années
            </p>
            <ul className="space-y-0.5">
              <li>
                <button
                  onClick={() => setSelectedYear(null)}
                  className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                    selectedYear === null ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
                  }`}
                >
                  Toutes
                </button>
              </li>
              {years.map((y) => (
                <li key={y}>
                  <button
                    onClick={() => setSelectedYear(y)}
                    className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                      selectedYear === y ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
                    }`}
                  >
                    {y}
                  </button>
                </li>
              ))}
              {years.length === 0 && (
                <li className="text-xs text-muted-foreground px-2 py-1">Aucune année</li>
              )}
            </ul>
          </div>

          {/* Catégories */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" /> Catégories
            </p>
            <ul className="space-y-0.5">
              <li>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                    selectedCategory === null ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
                  }`}
                >
                  Toutes
                </button>
              </li>
              {ARCHIVE_CATEGORIES.map((cat) => (
                <li key={cat}>
                  <button
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                      selectedCategory === cat ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
                    }`}
                  >
                    {cat}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Zone principale */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Barre de recherche */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Réinitialiser
              </Button>
            )}
            <span className="text-sm text-muted-foreground ml-auto">
              {documents.length} document{documents.length > 1 ? "s" : ""}
            </span>
          </div>

          {/* Zone de dépôt */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg px-4 py-3 text-center text-sm text-muted-foreground transition-colors cursor-pointer ${
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 inline mr-2 -mt-0.5" />
            Glissez-déposez vos documents ici ou cliquez pour les sélectionner
          </div>

          {/* Liste des documents */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Archive className="h-12 w-12 opacity-20" />
              <p className="text-sm">
                {hasActiveFilters ? "Aucun document correspond à ces filtres." : "Aucun document encore. Commencez par en déposer un."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-start gap-3 p-3 bg-card border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="mt-0.5 flex-shrink-0">{fileIcon(doc.mime_type)}</div>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleOpenDocument(doc)}
                      className="text-sm font-medium text-primary hover:underline truncate block max-w-full text-left"
                    >
                      {doc.file_name}
                    </button>
                    {doc.analysis_status === "done" ? (
                      <>
                        {doc.summary && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{doc.summary}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {doc.year && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              {doc.year}
                            </Badge>
                          )}
                          {doc.category && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {doc.category}
                            </Badge>
                          )}
                          {(doc.tags ?? []).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="mt-1">{statusBadge(doc)}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {new Date(doc.uploaded_at).toLocaleDateString("fr-FR")}
                    </span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            &quot;{doc.file_name}&quot; sera supprimé définitivement.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(doc)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModuleLayout>
  );
}
