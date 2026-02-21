import { useState } from "react";
import { ChevronDown, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import DOMPurify from "dompurify";

interface ActivityLog {
  id: string;
  action_type: string;
  old_value: string | null;
  new_value: string | null;
  actor_email: string;
  created_at: string;
}

interface SentEmail {
  id: string;
  subject: string;
  recipient_email: string;
  body_html: string | null;
  sent_at: string;
}

interface CardActivityTabProps {
  activity: ActivityLog[];
  emails: SentEmail[];
  isLoading: boolean;
}

function formatActivityType(type: string): string {
  const labels: Record<string, string> = {
    card_created: "Carte créée",
    card_moved: "Carte déplacée",
    status_operational_changed: "Statut opérationnel modifié",
    sales_status_changed: "Statut commercial modifié",
    estimated_value_changed: "Valeur modifiée",
    tag_added: "Tag ajouté",
    tag_removed: "Tag retiré",
    comment_added: "Commentaire ajouté",
    attachment_added: "Pièce jointe ajoutée",
    attachment_removed: "Pièce jointe supprimée",
    email_sent: "Email envoyé",
    action_scheduled: "Action programmée",
  };
  return labels[type] || type;
}

const CardActivityTab = ({ activity, emails, isLoading }: CardActivityTabProps) => {
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

  return (
    <div className="space-y-2 mt-4">
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {activity.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune activité</p>
      )}
      {activity.map((log) => (
        <div key={log.id} className="p-2 border-l-2 border-muted pl-4">
          <p className="text-sm">
            <span className="font-medium">{formatActivityType(log.action_type)}</span>
            {log.old_value && log.new_value && (
              <span className="text-muted-foreground">
                {" "}
                : {log.old_value} → {log.new_value}
              </span>
            )}
            {!log.old_value && log.new_value && (
              <span className="text-muted-foreground"> : {log.new_value}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {log.actor_email} •{" "}
            {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
          </p>
        </div>
      ))}

      {emails && emails.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Emails envoyés ({emails.length})
          </h4>
          {emails.map((email) => {
            const isExpanded = expandedEmailId === email.id;
            return (
              <div
                key={email.id}
                className="border rounded-lg mb-2 overflow-hidden"
              >
                <div
                  className="flex items-start justify-between gap-2 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedEmailId(isExpanded ? null : email.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{email.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      À: {email.recipient_email} •{" "}
                      {format(new Date(email.sent_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform mt-0.5", isExpanded && "rotate-180")} />
                </div>
                {isExpanded && email.body_html && (
                  <div
                    className="px-4 pb-4 pt-2 border-t bg-background prose prose-sm dark:prose-invert max-w-none [&_a]:text-primary [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.body_html, { ADD_ATTR: ["target"], ALLOW_DATA_ATTR: false }) }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === "A") {
                        e.stopPropagation();
                        const href = target.getAttribute("href");
                        if (href) window.open(href, "_blank", "noopener");
                        e.preventDefault();
                      }
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CardActivityTab;
