import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare, User, GraduationCap } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Message {
  id: string;
  sender_email: string;
  sender_role: string;
  learner_email: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface Props {
  courseId: string;
  learnerEmail: string;
  isAdmin?: boolean;
}

export default function LearnerLmsMessaging({ courseId, learnerEmail, isAdmin = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("lms_messages")
        .select("*")
        .eq("course_id", courseId)
        .eq("learner_email", learnerEmail.toLowerCase())
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) || []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`lms-msg-${courseId}-${learnerEmail}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lms_messages",
          filter: `course_id=eq.${courseId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.learner_email.toLowerCase() === learnerEmail.toLowerCase()) {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [courseId, learnerEmail]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const unread = messages.filter(
      (m) => !m.is_read && m.sender_role !== (isAdmin ? "admin" : "learner")
    );
    if (unread.length > 0) {
      (supabase as any)
        .from("lms_messages")
        .update({ is_read: true } as any)
        .in("id", unread.map((m) => m.id))
        .then();
    }
  }, [messages, isAdmin]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const senderRole = isAdmin ? "admin" : "learner";

    await (supabase as any).from("lms_messages").insert({
      course_id: courseId,
      learner_email: learnerEmail.toLowerCase(),
      sender_role: senderRole,
      sender_email: isAdmin ? "formateur" : learnerEmail,
      content: input.trim(),
    });

    setInput("");
  };

  const unreadCount = messages.filter(
    (m) => !m.is_read && m.sender_role !== (isAdmin ? "admin" : "learner")
  ).length;

  return (
    <div className="flex flex-col h-[380px] border rounded-lg overflow-hidden">
      <div className="py-2.5 px-3 border-b flex items-center justify-between bg-card">
        <span className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Messages
        </span>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {unreadCount} non lu{unreadCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollRef as React.RefObject<HTMLDivElement>}>
        <div className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground text-center py-4">Chargement…</p>}
          {!loading && messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun message. Envoyez le premier !
            </p>
          )}
          {messages.map((msg) => {
            const isMine =
              (isAdmin && msg.sender_role === "admin") ||
              (!isAdmin && msg.sender_role === "learner");
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    isMine ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    {msg.sender_role === "admin" ? (
                      <GraduationCap className="w-3 h-3" />
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                    <span className="text-xs opacity-70">
                      {format(new Date(msg.created_at), "HH:mm", { locale: fr })}
                    </span>
                  </div>
                  <p>{msg.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Votre message…"
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
