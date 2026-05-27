import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { MessageSquare, Send, User, GraduationCap, Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface LmsMessage {
  id: string;
  course_id: string;
  learner_email: string;
  sender_role: "learner" | "admin";
  sender_email: string;
  content: string;
  is_read: boolean;
  created_at: string;
  lms_courses?: { title: string };
}

interface ConversationGroup {
  courseId: string;
  courseTitle: string;
  learnerEmail: string;
  messages: LmsMessage[];
  unreadCount: number;
  lastMessageAt: string;
}

export default function LmsMessages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ courseId: string; learnerEmail: string } | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["lms-messages-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lms_messages")
        .select("*, lms_courses(title)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as LmsMessage[]) || [];
    },
  });

  // Group by course + learner
  const groups: ConversationGroup[] = Object.values(
    messages.reduce<Record<string, ConversationGroup>>((acc, msg) => {
      const key = `${msg.course_id}::${msg.learner_email}`;
      if (!acc[key]) {
        acc[key] = {
          courseId: msg.course_id,
          courseTitle: msg.lms_courses?.title ?? msg.course_id,
          learnerEmail: msg.learner_email,
          messages: [],
          unreadCount: 0,
          lastMessageAt: msg.created_at,
        };
      }
      acc[key].messages.push(msg);
      if (!msg.is_read && msg.sender_role === "learner") acc[key].unreadCount++;
      if (msg.created_at > acc[key].lastMessageAt) acc[key].lastMessageAt = msg.created_at;
      return acc;
    }, {})
  ).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

  const filtered = search
    ? groups.filter(
        (g) =>
          g.learnerEmail.toLowerCase().includes(search.toLowerCase()) ||
          g.courseTitle.toLowerCase().includes(search.toLowerCase())
      )
    : groups;

  const activeGroup = selected
    ? groups.find((g) => g.courseId === selected.courseId && g.learnerEmail === selected.learnerEmail) ?? null
    : null;

  const handleSelectConversation = async (g: ConversationGroup) => {
    setSelected({ courseId: g.courseId, learnerEmail: g.learnerEmail });
    setReply("");
    // Mark learner messages as read
    const unreadIds = g.messages.filter((m) => !m.is_read && m.sender_role === "learner").map((m) => m.id);
    if (unreadIds.length > 0) {
      await (supabase as any).from("lms_messages").update({ is_read: true } as any).in("id", unreadIds);
      queryClient.invalidateQueries({ queryKey: ["lms-messages-admin"] });
    }
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !activeGroup) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase as any).from("lms_messages").insert({
        course_id: activeGroup.courseId,
        learner_email: activeGroup.learnerEmail,
        sender_role: "admin",
        sender_email: user?.email ?? "formateur",
        content: reply.trim(),
      });

      // Notify learner by email
      await supabase.functions.invoke("notify-learner-lms-message", {
        body: {
          learnerEmail: activeGroup.learnerEmail,
          courseTitle: activeGroup.courseTitle,
          portalUrl: `${window.location.origin}/espace-apprenant`,
        },
      });

      setReply("");
      queryClient.invalidateQueries({ queryKey: ["lms-messages-admin"] });
    } catch (err) {
      toastError(toast, err);
    } finally {
      setSending(false);
    }
  };

  const totalUnread = groups.reduce((sum, g) => sum + g.unreadCount, 0);

  return (
    <ModuleLayout>
      <PageHeader
        title="Messages e-learning"
        subtitle="Conversations des apprenants sur vos cours"
        icon={MessageSquare}
      />

      <div className="flex gap-4 h-[calc(100vh-180px)] min-h-0">
        {/* Sidebar — conversation list */}
        <Card className="w-72 shrink-0 flex flex-col overflow-hidden">
          <CardHeader className="py-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Conversations</CardTitle>
              {totalUnread > 0 && (
                <Badge variant="destructive">{totalUnread}</Badge>
              )}
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="pl-8 h-8 text-sm"
              />
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            {isLoading && (
              <p className="text-sm text-muted-foreground p-3 text-center">Chargement…</p>
            )}
            {!isLoading && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">Aucune conversation</p>
            )}
            {filtered.map((g) => {
              const isActive = selected?.courseId === g.courseId && selected?.learnerEmail === g.learnerEmail;
              return (
                <button
                  key={`${g.courseId}::${g.learnerEmail}`}
                  onClick={() => handleSelectConversation(g)}
                  className={`w-full text-left px-3 py-2.5 border-b hover:bg-muted/50 transition-colors ${isActive ? "bg-muted" : ""}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-medium truncate">{g.learnerEmail}</span>
                    {g.unreadCount > 0 && (
                      <Badge variant="destructive" className="text-xs shrink-0">{g.unreadCount}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{g.courseTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(g.lastMessageAt), "d MMM, HH:mm", { locale: fr })}
                  </p>
                </button>
              );
            })}
          </ScrollArea>
        </Card>

        {/* Main — conversation view */}
        {activeGroup ? (
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-3 border-b shrink-0">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">{activeGroup.learnerEmail}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">{activeGroup.courseTitle}</span>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {activeGroup.messages.map((msg) => {
                  const isAdmin = msg.sender_role === "admin";
                  return (
                    <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          isAdmin ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          {isAdmin ? <GraduationCap className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          <span className="text-xs opacity-70">
                            {format(new Date(msg.created_at), "d MMM HH:mm", { locale: fr })}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="p-3 border-t flex gap-2 shrink-0">
              <Input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Votre réponse…"
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendReply()}
              />
              <Button size="icon" onClick={handleSendReply} disabled={!reply.trim() || sending}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <MessageSquare className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm">Sélectionnez une conversation</p>
            </div>
          </Card>
        )}
      </div>
    </ModuleLayout>
  );
}
