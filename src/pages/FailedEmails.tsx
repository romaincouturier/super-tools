import { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Mail, CheckCircle, AlertTriangle, Trash2, Eye } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface FailedEmail {
  id: string;
  training_id: string | null;
  participant_id: string | null;
  recipient_email: string;
  subject: string;
  html_content: string;
  error_message: string | null;
  email_type: string | null;
  retry_count: number;
  status: string;
  original_sent_at: string;
  last_retry_at: string | null;
  created_at: string;
}

const FailedEmails = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [failedEmails, setFailedEmails] = useState<FailedEmail[]>([]);
  const [scheduledFailed, setScheduledFailed] = useState<any[]>([]);
  const [previewEmail, setPreviewEmail] = useState<FailedEmail | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    fetchFailedEmails();
    fetchScheduledFailed();
  }, [user]);

  const fetchFailedEmails = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from("failed_emails")
        .select("*")
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      setFailedEmails(data || []);
    } catch (error) {
      console.error("Error fetching failed emails:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledFailed = async () => {
    try {
      const { data, error } = await supabase
        .from("scheduled_emails")
        .select("*, trainings(training_name), training_participants(first_name, last_name, email)")
        .eq("status", "failed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setScheduledFailed(data || []);
    } catch (error) {
      console.error("Error fetching failed scheduled emails:", error);
    }
  };

  const handleDelete = async (failedEmailId: string) => {
    try {
      const { error } = await (supabase
        .from("failed_emails")
        .delete()
        .eq("id", failedEmailId) as any);

      if (error) throw error;
      setFailedEmails((prev) => prev.filter((e) => e.id !== failedEmailId));
      toast({ title: "Email supprimé" });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalErrors = failedEmails.filter((e) => e.status === "failed").length + scheduledFailed.length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6" />
              Emails en erreur
              {totalErrors > 0 && (
                <Badge variant="destructive">{totalErrors}</Badge>
              )}
            </h1>
            <p className="text-muted-foreground text-sm">
              Visualisez les emails qui n'ont pas pu être envoyés
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Scheduled emails in error */}
            {scheduledFailed.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Emails programmés en erreur ({scheduledFailed.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Formation</TableHead>
                        <TableHead>Destinataire</TableHead>
                        <TableHead>Erreur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledFailed.map((email) => (
                        <TableRow key={email.id}>
                          <TableCell className="text-sm">
                            {formatDate(email.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{email.email_type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {email.trainings?.training_name || "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {email.training_participants?.email || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                            {email.error_message || "Erreur inconnue"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ad-hoc failed emails */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Emails en erreur ({failedEmails.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {failedEmails.length === 0 && scheduledFailed.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                    <p className="text-lg">Aucun email en erreur</p>
                    <p className="text-sm">Tous les emails ont été envoyés avec succès.</p>
                  </div>
                ) : failedEmails.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground">Aucun email ad-hoc en erreur.</p>
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Destinataire</TableHead>
                        <TableHead>Objet</TableHead>
                        <TableHead>Erreur</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failedEmails.map((email) => (
                        <TableRow key={email.id}>
                          <TableCell className="text-sm">
                            {formatDate(email.created_at)}
                          </TableCell>
                          <TableCell className="text-sm">{email.recipient_email}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {email.subject}
                          </TableCell>
                          <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                            {email.error_message || "—"}
                          </TableCell>
                          <TableCell>
                            {email.status === "sent" ? (
                              <Badge className="bg-green-100 text-green-800">Envoyé</Badge>
                            ) : (
                              <Badge variant="destructive">Erreur</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPreviewEmail(email)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(email.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Email preview dialog */}
      <Dialog open={!!previewEmail} onOpenChange={() => setPreviewEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Aperçu de l'email
            </DialogTitle>
          </DialogHeader>
          {previewEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Destinataire:</span>{" "}
                  <span className="font-medium">{previewEmail.recipient_email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  <span>{formatDate(previewEmail.created_at)}</span>
                </div>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Objet:</span>{" "}
                <span className="font-medium">{previewEmail.subject}</span>
              </div>
              {previewEmail.error_message && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    <strong>Erreur:</strong> {previewEmail.error_message}
                  </p>
                </div>
              )}
              <div className="border rounded-lg p-4 bg-white dark:bg-gray-900">
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewEmail.html_content) }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FailedEmails;
