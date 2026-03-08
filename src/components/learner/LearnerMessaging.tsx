import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  content: string;
  is_read: boolean;
  created_at: string;
}

interface Props {
  trainingId: string;
  participantId: string;
  learnerEmail: string;
  /** If true, the current user is the instructor side */
  isInstructor?: boolean;
}

export default function LearnerMessaging({ trainingId, participantId, learnerEmail, isInstructor = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load messages
  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("learner_messages")
        .select("*")
        .eq("training_id", trainingId)
        .eq("participant_id", participantId)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) || []);
      setLoading(false);
    };
    load();

    // Realtime subscription
    const channel = supabase
      .channel(`messages-${participantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "learner_messages",
          filter: `participant_id=eq.${participantId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trainingId, participantId]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Mark messages as read
  useEffect(() => {
    const unread = messages.filter(
      (m) => !m.is_read && m.sender_role !== (isInstructor ? "instructor" : "learner")
    );
    if (unread.length > 0) {
      (supabase as any)
        .from("learner_messages")
        .update({ is_read: true })
        .in("id", unread.map((m) => m.id))
        .then();
    }
  }, [messages, isInstructor]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const senderRole = isInstructor ? "instructor" : "learner";
    const senderEmail = isInstructor ? "formateur" : learnerEmail;

    await supabase.from("learner_messages").insert({
      training_id: trainingId,
      participant_id: participantId,
      sender_email: senderEmail,
      sender_role: senderRole,
      content: input.trim(),
    } as any);
    setInput("");
  };

  const unreadCount = messages.filter(
    (m) => !m.is_read && m.sender_role !== (isInstructor ? "instructor" : "learner")
  ).length;

  return (
    <Card className="flex flex-col h-[400px]">
      <CardHeader className="py-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Messages
          </CardTitle>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">{unreadCount} non lu{unreadCount > 1 ? "s" : ""}</Badge>
          )}
        </div>
      </CardHeader>
      <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
        <div className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground text-center py-4">Chargement...</p>}
          {!loading && messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun message. Envoyez le premier !
            </p>
          )}
          {messages.map((msg) => {
            const isMine =
              (isInstructor && msg.sender_role === "instructor") ||
              (!isInstructor && msg.sender_role === "learner");
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    isMine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    {msg.sender_role === "instructor" ? (
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
          placeholder="Votre message..."
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
