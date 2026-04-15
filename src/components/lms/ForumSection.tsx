import { useState } from "react";
import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Badge } from "@/components/ui/badge";
import { useCourseForums, useForumPosts, useCreateForumPost } from "@/hooks/useLms";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { MessageSquare, Pin, Plus, Send } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  courseId: string;
}

export default function LmsForumSection({ courseId }: Props) {
  const { data: forums = [] } = useCourseForums(courseId);
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedForum, setSelectedForum] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const handleCreateForum = async () => {
    if (!newTitle.trim()) return;
    const { error } = await supabase
      .from("lms_forums")
      .insert({ course_id: courseId, title: newTitle });
    if (error) {
      toastError(toast, error instanceof Error ? error : "Erreur inconnue");
      return;
    }
    setNewTitle("");
    setCreating(false);
    toast({ title: "Forum créé" });
  };

  if (selectedForum) {
    return <ForumThread forumId={selectedForum} onBack={() => setSelectedForum(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Forums de discussion</h3>
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nouveau forum
        </Button>
      </div>

      {creating && (
        <Card>
          <CardContent className="flex items-center gap-2 py-3">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Titre du forum..."
              autoFocus
            />
            <Button size="sm" onClick={handleCreateForum}>Créer</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Annuler</Button>
          </CardContent>
        </Card>
      )}

      {forums.length === 0 && !creating ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>Aucun forum pour ce cours</p>
          </CardContent>
        </Card>
      ) : (
        forums.map((forum) => (
          <Card
            key={forum.id}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setSelectedForum(forum.id)}
          >
            <CardContent className="flex items-center gap-3 py-4">
              <MessageSquare className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium">{forum.title}</p>
                {forum.description && <p className="text-sm text-muted-foreground">{forum.description}</p>}
              </div>
              {forum.is_locked && <Badge variant="secondary">🔒 Verrouillé</Badge>}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function ForumThread({ forumId, onBack }: { forumId: string; onBack: () => void }) {
  const { data: posts = [] } = useForumPosts(forumId);
  const createPost = useCreateForumPost();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const { toast } = useToast();

  const handlePost = async () => {
    if (!content.trim() || !user?.email) return;
    await createPost.mutateAsync({
      forum_id: forumId,
      author_email: user.email,
      content_html: content,
    });
    setContent("");
    toast({ title: "Message posté" });
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>← Retour aux forums</Button>

      <div className="space-y-3">
        {posts.map((post) => (
          <Card key={post.id} className={post.is_pinned ? "border-l-4 border-l-primary" : ""}>
            <CardContent className="py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">{post.author_email}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(post.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                </span>
                {post.is_pinned && <Pin className="w-3 h-3 text-primary" />}
              </div>
              <div className="text-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content_html) }} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reply form */}
      <Card>
        <CardContent className="py-3 space-y-2">
          <VoiceTextarea
            value={content}
            onValueChange={setContent}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Écrire un message..."
            rows={3}
          />
          <Button onClick={handlePost} disabled={!content.trim() || createPost.isPending} size="sm">
            <Send className="w-4 h-4 mr-1" /> Poster
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
