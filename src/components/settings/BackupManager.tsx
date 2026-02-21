import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  HardDrive,
} from "lucide-react";

interface BackupManagerProps {
  backupEnabled: boolean;
  gdriveFolderId: string;
  onSettingsChange: (key: string, value: string) => void;
  hasGoogleDrive: boolean;
}

export default function BackupManager({
  backupEnabled,
  gdriveFolderId,
  onSettingsChange,
  hasGoogleDrive,
}: BackupManagerProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dryRunResults, setDryRunResults] = useState<Record<string, { deleted: number; inserted: number }> | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleExportLocal = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-export", {
        body: { uploadToGDrive: false },
      });

      if (error) throw error;

      // Create download link
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `supertools_backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Succès", description: "Sauvegarde téléchargée avec succès" });
    } catch (error) {
      console.error("Export error:", error);
      toast({ title: "Erreur", description: "Erreur lors de l'export", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleExportGDrive = async () => {
    setExporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke("backup-export", {
        body: { uploadToGDrive: true, userId: user?.id },
      });

      if (error) throw error;

      if (data.googleDrive) {
        toast({ title: "Succès", description: `Sauvegarde uploadée sur Google Drive: ${data.fileName}` });
      } else {
        toast({ title: "Attention", description: "Sauvegarde créée mais pas d'accès Google Drive configuré" });
      }
    } catch (error) {
      console.error("Export to GDrive error:", error);
      toast({ title: "Erreur", description: "Erreur lors de l'export vers Google Drive", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setDryRunResults(null);
    }
  };

  const handleDryRun = async () => {
    if (!selectedFile) return;

    setImporting(true);
    try {
      const text = await selectedFile.text();
      const backupData = JSON.parse(text);

      const { data, error } = await supabase.functions.invoke("backup-import", {
        body: { backupData, dryRun: true },
      });

      if (error) throw error;

      setDryRunResults(data.results);
      toast({ description: "Simulation terminée. Vérifiez les résultats avant de restaurer." });
    } catch (error) {
      console.error("Dry run error:", error);
      toast({ title: "Erreur", description: "Erreur lors de la simulation", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) return;

    setImporting(true);
    try {
      const text = await selectedFile.text();
      const backupData = JSON.parse(text);

      const { data, error } = await supabase.functions.invoke("backup-import", {
        body: { backupData, dryRun: false },
      });

      if (error) throw error;

      toast({ title: "Succès", description: "Restauration terminée avec succès !" });
      setSelectedFile(null);
      setDryRunResults(null);
    } catch (error) {
      console.error("Restore error:", error);
      toast({ title: "Erreur", description: "Erreur lors de la restauration", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <CardTitle>Sauvegarde & PRA</CardTitle>
        </div>
        <CardDescription>
          Plan de Reprise d'Activité : Export et restauration des données
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto Backup Settings */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Sauvegarde automatique</h3>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="backup-enabled">Activer les sauvegardes quotidiennes</Label>
              <p className="text-sm text-muted-foreground">
                Sauvegarde automatique vers Google Drive chaque nuit
              </p>
            </div>
            <Switch
              id="backup-enabled"
              checked={backupEnabled}
              onCheckedChange={(checked) => onSettingsChange("backup_enabled", checked.toString())}
              disabled={!hasGoogleDrive}
            />
          </div>
          
          {!hasGoogleDrive && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning-foreground">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm">Connectez Google Drive pour activer les sauvegardes automatiques</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="gdrive-folder">ID du dossier Google Drive</Label>
            <Input
              id="gdrive-folder"
              value={gdriveFolderId}
              onChange={(e) => onSettingsChange("backup_gdrive_folder_id", e.target.value)}
              placeholder="1abc...xyz (optionnel)"
            />
            <p className="text-xs text-muted-foreground">
              Laissez vide pour sauvegarder à la racine de Drive
            </p>
          </div>
        </div>

        {/* Manual Export */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-medium text-sm">Export manuel</h3>
          <div className="flex gap-2">
            <Button onClick={handleExportLocal} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Télécharger la sauvegarde
            </Button>
            {hasGoogleDrive && (
              <Button variant="outline" onClick={handleExportGDrive} disabled={exporting}>
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <HardDrive className="h-4 w-4 mr-2" />
                )}
                Exporter vers Google Drive
              </Button>
            )}
          </div>
        </div>

        {/* Import / Restore */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Restauration (PRA)
          </h3>
          <p className="text-sm text-muted-foreground">
            ⚠️ La restauration remplacera TOUTES les données actuelles. Utilisez avec précaution.
          </p>

          <div className="space-y-2">
            <Label htmlFor="backup-file">Fichier de sauvegarde</Label>
            <Input
              id="backup-file"
              type="file"
              accept=".json"
              onChange={handleFileSelect}
            />
          </div>

          {selectedFile && (
            <div className="space-y-3">
              <Badge variant="secondary" className="gap-2">
                <CheckCircle className="h-3 w-3" />
                {selectedFile.name}
              </Badge>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDryRun} disabled={importing}>
                  {importing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Simuler la restauration
                </Button>

                {dryRunResults && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={importing}>
                        <Upload className="h-4 w-4 mr-2" />
                        Restaurer maintenant
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmer la restauration</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action va remplacer TOUTES les données actuelles de SuperTools par
                          celles de la sauvegarde. Cette action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestore} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Oui, restaurer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              {dryRunResults && (
                <div className="p-3 rounded-lg bg-muted text-sm">
                  <h4 className="font-medium mb-2">Résultat de la simulation :</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {Object.entries(dryRunResults).map(([table, { deleted, inserted }]) => (
                      <div key={table} className="flex justify-between">
                        <span className="text-muted-foreground">{table}</span>
                        <span>
                          <span className="text-destructive">-{deleted}</span> / <span className="text-primary">+{inserted}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
