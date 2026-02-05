import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2, MessageCircle, Check, X, Pencil, Image, FileText, Palette, Trash2 } from "lucide-react";
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
  isAuthor: boolean;
  isReviewer: boolean;
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
  isAuthor,
  isReviewer,
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

      setComments((data || []) as Comment[]);
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
    // Get extension from MIME type as fallback (important for pasted images)
    const mimeToExt: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };

    // Check if file has a proper extension, otherwise use MIME type
    const hasExtension = file.name.includes('.') && file.name.split('.').pop()?.length! <= 5;
    const fileExt = hasExtension ? file.name.split(".").pop() : mimeToExt[file.type] || 'png';
    const fileName = `${reviewId}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("review-images")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      toast.error("Erreur lors de l'upload de l'image");
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("review-images")
      .getPublicUrl(fileName);

    return urlData?.publicUrl || null;
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
          await supabase.from("content_notifications").insert({
            user_id: notifyUserId,
            type: "comment_added",
            reference_id: reviewId,
            message: "Nouveau commentaire sur une relecture",
          });
        }
      }

      setNewComment("");
      setProposedCorrection("");
      setCommentType("");
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

  const getInitials = (email?: string) => {
    if (!email) return "?";
    return email
      .split("@")[0]
      .split(".")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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
              {isReviewer 
                ? "Ajoutez vos commentaires de relecture ci-dessous"
                : "Aucun commentaire du relecteur pour le moment"
              }
            </p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {comments.map((comment) => {
                const statusConf = commentStatusConfig[comment.status];
                const canResolve = isAuthor && comment.status === "pending";

                return (
                  <div 
                    key={comment.id} 
                    className={cn(
                      "flex gap-2 p-2 rounded-lg transition-colors",
                      comment.status === "pending" && isAuthor && "bg-yellow-50 border border-yellow-200"
                    )}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs">
                        {getInitials(comment.author_email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium">
                          {comment.author_email || "Utilisateur"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {comment.comment_type && commentTypeConfig[comment.comment_type] && (
                          <Badge
                            variant="secondary"
                            className={cn("text-xs", commentTypeConfig[comment.comment_type].className)}
                          >
                            {commentTypeConfig[comment.comment_type].label}
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className={cn("text-xs", statusConf.className)}
                        >
                          {statusConf.label}
                        </Badge>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>

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
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                          <span className="font-medium text-blue-700">Correction proposée :</span>
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
                                  className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleUpdateCommentStatus(comment.id, "approved")}
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  D'accord
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Je suis d'accord avec ce retour</p>
                              </TooltipContent>
                            </Tooltip>
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

                      {/* Bouton supprimer pour l'auteur du commentaire */}
                      {currentUserId === comment.author_id && (
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
                {isReviewer && (
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
                )}
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onPaste={handlePaste}
                  placeholder={
                    isReviewer
                      ? "Commentaire... (Ctrl+V pour coller une capture)"
                      : "Répondre au relecteur..."
                  }
                  rows={2}
                  className="resize-none flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleSubmit();
                    }
                  }}
                />
                <div className="flex flex-col gap-1">
                  {isReviewer && (
                    <>
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
                    </>
                  )}
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
              {isReviewer && (
                <Textarea
                  value={proposedCorrection}
                  onChange={(e) => setProposedCorrection(e.target.value)}
                  placeholder="Correction proposée (optionnel)"
                  rows={2}
                  className="resize-none text-sm"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentThread;
