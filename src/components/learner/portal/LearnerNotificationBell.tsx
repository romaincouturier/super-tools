import { Bell, CalendarDays, PlayCircle, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  useLearnerNotifications,
  useMarkLearnerNotificationsRead,
  type LearnerNotification,
} from "@/hooks/useLearnerNotifications";

interface LearnerNotificationBellProps {
  email: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeIcon = (type: LearnerNotification["type"]) => {
  if (type === "replay_available") return PlayCircle;
  if (type === "community_reply" || type === "community_pinned") return MessageSquare;
  return CalendarDays;
};

const LearnerNotificationBell = ({ email, open, onOpenChange }: LearnerNotificationBellProps) => {
  const navigate = useNavigate();
  const { data: notifications = [] } = useLearnerNotifications(email);
  const markRead = useMarkLearnerNotificationsRead(email);

  const unread = notifications.filter((n) => !n.is_read);
  const unreadCount = unread.length;

  // Destination par défaut selon le type, quand la notification n'a pas de lien
  // explicite (ex. anciennes notifs ou notifs créées par trigger SQL sans link).
  const fallbackTarget = (type: LearnerNotification["type"]): string => {
    switch (type) {
      case "community_reply":
      case "community_pinned":
        return "/espace-apprenant/pratique";
      case "replay_available":
      case "live_upcoming":
        return "/espace-apprenant/tableau-de-bord";
      default:
        return "/espace-apprenant/tableau-de-bord";
    }
  };

  const handleItemClick = (n: LearnerNotification) => {
    if (!n.is_read) markRead.mutate([n.id]);
    const target = n.link || fallbackTarget(n.type);
    onOpenChange(false);
    navigate(target);
  };

  const handleMarkAll = () => {
    if (unreadCount > 0) markRead.mutate(unread.map((n) => n.id));
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex w-9 h-9 items-center justify-center rounded-full transition-colors hover:bg-black/5 shrink-0"
        >
          <Bell size={18} style={{ color: "hsl(var(--ink))" }} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-micro font-bold flex items-center justify-center"
              style={{ background: "hsl(var(--yellow-brand))", color: "hsl(var(--ink))" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-bold" style={{ color: "hsl(var(--ink))" }}>Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="text-xs hover:underline"
              style={{ color: "hsl(var(--ink) / 0.55)" }}
            >
              Tout marquer comme lu
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm" style={{ color: "hsl(var(--ink) / 0.55)" }}>
              Aucune notification
            </div>
          ) : (
            <ul>
              {notifications.map((n) => {
                const Icon = typeIcon(n.type);
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleItemClick(n)}
                      className="w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-black/5"
                      style={{ background: n.is_read ? "transparent" : "hsl(var(--yellow-brand) / 0.08)" }}
                    >
                      <Icon size={16} className="mt-0.5 shrink-0" style={{ color: "hsl(var(--ink) / 0.55)" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold" style={{ color: "hsl(var(--ink))" }}>{n.title}</p>
                        {n.body && (
                          <p className="text-xs mt-0.5" style={{ color: "hsl(var(--ink) / 0.55)" }}>{n.body}</p>
                        )}
                        <p className="text-micro mt-1" style={{ color: "hsl(var(--ink) / 0.55)" }}>
                          {formatDistanceToNow(new Date(n.created_at), { locale: fr, addSuffix: true })}
                        </p>
                      </div>
                      {!n.is_read && (
                        <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: "hsl(var(--yellow-brand))" }} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LearnerNotificationBell;
