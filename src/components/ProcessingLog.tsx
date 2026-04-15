import { useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Loader2, FileText, Mail, HardDrive, Circle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

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

interface ParticipantProgress {
  participant: string;
  pdf: "idle" | "pending" | "success" | "error";
  drive: "idle" | "pending" | "success" | "error";
  email: "idle" | "pending" | "success" | "error";
  done: boolean;
  error: string | null;
  lastUpdate: Date;
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

  // Group logs by participant
  const participantProgress = useMemo(() => {
    const progressMap = new Map<string, ParticipantProgress>();

    logs.forEach((log) => {
      if (!progressMap.has(log.participant)) {
        progressMap.set(log.participant, {
          participant: log.participant,
          pdf: "idle",
          drive: "idle",
          email: "idle",
          done: false,
          error: null,
          lastUpdate: log.timestamp,
        });
      }

      const progress = progressMap.get(log.participant)!;
      progress.lastUpdate = log.timestamp;

      if (log.step === "pdf") {
        progress.pdf = log.status;
      } else if (log.step === "drive") {
        progress.drive = log.status;
      } else if (log.step === "email") {
        progress.email = log.status;
      } else if (log.step === "done") {
        progress.done = true;
      } else if (log.step === "error") {
        progress.error = log.message;
      }
    });

    return Array.from(progressMap.values());
  }, [logs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [participantProgress]);

  const getStepIcon = (status: "idle" | "pending" | "success" | "error", IconComponent: typeof FileText) => {
    if (status === "idle") {
      return <Circle className="w-4 h-4 text-muted-foreground/40" />;
    }
    if (status === "pending") {
      return <Spinner className="text-primary" />;
    }
    if (status === "error") {
      return <XCircle className="w-4 h-4 text-destructive" />;
    }
    return <IconComponent className="w-4 h-4 text-green-600" />;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getRowStatus = (progress: ParticipantProgress) => {
    if (progress.error) return "error";
    if (progress.done) return "success";
    return "pending";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[80vh]">
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

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
          <div className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            <span>PDF</span>
          </div>
          <div className="flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            <span>Drive</span>
          </div>
          <div className="flex items-center gap-1">
            <Mail className="w-3 h-3" />
            <span>Email</span>
          </div>
        </div>

        <ScrollArea className="h-[400px] w-full rounded-md border p-4" ref={scrollRef}>
          <div className="space-y-2">
            {participantProgress.map((progress) => {
              const rowStatus = getRowStatus(progress);
              return (
                <div
                  key={progress.participant}
                  className={`flex items-center gap-3 p-3 rounded-md text-sm ${
                    rowStatus === "error"
                      ? "bg-destructive/10"
                      : rowStatus === "success"
                      ? "bg-green-50"
                      : "bg-muted"
                  }`}
                >
                  {/* Participant name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {progress.participant}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatTime(progress.lastUpdate)}
                      </span>
                    </div>
                    {progress.error && (
                      <p className="text-xs text-destructive mt-1 truncate">
                        {progress.error}
                      </p>
                    )}
                  </div>

                  {/* Step icons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1" title="Génération PDF">
                      {getStepIcon(progress.pdf, FileText)}
                    </div>
                    <div className="flex items-center gap-1" title="Upload Drive">
                      {getStepIcon(progress.drive, HardDrive)}
                    </div>
                    <div className="flex items-center gap-1" title="Envoi email">
                      {getStepIcon(progress.email, Mail)}
                    </div>
                    {/* Final status */}
                    <div className="ml-2">
                      {progress.done ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : progress.error ? (
                        <XCircle className="w-5 h-5 text-destructive" />
                      ) : (
                        <div className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ProcessingLog;
export type { LogEntry };
