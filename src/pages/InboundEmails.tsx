import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  ArrowLeft,
  Mail,
  Inbox,
  Search,
  RefreshCw,
  ExternalLink,
  Archive,
  Trash2,
  Link2,
  User,
  Calendar,
  Paperclip,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface InboundEmail {
  id: string;
  message_id: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  attachments: { filename: string; content_type: string; size: number }[];
  status: string;
  received_at: string;
  linked_training_id: string | null;
  linked_participant_id: string | null;
  notes: string | null;
}

export default function InboundEmails() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Fetch emails
  const { data: emails, isLoading, refetch } = useQuery({
    queryKey: ["inbound-emails", statusFilter, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("inbound_emails")
        .select("*")
        .order("received_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (searchQuery) {
        query = query.or(
          `from_email.ilike.%${searchQuery}%,subject.ilike.%${searchQuery}%,from_name.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data || []) as unknown as InboundEmail[];
    },
    enabled: !!user,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("inbound_emails")
        .update({ status, processed_at: status === "processed" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
      toast({ title: "Statut mis à jour" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inbound_emails").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
      setSelectedEmail(null);
      toast({ title: "Email supprimé" });
    },
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "received":
        return <Badge variant="default">Reçu</Badge>;
      case "processed":
        return <Badge variant="secondary">Traité</Badge>;
      case "archived":
        return <Badge variant="outline">Archivé</Badge>;
      case "spam":
        return <Badge variant="destructive">Spam</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Inbox className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Emails reçus</h1>
              <p className="text-sm text-muted-foreground">
                Boîte de réception des emails entrants
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par email ou sujet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="received">Reçus</SelectItem>
              <SelectItem value="processed">Traités</SelectItem>
              <SelectItem value="archived">Archivés</SelectItem>
              <SelectItem value="spam">Spam</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Email list */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          </div>
        ) : emails?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">Aucun email reçu</h3>
              <p className="text-muted-foreground">
                Les emails envoyés à votre adresse Resend apparaîtront ici.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {emails?.map((email) => (
                  <div
                    key={email.id}
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {email.from_name || email.from_email}
                          </span>
                          {email.from_name && (
                            <span className="text-sm text-muted-foreground truncate">
                              &lt;{email.from_email}&gt;
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate">
                          {email.subject || "(Sans sujet)"}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {email.text_body?.substring(0, 100) || "(Pas de contenu texte)"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(email.received_at)}
                        </span>
                        {getStatusBadge(email.status)}
                        {email.attachments?.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Paperclip className="h-3 w-3" />
                            {email.attachments.length}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email detail dialog */}
        <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="pr-8">{selectedEmail?.subject || "(Sans sujet)"}</DialogTitle>
              <DialogDescription>
                De: {selectedEmail?.from_name || selectedEmail?.from_email}
                {selectedEmail?.from_name && ` <${selectedEmail.from_email}>`}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 py-2">
              {selectedEmail && getStatusBadge(selectedEmail.status)}
              <span className="text-sm text-muted-foreground">
                Reçu le {selectedEmail && formatDate(selectedEmail.received_at)}
              </span>
              {selectedEmail?.linked_training_id && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => navigate(`/formations/${selectedEmail.linked_training_id}`)}
                >
                  <Link2 className="h-3 w-3 mr-1" />
                  Voir la formation
                </Button>
              )}
            </div>

            <Separator />

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 py-4">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">À:</span> {selectedEmail?.to_email}
                  </div>
                  {selectedEmail?.attachments && selectedEmail.attachments.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Pièces jointes:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedEmail.attachments.map((att, i) => (
                          <Badge key={i} variant="outline" className="font-normal">
                            <Paperclip className="h-3 w-3 mr-1" />
                            {att.filename} ({formatFileSize(att.size)})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Content */}
                {selectedEmail?.html_body ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(selectedEmail.html_body, {
                        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'hr', 'sub', 'sup'],
                        ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'style', 'class', 'colspan', 'rowspan'],
                        ALLOW_DATA_ATTR: false,
                      })
                    }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm font-sans">
                    {selectedEmail?.text_body || "(Pas de contenu)"}
                  </pre>
                )}
              </div>
            </ScrollArea>

            <Separator />

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <div className="flex gap-2">
                {selectedEmail?.status !== "processed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      selectedEmail &&
                      updateStatusMutation.mutate({ id: selectedEmail.id, status: "processed" })
                    }
                  >
                    Marquer comme traité
                  </Button>
                )}
                {selectedEmail?.status !== "archived" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      selectedEmail &&
                      updateStatusMutation.mutate({ id: selectedEmail.id, status: "archived" })
                    }
                  >
                    <Archive className="h-4 w-4 mr-1" />
                    Archiver
                  </Button>
                )}
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (selectedEmail && confirm("Supprimer cet email ?")) {
                    deleteMutation.mutate(selectedEmail.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
