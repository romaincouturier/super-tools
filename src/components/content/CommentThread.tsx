import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2, MessageCircle, X, Pencil, Image, FileText, Palette, Trash2, Copy, Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import MentionTextarea, { MentionUser } from "./MentionTextarea";

interface Comment {
  id: string;
  author_id: string;
  author_email?: string;
  content: string;
  proposed_correction?: string | null;
  comment_type?: "fond" | "forme" | null;
  image_url?: string | null;
  created_at: string;
  parent_comment_id: string | null;
  status: "pending" | "approved" | "refused" | "corrected";
  resolved_at: string | null;
}

const commentTypeConfig = {
  fond: { label: "Fond", icon: FileText, className: "bg-purple-100 text-purple-800" },
  forme: { label: "Forme", icon: Palette, className: "bg-cyan-100 text-cyan-800" },
};

interface CommentThreadProps {
  reviewId: string;
  cardId?: string;
  cardTitle?: string;
  isAuthor?: boolean;
  isReviewer?: boolean;
  reviewStatus: string;
  onCommentAdded?: () => void;
}

const commentStatusConfig = {
  pending: { label: "En attente", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Accepté", className: "bg-green-100 text-green-800" },
  refused: { label: "Non pertinent", className: "bg-red-100 text-red-800" },
  corrected: { label: "Corrigé", className: "bg-blue-100 text-blue-800" },
};

const CommentThread = ({
  reviewId,
  cardId,
  cardTitle,
  reviewStatus,
  onCommentAdded
}: CommentThreadProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [proposedCorrection, setProposedCorrection] = useState("");
  const [commentType, setCommentType] = useState<"fond" | "forme" | "">("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pendingMentions, setPendingMentions] = useState<MentionUser[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchComments();
    getCurrentUser();
  }, [reviewId]);

  const getCurrentUser = async () => {
    const { data } = await supabase.auth.getSession();
    setCurrentUserId(data.session?.user?.id || null);
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("review_comments")
        .select("*")
        .eq("review_id", reviewId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Resolve author names from profiles
      const rawComments = data || [];
      const authorIds = [...new Set(rawComments.map((c: any) => c.author_id))];
      
      let profileMap: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email")
          .in("user_id", authorIds);
        
        if (profiles) {
          for (const p of profiles) {
            const fullName = p.first_name && p.last_name
              ? `${p.first_name} ${p.last_name}`
              : p.email || undefined;
            if (fullName) profileMap[p.user_id] = fullName;
          }
        }
      }

      setComments(rawComments.map((c: any) => ({
        ...c,
        author_email: profileMap[c.author_id] || c.author_email,
      })) as Comment[]);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("L'image ne doit pas dépasser 5 Mo");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            toast.error("L'image ne doit pas dépasser 5 Mo");
            return;
          }
          setImageFile(file);
          const reader = new FileReader();
          reader.onloadend = () => {
            setImagePreview(reader.result as string);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      toast.error("Votre session a expiré — reconnectez-vous puis réessayez");
      return null;
    }

    try {
      // Convert file to base64 data URL
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload via edge function (service-role) to bypass Storage RLS
      const { data: uploadData, error: invokeError } = await supabase.functions.invoke(
        "create-review-image-upload-url",
        { body: { originalFileName: file.name, mimeType: file.type, reviewId, fileBase64 } }
      );

      if (invokeError) throw invokeError;

      const publicUrl = (uploadData as any)?.publicUrl as string | undefined;
      if (!publicUrl) {
        console.error("[CommentThread] Invalid upload response:", uploadData);
        throw new Error("Réponse d'upload invalide. Veuillez réessayer.");
      }

      return publicUrl;
    } catch (error: any) {
      console.error("Upload error:", error);
      const statusCode = (error as any)?.statusCode as number | undefined;
      const message = String(error?.message || "").trim();
      const msg = [statusCode ? `HTTP ${statusCode}` : null, message || null]
        .filter(Boolean)
        .join(" — ");
      toast.error(msg ? `Upload impossible : ${msg}` : "Erreur lors de l'upload de l'image");
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        toast.error("Vous devez être connecté");
        return;
      }

      // Upload image if present
      let imageUrl: string | null = null;
      if (imageFile) {
        setUploadingImage(true);
        imageUrl = await uploadImage(imageFile);
        setUploadingImage(false);
        if (!imageUrl) {
          // Upload failed, don't submit comment without the intended image
          return;
        }
      }

      const { error } = await (supabase as any).from("review_comments").insert({
        review_id: reviewId,
        author_id: userId,
        content: newComment.trim(),
        proposed_correction: proposedCorrection.trim() || null,
        comment_type: commentType || null,
        image_url: imageUrl,
        status: "pending",
      });

      if (error) throw error;

      // Create notification for the other party
      const { data: reviewData } = await supabase
        .from("content_reviews")
        .select("reviewer_id, created_by")
        .eq("id", reviewId)
        .single();

      if (reviewData) {
        const notifyUserId =
          reviewData.reviewer_id === userId
            ? reviewData.created_by
            : reviewData.reviewer_id;

        if (notifyUserId) {
          // First 10 words as preview
          const preview = newComment.trim().split(/\s+/).slice(0, 10).join(" ");
          const previewText = newComment.trim().split(/\s+/).length > 10 ? `${preview}…` : preview;

          await (supabase as any).from("content_notifications").insert({
            user_id: notifyUserId,
            type: "comment_added",
            reference_id: reviewId,
            card_id: cardId || null,
            message: previewText,
          });
        }
      }

      // Send notifications to mentioned users
      if (pendingMentions.length > 0) {
        const { data: authorProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("user_id", userId)
          .maybeSingle();

        const authorName = authorProfile?.first_name && authorProfile?.last_name
          ? `${authorProfile.first_name} ${authorProfile.last_name}`
          : authorProfile?.email || "Quelqu'un";

        const mentionPreview = newComment.trim().split(/\s+/).slice(0, 10).join(" ");
        const mentionPreviewText = newComment.trim().split(/\s+/).length > 10 ? `${mentionPreview}…` : mentionPreview;

        for (const mention of pendingMentions) {
          // Skip self-mention
          if (mention.userId === userId) continue;

          // In-app notification
          await (supabase as any).from("content_notifications").insert({
            user_id: mention.userId,
            type: "comment_added",
            reference_id: reviewId,
            card_id: cardId || null,
            message: `${authorName} : ${mentionPreviewText}`,
          });

          // Email notification
          await supabase.functions.invoke("send-content-notification", {
            body: {
              type: "mention",
              recipientEmail: mention.email,
              cardTitle: cardTitle || "un contenu",
              cardId: cardId || undefined,
              authorName,
              commentText: newComment.trim(),
            },
          });
        }
      }

      setNewComment("");
      setProposedCorrection("");
      setCommentType("");
      setPendingMentions([]);
      clearImage();
      fetchComments();
      onCommentAdded?.();
      toast.success("Commentaire ajouté");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Erreur lors de l'ajout du commentaire");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCommentStatus = async (
    commentId: string,
    status: "approved" | "refused" | "corrected"
  ) => {
    try {
      const { error } = await supabase
        .from("review_comments")
        .update({
          status,
          resolved_at: new Date().toISOString()
        })
        .eq("id", commentId);

      if (error) throw error;

      fetchComments();
      onCommentAdded?.(); // Notify parent to refresh pending count
      toast.success(
        status === "approved"
          ? "Retour accepté"
          : status === "refused"
            ? "Retour rejeté"
            : "Correction effectuée"
      );
    } catch (error) {
      console.error("Error updating comment status:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Supprimer ce commentaire ?")) return;

    try {
      const { error } = await supabase
        .from("review_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      fetchComments();
      onCommentAdded?.(); // Notify parent to refresh pending count
      toast.success("Commentaire supprimé");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const getInitials = (authorId?: string, displayName?: string) => {
    if (authorId === currentUserId) return "😊";
    if (!displayName) return "?";
    return displayName
      .split(/[\s.@]+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderCommentContent = (text: string) => {
    // Highlight @mentions: match @Name or @First Last (up to 3 words)
    const parts = text.split(/(@\w+(?:\s\w+){0,2})/g);
    return parts.map((part, i) => {
      if (part.startsWith("@") && part.length > 1) {
        return (
          <span key={i} className="text-primary font-medium bg-primary/10 rounded px-0.5">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const pendingCount = comments.filter(c => c.status === "pending").length;

  return (
    <div className="border-t pt-3 mt-3">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setShowComments(!showComments)}
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        {showComments ? "Masquer" : "Afficher"} les commentaires
        {comments.length > 0 && (
          <span className="ml-1">
            ({comments.length})
            {pendingCount > 0 && (
              <span className="ml-1 text-orange-600">• {pendingCount} en attente</span>
            )}
          </span>
        )}
      </Button>

      {showComments && (
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Ajoutez vos commentaires de relecture ci-dessous
            </p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {comments.map((comment) => {
                const statusConf = commentStatusConfig[comment.status];
                // Permettre à tout utilisateur authentifié de traiter les commentaires en attente
                const canResolve = currentUserId && comment.status === "pending";

                return (
                  <div 
                    key={comment.id} 
                    className={cn(
                      "flex gap-2 p-2 rounded-lg transition-colors",
                      comment.status === "pending" && "bg-yellow-50 border border-yellow-200"
                    )}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs">
                        {getInitials(comment.author_id, comment.author_email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium">
                          {comment.author_id === currentUserId
                            ? "Moi"
                            : comment.author_email || "Utilisateur"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {comment.comment_type && commentTypeConfig[comment.comment_type] && (() => {
                          const config = commentTypeConfig[comment.comment_type!];
                          const TypeIcon = config.icon;
                          return (
                            <Badge
                              variant="secondary"
                              className={cn("text-xs gap-1", config.className)}
                            >
                              <TypeIcon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                          );
                        })()}
                        <Badge
                          variant="secondary"
                          className={cn("text-xs", statusConf.className)}
                        >
                          {statusConf.label}
                        </Badge>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{renderCommentContent(comment.content)}</p>

                      {/* Image jointe */}
                      {comment.image_url && (
                        <div className="mt-2">
                          <a href={comment.image_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={comment.image_url}
                              alt="Capture d'écran"
                              className="max-w-full max-h-48 rounded border cursor-pointer hover:opacity-90"
                            />
                          </a>
                        </div>
                      )}

                      {/* Correction proposée (optionnelle) */}
                      {comment.proposed_correction && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm relative group/correction">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-blue-700">Correction proposée :</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover/correction:opacity-100 transition-opacity text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(comment.proposed_correction!);
                                toast.success("Correction copiée");
                              }}
                              title="Copier la correction"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="text-blue-900 mt-1 whitespace-pre-wrap">{comment.proposed_correction}</p>
                        </div>
                      )}

                      {/* Actions pour l'auteur de la carte */}
                      {canResolve && (
                        <TooltipProvider>
                          <div className="flex gap-1 mt-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleUpdateCommentStatus(comment.id, "corrected")}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  J'ai corrigé
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>J'ai effectué la correction demandée</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleUpdateCommentStatus(comment.id, "refused")}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Non pertinent
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Ce retour n'est pas pertinent</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      )}

                      {/* Bouton supprimer */}
                      {currentUserId && (
                        <div className="flex justify-end mt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Supprimer
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Zone de saisie - visible surtout pour le relecteur */}
          {reviewStatus !== "approved" && (
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
              {/* Type de commentaire et textarea sur la même ligne */}
              <div className="flex gap-2">
                <Select value={commentType} onValueChange={(v) => setCommentType(v as "fond" | "forme" | "")}>
                  <SelectTrigger className="w-24 h-auto">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fond">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Fond
                      </span>
                    </SelectItem>
                    <SelectItem value="forme">
                      <span className="flex items-center gap-1">
                        <Palette className="h-3 w-3" /> Forme
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <MentionTextarea
                  value={newComment}
                  onChange={setNewComment}
                  onMentionsChange={setPendingMentions}
                  onPaste={handlePaste}
                  placeholder="Commentaire... (@nom pour mentionner)"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleSubmit();
                    }
                  }}
                />
                <div className="flex flex-col gap-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    title="Ajouter une capture"
                  >
                    <Image className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={handleSubmit}
                    disabled={submitting || uploadingImage || !newComment.trim()}
                  >
                    {submitting || uploadingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Prévisualisation de l'image */}
              {imagePreview && (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Prévisualisation" className="max-h-24 rounded border" />
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5"
                    onClick={clearImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Correction proposée */}
              <Textarea
                value={proposedCorrection}
                onChange={(e) => setProposedCorrection(e.target.value)}
                placeholder="Correction proposée (optionnel)"
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentThread;
