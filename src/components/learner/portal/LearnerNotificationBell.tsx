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
  if (type === "community_reply") return MessageSquare;
  return CalendarDays;
};

const LearnerNotificationBell = ({ email, open, onOpenChange }: LearnerNotificationBellProps) => {
  const navigate = useNavigate();
  const { data: notifications = [] } = useLearnerNotifications(email);
  const markRead = useMarkLearnerNotificationsRead(email);

  const unread = notifications.filter((n) => !n.is_read);
  const unreadCount = unread.length;

  const handleItemClick = (n: LearnerNotification) => {
    if (!n.is_read) markRead.mutate([n.id]);
    if (n.link) {
      onOpenChange(false);
      navigate(n.link);
    }
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
          <Bell size={18} style={{ color: "var(--st-ink)" }} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ background: "var(--st-yellow)", color: "#101820" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-bold" style={{ color: "var(--st-ink)" }}>Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="text-xs hover:underline"
              style={{ color: "var(--st-ink-muted)" }}
            >
              Tout marquer comme lu
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm" style={{ color: "var(--st-ink-muted)" }}>
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
                      style={{ background: n.is_read ? "transparent" : "rgba(255, 209, 0, 0.08)" }}
                    >
                      <Icon size={16} className="mt-0.5 shrink-0" style={{ color: "var(--st-ink-muted)" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold" style={{ color: "var(--st-ink)" }}>{n.title}</p>
                        {n.body && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--st-ink-muted)" }}>{n.body}</p>
                        )}
                        <p className="text-[10px] mt-1" style={{ color: "var(--st-ink-muted)" }}>
                          {formatDistanceToNow(new Date(n.created_at), { locale: fr, addSuffix: true })}
                        </p>
                      </div>
                      {!n.is_read && (
                        <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: "var(--st-yellow)" }} />
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
