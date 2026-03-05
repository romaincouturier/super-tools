import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  Clock,
  XCircle,
} from "lucide-react";

interface BackupManagerProps {
  backupEnabled: boolean;
  gdriveFolderId: string;
  onSettingsChange: (key: string, value: string) => void;
  hasGoogleDrive: boolean;
}

interface LastBackupInfo {
  date: string;
  success: boolean;
  tablesCount: number;
  totalRows: number;
  backupSizeMB: string;
  googleDriveFileId: string | null;
  errors: string[] | null;
  durationMs: number;
}

export default function BackupManager({
  backupEnabled,
  gdriveFolderId,
  onSettingsChange,
  hasGoogleDrive,
}: BackupManagerProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dryRunResults, setDryRunResults] = useState<Record<string, { deleted: number; inserted: number }> | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastBackup, setLastBackup] = useState<LastBackupInfo | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    fetchLastBackupStatus();
  }, []);

  const fetchLastBackupStatus = async () => {
    try {
      const { data } = await supabase
        .from("activity_logs")
        .select("created_at, details")
        .in("action_type", ["scheduled_backup", "backup_created"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data?.details) {
        const d = data.details as Record<string, unknown>;
        setLastBackup({
          date: data.created_at,
          success: (d.success as boolean) ?? (d.errors == null),
          tablesCount: (d.tablesCount as number) ?? 0,
          totalRows: (d.totalRows as number) ?? 0,
          backupSizeMB: (d.backupSizeMB as string) ?? "?",
          googleDriveFileId: (d.googleDriveFileId as string) ?? (d.googleDrive as { fileId?: string })?.fileId ?? null,
          errors: (d.errors as string[]) ?? null,
          durationMs: (d.durationMs as number) ?? 0,
        });
      }
    } catch {
      // No backup found
    } finally {
      setLoadingStatus(false);
    }
  };

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

      toast.success("Sauvegarde téléchargée avec succès");
      fetchLastBackupStatus();
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erreur lors de l'export");
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
        toast.success(`Sauvegarde uploadée sur Google Drive: ${data.fileName}`);
      } else {
        toast.warning("Sauvegarde créée mais pas d'accès Google Drive configuré");
      }
      fetchLastBackupStatus();
    } catch (error) {
      console.error("Export to GDrive error:", error);
      toast.error("Erreur lors de l'export vers Google Drive");
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
      toast.info("Simulation terminée. Vérifiez les résultats avant de restaurer.");
    } catch (error) {
      console.error("Dry run error:", error);
      toast.error("Erreur lors de la simulation");
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

      toast.success("Restauration terminée avec succès !");
      setSelectedFile(null);
      setDryRunResults(null);
    } catch (error) {
      console.error("Restore error:", error);
      toast.error("Erreur lors de la restauration");
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Last Backup Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle>Dernière sauvegarde</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          ) : lastBackup ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {lastBackup.success ? (
                  <Badge variant="default" className="gap-1.5 bg-green-600">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Réussie
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1.5">
                    <XCircle className="h-3.5 w-3.5" />
                    Avec erreurs
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {formatDate(lastBackup.date)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground text-xs">Tables</p>
                  <p className="font-medium">{lastBackup.tablesCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground text-xs">Lignes</p>
                  <p className="font-medium">{lastBackup.totalRows.toLocaleString("fr-FR")}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground text-xs">Taille</p>
                  <p className="font-medium">{lastBackup.backupSizeMB} Mo</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground text-xs">Google Drive</p>
                  <p className="font-medium">{lastBackup.googleDriveFileId ? "Oui" : "Non"}</p>
                </div>
              </div>
              {lastBackup.errors && lastBackup.errors.length > 0 && (
                <div className="p-3 rounded-lg bg-destructive/10 text-sm">
                  <p className="font-medium text-destructive mb-1">Erreurs ({lastBackup.errors.length})</p>
                  <ul className="list-disc list-inside text-destructive/80 space-y-0.5">
                    {lastBackup.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {lastBackup.errors.length > 5 && (
                      <li>... et {lastBackup.errors.length - 5} autres</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm">Aucune sauvegarde trouvée</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Backup Card */}
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
                  Sauvegarde automatique vers Google Drive chaque nuit (rétention 14 jours)
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
                <p className="text-sm">Connectez Google Drive dans l'onglet Intégrations pour activer les sauvegardes automatiques</p>
              </div>
            )}

            {backupEnabled && hasGoogleDrive && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <p className="text-sm">
                  Sauvegarde automatique active. Un email de rapport est envoyé chaque jour.
                </p>
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
                Laissez vide pour sauvegarder à la racine de Drive. Recommandé : créer un dossier dédié pour la rotation automatique.
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
              La restauration remplacera TOUTES les données actuelles. Utilisez avec précaution.
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
    </div>
  );
}
