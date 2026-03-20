import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyContentUser } from "@/services/contentNotifications";
import {
  Send, Loader2, MessageSquare, X, Pencil, Image,
  FileText, Palette, Trash2, Copy, Mic, MicOff, Reply, CheckCheck,
  ChevronDown, ChevronRight, UserPlus
} from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import MentionTextarea, { MentionUser } from "./MentionTextarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Comment {
  id: string;
  review_id: string | null;
  card_id: string | null;
  author_id: string;
  author_email?: string;
  assigned_to?: string | null;
  assigned_name?: string;
  content: string;
  proposed_correction?: string | null;
  comment_type?: "fond" | "forme" | null;
  image_url?: string | null;
  created_at: string;
  parent_comment_id: string | null;
  status: "pending" | "approved" | "refused" | "corrected";
  resolved_at: string | null;
}

interface Profile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface CommentThreadProps {
  cardId: string;
  cardTitle?: string;
  reviewIds?: string[];
  onCommentAdded?: () => void;
}

const commentTypeConfig = {
  fond: { label: "Fond", icon: FileText, className: "bg-purple-100 text-purple-800" },
  forme: { label: "Forme", icon: Palette, className: "bg-cyan-100 text-cyan-800" },
};

const CommentThread = ({ cardId, cardTitle, reviewIds: _reviewIds, onCommentAdded }: CommentThreadProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expandedResolved, setExpandedResolved] = useState<Set<string>>(new Set());

  // New comment state
  const [newComment, setNewComment] = useState("");
  const [proposedCorrection, setProposedCorrection] = useState("");
  const [commentType, setCommentType] = useState<"fond" | "forme" | "">("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingMentions, setPendingMentions] = useState<MentionUser[]>([]);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCorrection, setEditCorrection] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Voice
  const [analyzingVoice, setAnalyzingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const voiceTranscriptRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isListening, isSupported: speechSupported, startListening, stopListening } = useSpeechRecognition("fr-FR", true);

  const [showCorrection, setShowCorrection] = useState(false);

  useEffect(() => {
    fetchComments();
    getCurrentUser();
    fetchProfiles();
  }, [cardId]);

  const getCurrentUser = async () => {
    const { data } = await supabase.auth.getSession();
    setCurrentUserId(data.session?.user?.id || null);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, email");
    if (data) setProfiles(data);
  };

  const fetchComments = async () => {
    try {
      // Fetch comments by card_id directly
      const { data, error } = await supabase
        .from("review_comments")
        .select("*")
        .eq("card_id", cardId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rawComments = (data || []) as Record<string, unknown>[];
      const authorIds = [...new Set(rawComments.map((c) => c.author_id).concat(rawComments.map((c) => c.assigned_to).filter(Boolean)))];

      let profileMap: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email")
          .in("user_id", authorIds as string[]);

        if (profs) {
          for (const p of profs) {
            const fullName = p.first_name && p.last_name
              ? `${p.first_name} ${p.last_name}`
              : p.email || undefined;
            if (fullName) profileMap[p.user_id as string] = fullName;
          }
        }
      }

      setComments(
        rawComments.map((c) => ({
          ...c,
          author_email: profileMap[c.author_id as string] || c.author_email,
          assigned_name: c.assigned_to ? profileMap[c.assigned_to as string] || undefined : undefined,
        })) as Comment[]
      );
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const topLevelComments = comments.filter((c) => !c.parent_comment_id);
  const repliesMap: Record<string, Comment[]> = {};
  comments.forEach((c) => {
    if (c.parent_comment_id) {
      if (!repliesMap[c.parent_comment_id]) repliesMap[c.parent_comment_id] = [];
      repliesMap[c.parent_comment_id].push(c);
    }
  });

  const pendingComments = topLevelComments.filter((c) => c.status === "pending");
  const resolvedComments = topLevelComments.filter((c) => c.status !== "pending");

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
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
          setImageFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setImagePreview(reader.result as string);
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data: uploadData, error } = await supabase.functions.invoke(
        "create-review-image-upload-url",
        { body: { originalFileName: file.name, mimeType: file.type, reviewId: cardId, fileBase64 } }
      );
      if (error) throw error;
      return (uploadData as Record<string, unknown> | null)?.publicUrl as string || null;
    } catch (error: unknown) {
      console.error("Upload error:", error);
      toast.error("Erreur lors de l'upload");
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) { toast.error("Vous devez être connecté"); return; }

      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) return;
      }

      const mentionedIds = pendingMentions.map((m) => m.userId).filter((id) => id !== userId);
      const insertData: Record<string, unknown> = {
        card_id: cardId,
        author_id: userId,
        content: newComment.trim(),
        proposed_correction: proposedCorrection.trim() || null,
        comment_type: commentType || null,
        image_url: imageUrl,
        status: "pending",
        assigned_to: (assignedTo && assignedTo !== "none") ? assignedTo : null,
        mentioned_user_ids: mentionedIds.length > 0 ? mentionedIds : [],
      };

      const { error } = await supabase.from("review_comments").insert(insertData as any);
      if (error) throw error;

      // Send notification to assigned person
      if (assignedTo && assignedTo !== userId) {
        const { data: authorProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", userId)
          .maybeSingle();
        const authorName = authorProfile?.first_name ? `${authorProfile.first_name} ${authorProfile.last_name || ""}`.trim() : "Quelqu'un";
        const preview = newComment.trim().split(/\s+/).slice(0, 10).join(" ");

        await supabase.from("content_notifications").insert({
          user_id: assignedTo,
          type: "comment_added",
          reference_id: cardId,
          card_id: cardId,
          message: `${authorName} : ${preview}`,
        });
      }

      // Mention notifications
      if (pendingMentions.length > 0) {
        const { data: authorProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("user_id", userId)
          .maybeSingle();
        const authorName = authorProfile?.first_name && authorProfile?.last_name
          ? `${authorProfile.first_name} ${authorProfile.last_name}`
          : authorProfile?.email || "Quelqu'un";

        for (const mention of pendingMentions) {
          if (mention.userId === userId) continue;
          await notifyContentUser(
            {
              userId: mention.userId,
              notificationType: "comment_added",
              referenceId: cardId,
              cardId,
              message: `${authorName} : ${newComment.trim().split(/\s+/).slice(0, 10).join(" ")}`,
            },
            {
              type: "mention",
              recipientEmail: mention.email,
              cardTitle: cardTitle || "un contenu",
              cardId,
              authorName,
              commentText: newComment.trim(),
            },
          );
        }
      }

      setNewComment("");
      setProposedCorrection("");
      setCommentType("");
      setAssignedTo("");
      setShowCorrection(false);
      setPendingMentions([]);
      clearImage();
      fetchComments();
      onCommentAdded?.();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erreur lors de l'ajout");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) { toast.error("Connectez-vous"); return; }

      const { error } = await supabase.from("review_comments").insert({
        card_id: cardId,
        author_id: userId,
        content: replyText.trim(),
        parent_comment_id: parentId,
        status: "pending",
      });

      if (error) throw error;

      setReplyingTo(null);
      setReplyText("");
      fetchComments();
      onCommentAdded?.();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erreur lors de la réponse");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleResolve = async (commentId: string, status: "corrected" | "refused") => {
    try {
      const { error } = await supabase
        .from("review_comments")
        .update({ status, resolved_at: new Date().toISOString() })
        .eq("id", commentId);
      if (error) throw error;
      fetchComments();
      onCommentAdded?.();
      toast.success("Marqué comme corrigé");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erreur");
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Supprimer ce commentaire ?")) return;
    try {
      const { error } = await supabase.from("review_comments").delete().eq("id", commentId);
      if (error) throw error;
      fetchComments();
      onCommentAdded?.();
      toast.success("Supprimé");
    } catch (error) {
      toast.error("Erreur");
    }
  };

  const startEditing = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
    setEditCorrection(comment.proposed_correction || "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent("");
    setEditCorrection("");
  };

  const handleEditSave = async () => {
    if (!editingId || !editContent.trim()) return;
    setSubmittingEdit(true);
    try {
      const updateData: Record<string, unknown> = {
        content: editContent.trim(),
        proposed_correction: editCorrection.trim() || null,
      };
      const { error } = await supabase
        .from("review_comments")
        .update(updateData)
        .eq("id", editingId);
      if (error) throw error;
      cancelEditing();
      fetchComments();
      toast.success("Commentaire modifié");
    } catch (error) {
      console.error("Error editing comment:", error);
      toast.error("Erreur lors de la modification");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
      const transcript = voiceTranscriptRef.current.trim();
      if (transcript) {
        analyzeVoiceTranscript(transcript);
      } else {
        toast.info("Aucun texte détecté");
      }
    } else {
      setVoiceTranscript("");
      voiceTranscriptRef.current = "";
      startListening((fullTranscript: string) => {
        voiceTranscriptRef.current = fullTranscript;
        setVoiceTranscript(fullTranscript);
      });
    }
  };

  const analyzeVoiceTranscript = async (transcript: string) => {
    setAnalyzingVoice(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-voice-review", {
        body: { transcript },
      });
      if (error) throw error;
      if (data?.problem) setNewComment(data.problem);
      if (data?.correction) { setProposedCorrection(data.correction); setShowCorrection(true); }
      if (data?.comment_type === "fond" || data?.comment_type === "forme") setCommentType(data.comment_type);
      toast.success("Retour vocal analysé");
    } catch {
      setNewComment(transcript);
      toast.error("Erreur d'analyse — transcription brute insérée");
    } finally {
      setAnalyzingVoice(false);
    }
  };

  const renderTextWithLinks = (text: string) => {
    // Split on mentions and URLs
    const parts = text.split(/((?:https?:\/\/)[^\s<]+|@\w+(?:\s\w+){0,2})/g);
    return parts.map((part, i) => {
      if (part.startsWith("@") && part.length > 1) {
        return (
          <span key={i} className="text-primary font-medium bg-primary/10 rounded px-0.5">{part}</span>
        );
      }
      if (/^https?:\/\//.test(part)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 break-all">
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const getDisplayName = (comment: Comment) =>
    comment.author_id === currentUserId ? "Moi" : comment.author_email || "Utilisateur";

  const getInitials = (comment: Comment) => {
    if (comment.author_id === currentUserId) return "😊";
    const name = comment.author_email || "";
    return name.split(/[\s.@]+/).filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const toggleResolvedExpanded = (id: string) => {
    setExpandedResolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getProfileName = (userId: string) => {
    const p = profiles.find((p) => p.user_id === userId);
    if (!p) return null;
    return p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.email;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderComment = (comment: Comment, isCollapsed: boolean) => {
    const replies = repliesMap[comment.id] || [];
    const isResolved = comment.status !== "pending";
    const canResolve = currentUserId && comment.status === "pending";
    const isExpanded = expandedResolved.has(comment.id);

    // Collapsed resolved comment — single line
    if (isCollapsed && !isExpanded) {
      return (
        <div
          key={comment.id}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/20 cursor-pointer hover:bg-muted/40 transition-colors opacity-50 hover:opacity-75"
          onClick={() => toggleResolvedExpanded(comment.id)}
        >
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <CheckCheck className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
          <span className="text-xs text-muted-foreground truncate flex-1">
            <span className="font-medium">{getDisplayName(comment)}</span>
            {" — "}
            {comment.content.length > 80 ? comment.content.slice(0, 80) + "…" : comment.content}
          </span>
          <Badge variant="secondary" className="text-[10px] h-4 bg-green-100 text-green-700 flex-shrink-0">
            Corrigé
          </Badge>
          {replies.length > 0 && (
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{replies.length} rép.</span>
          )}
        </div>
      );
    }

    return (
      <div
        key={comment.id}
        className={cn(
          "rounded-lg border transition-all",
          isResolved ? "bg-muted/10 border-border/30 opacity-60" : "bg-background border-primary/20 shadow-sm"
        )}
      >
        {/* Collapse button for expanded resolved */}
        {isCollapsed && isExpanded && (
          <button
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/30"
            onClick={() => toggleResolvedExpanded(comment.id)}
          >
            <ChevronDown className="h-3 w-3" />
            Réduire
          </button>
        )}

        {/* Main comment */}
        <div className="p-3">
          <div className="flex items-start gap-2.5">
            <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
              <AvatarFallback className="text-[10px] bg-primary/10">{getInitials(comment)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold">{getDisplayName(comment)}</span>
                <span className="text-[10px] text-muted-foreground">{formatDate(comment.created_at)}</span>
                {comment.comment_type && commentTypeConfig[comment.comment_type] && (() => {
                  const cfg = commentTypeConfig[comment.comment_type!];
                  const TypeIcon = cfg.icon;
                  return (
                    <Badge variant="secondary" className={cn("text-[10px] h-4 gap-0.5", cfg.className)}>
                      <TypeIcon className="h-2.5 w-2.5" />
                      {cfg.label}
                    </Badge>
                  );
                })()}
                {comment.assigned_to && (
                  <Badge variant="outline" className="text-[10px] h-4 gap-0.5">
                    <UserPlus className="h-2.5 w-2.5" />
                    {comment.assigned_name || getProfileName(comment.assigned_to) || "Assigné"}
                  </Badge>
                )}
                {isResolved && (
                  <Badge variant="secondary" className="text-[10px] h-4 bg-green-100 text-green-700">
                    <CheckCheck className="h-2.5 w-2.5 mr-0.5" />
                    {comment.status === "corrected" ? "Corrigé" : "Traité"}
                  </Badge>
                )}
              </div>
              {editingId === comment.id ? (
                <div className="mt-1 space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleEditSave();
                      if (e.key === "Escape") cancelEditing();
                    }}
                  />
                  {(editCorrection || comment.proposed_correction) && (
                    <Textarea
                      value={editCorrection}
                      onChange={(e) => setEditCorrection(e.target.value)}
                      placeholder="Correction proposée (optionnel)"
                      rows={2}
                      className="resize-none text-sm"
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-6 text-[11px]" onClick={handleEditSave} disabled={submittingEdit || !editContent.trim()}>
                      {submittingEdit ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Enregistrer
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={cancelEditing}>
                      Annuler
                    </Button>
                    <span className="text-[10px] text-muted-foreground">⌘+Entrée · Échap</span>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm mt-1 whitespace-pre-wrap leading-relaxed">{renderTextWithLinks(comment.content)}</p>

                  {comment.image_url && (
                    <a href={comment.image_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                      <img src={comment.image_url} alt="Capture" className="max-w-full max-h-40 rounded border hover:opacity-90" />
                    </a>
                  )}

                  {comment.proposed_correction && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded text-sm relative group/correction">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">Correction proposée</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover/correction:opacity-100 text-blue-600"
                          onClick={() => {
                            navigator.clipboard.writeText(comment.proposed_correction!);
                            toast.success("Copié");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-blue-900 mt-1 whitespace-pre-wrap">{comment.proposed_correction}</p>
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              {editingId !== comment.id && (
              <div className="flex items-center gap-1 mt-2">
                {canResolve && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] text-blue-600 hover:bg-blue-50"
                      onClick={() => handleResolve(comment.id, "corrected")}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Corrigé
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] text-muted-foreground"
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                >
                  <Reply className="h-3 w-3 mr-1" />
                  Répondre
                </Button>
                {comment.author_id === currentUserId && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] text-muted-foreground hover:text-primary"
                      onClick={() => startEditing(comment)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] text-muted-foreground hover:text-destructive ml-auto"
                      onClick={() => handleDelete(comment.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
              )}
            </div>
          </div>
        </div>

        {/* Replies */}
        {replies.length > 0 && (
          <div className="border-t bg-muted/10 px-3 py-2 space-y-2">
            {replies.map((reply) => (
              <div key={reply.id} className="flex items-start gap-2 pl-4">
                <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
                  <AvatarFallback className="text-[9px] bg-muted">{getInitials(reply)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium">{getDisplayName(reply)}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDate(reply.created_at)}</span>
                  </div>
                  {editingId === reply.id ? (
                    <div className="mt-1 space-y-1.5">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={2}
                        className="resize-none text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleEditSave();
                          if (e.key === "Escape") cancelEditing();
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" className="h-5 text-[10px]" onClick={handleEditSave} disabled={submittingEdit || !editContent.trim()}>
                          {submittingEdit ? <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" /> : null}
                          Enregistrer
                        </Button>
                        <Button size="sm" variant="ghost" className="h-5 text-[10px]" onClick={cancelEditing}>
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm mt-0.5 whitespace-pre-wrap">{renderTextWithLinks(reply.content)}</p>
                      {reply.author_id === currentUserId && (
                        <div className="flex items-center gap-1 mt-0.5 -ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 text-[10px] text-muted-foreground hover:text-primary"
                            onClick={() => startEditing(reply)}
                          >
                            <Pencil className="h-2.5 w-2.5 mr-0.5" />
                            Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 text-[10px] text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(reply.id)}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply input */}
        {replyingTo === comment.id && (
          <div className="border-t px-3 py-2">
            <div className="flex gap-2 pl-4">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Répondre…"
                rows={1}
                className="resize-none text-sm flex-1 min-h-[36px]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply(comment.id);
                  if (e.key === "Escape") { setReplyingTo(null); setReplyText(""); }
                }}
              />
              <Button
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={() => handleReply(comment.id)}
                disabled={submittingReply || !replyText.trim()}
              >
                {submittingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 pl-4">⌘+Entrée pour envoyer · Échap pour annuler</p>
          </div>
        )}
      </div>
    );
  };

  const pendingCount = pendingComments.length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      {comments.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>{topLevelComments.length} commentaire{topLevelComments.length > 1 ? "s" : ""}</span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 bg-amber-100 text-amber-800">
              {pendingCount} en attente
            </Badge>
          )}
          {resolvedComments.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 bg-green-100 text-green-700">
              {resolvedComments.length} traité{resolvedComments.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}

      {/* Pending comments (expanded) */}
      <div className="space-y-2">
        {pendingComments.map((comment) => renderComment(comment, false))}
      </div>

      {/* Resolved comments (collapsed by default) */}
      {resolvedComments.length > 0 && (
        <div className="space-y-1">
          {resolvedComments.map((comment) => renderComment(comment, true))}
        </div>
      )}

      {/* New comment input */}
      <div className="border rounded-lg p-3 space-y-2 bg-muted/10">
        <MentionTextarea
          value={newComment}
          onChange={setNewComment}
          onMentionsChange={setPendingMentions}
          onPaste={handlePaste}
          placeholder="Ajouter un commentaire… (@nom pour mentionner)"
          rows={2}
          className="text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
        />

        {/* Image preview */}
        {imagePreview && (
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="max-h-20 rounded border" />
            <Button type="button" size="icon" variant="destructive" className="absolute -top-2 -right-2 h-5 w-5" onClick={clearImage}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Correction field */}
        {showCorrection && (
          <Textarea
            value={proposedCorrection}
            onChange={(e) => setProposedCorrection(e.target.value)}
            placeholder="Correction proposée (optionnel)"
            rows={2}
            className="resize-none text-sm"
          />
        )}

        {/* Listening indicator */}
        {isListening && (
          <div className="flex items-center gap-2 text-sm text-destructive animate-pulse">
            <Mic className="h-4 w-4" />
            <span>Écoute en cours… {voiceTranscript && `"${voiceTranscript}"`}</span>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {/* Type badges */}
            <Button
              type="button"
              size="sm"
              variant={commentType === "fond" ? "default" : "ghost"}
              className={cn("h-7 text-[11px]", commentType === "fond" && "bg-purple-100 text-purple-800 hover:bg-purple-200")}
              onClick={() => setCommentType(commentType === "fond" ? "" : "fond")}
            >
              <FileText className="h-3 w-3 mr-1" />
              Fond
            </Button>
            <Button
              type="button"
              size="sm"
              variant={commentType === "forme" ? "default" : "ghost"}
              className={cn("h-7 text-[11px]", commentType === "forme" && "bg-cyan-100 text-cyan-800 hover:bg-cyan-200")}
              onClick={() => setCommentType(commentType === "forme" ? "" : "forme")}
            >
              <Palette className="h-3 w-3 mr-1" />
              Forme
            </Button>

            <div className="w-px h-4 bg-border mx-1" />

            {/* Assign to */}
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="h-7 w-auto min-w-[120px] text-[11px] border-dashed">
                <div className="flex items-center gap-1">
                  <UserPlus className="h-3 w-3" />
                  <SelectValue placeholder="Assigner à…" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">Personne</SelectItem>
                {profiles.filter((p) => p.user_id !== currentUserId).map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id} className="text-xs">
                    {p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="w-px h-4 bg-border mx-1" />

            <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => fileInputRef.current?.click()} title="Image">
              <Image className="h-3.5 w-3.5" />
            </Button>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn("h-7 w-7", showCorrection && "bg-blue-100 text-blue-700")}
              onClick={() => setShowCorrection(!showCorrection)}
              title="Proposer une correction"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            {speechSupported && (
              <Button
                type="button"
                size="icon"
                variant={isListening ? "destructive" : "ghost"}
                className="h-7 w-7"
                onClick={handleVoiceToggle}
                disabled={analyzingVoice}
                title={isListening ? "Arrêter" : "Retour vocal"}
              >
                {analyzingVoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>

          <Button size="sm" className="h-7" onClick={handleSubmit} disabled={submitting || !newComment.trim()}>
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CommentThread;
