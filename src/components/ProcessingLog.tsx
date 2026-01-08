import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Loader2, FileText, Mail, HardDrive } from "lucide-react";

interface LogEntry {
  id: string;
  participant: string;
  step: "pdf" | "drive" | "email" | "done" | "error";
  message: string;
  status: "pending" | "success" | "error";
  timestamp: Date;
}

interface ProcessingLogProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
  isProcessing: boolean;
  totalParticipants: number;
  completedCount: number;
}

const ProcessingLog = ({
  isOpen,
  onClose,
  logs,
  isProcessing,
  totalParticipants,
  completedCount,
}: ProcessingLogProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getStepIcon = (step: string, status: string) => {
    if (status === "pending") {
      return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    }
    if (status === "error") {
      return <XCircle className="w-4 h-4 text-destructive" />;
    }
    
    switch (step) {
      case "pdf":
        return <FileText className="w-4 h-4 text-green-600" />;
      case "drive":
        return <HardDrive className="w-4 h-4 text-green-600" />;
      case "email":
        return <Mail className="w-4 h-4 text-green-600" />;
      case "done":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            )}
            Génération des certificats
          </DialogTitle>
          <DialogDescription>
            {isProcessing
              ? `Traitement en cours... (${completedCount}/${totalParticipants})`
              : `Terminé - ${completedCount}/${totalParticipants} certificat(s) traité(s)`}
          </DialogDescription>
        </DialogHeader>

        <div className="w-full bg-secondary rounded-full h-2 mb-4">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{
              width: `${totalParticipants > 0 ? (completedCount / totalParticipants) * 100 : 0}%`,
            }}
          />
        </div>

        <ScrollArea className="h-[400px] w-full rounded-md border p-4" ref={scrollRef}>
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`flex items-start gap-3 p-2 rounded-md text-sm ${
                  log.status === "error"
                    ? "bg-destructive/10"
                    : log.status === "success"
                    ? "bg-green-50"
                    : "bg-muted"
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getStepIcon(log.step, log.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {log.participant}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>
                  <p
                    className={`text-sm ${
                      log.status === "error"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {log.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ProcessingLog;
export type { LogEntry };
