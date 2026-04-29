import { PenLine, Send, RefreshCw, Check, Download, FileDown, ChevronDown, UserPen } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateSlot, getPeriodLabel } from "@/lib/dateFormatters";
import type { SignatureStatus } from "./types";

interface AttendanceSlotListProps {
  signatureStatuses: SignatureStatus[];
  participantsCount: number;
  participants: Array<{ id: string; first_name: string | null; last_name: string | null; email: string }>;
  sendingSlot: string | null;
  exporting: boolean;
  totalExpected: number;
  totalSigned: number;
  totalTrainerSigned: number;
  hasUnsignedTrainerSlots: boolean;
  onSend: (date: string, period: "AM" | "PM") => void;
  onOpenTrainerSign: (date: string, period: "AM" | "PM") => void;
  onSignAllTrainer: () => void;
  onExportPdf: (participantId?: string) => void;
}

const getParticipantName = (p: { first_name: string | null; last_name: string | null; email: string }) => {
  const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
  return name || p.email;
};

const AttendanceSlotList = ({
  signatureStatuses,
  participantsCount,
  participants,
  sendingSlot,
  exporting,
  totalExpected,
  totalSigned,
  totalTrainerSigned,
  hasUnsignedTrainerSlots,
  onSend,
  onOpenTrainerSign,
  onSignAllTrainer,
  onExportPdf,
}: AttendanceSlotListProps) => (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Émargement électronique
          </CardTitle>
          <CardDescription>
            Envoyez les demandes de signature pour chaque demi-journée
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsignedTrainerSlots && (
            <Button variant="outline" size="sm" onClick={onSignAllTrainer}>
              <UserPen className="h-4 w-4 mr-2" />
              Signer (formateur)
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                {exporting ? (
                  <Spinner className="mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Exporter PDF
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Exporter les émargements</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onExportPdf()}>
                <FileDown className="h-4 w-4 mr-2" />
                Toute la session ({totalSigned}/{totalExpected} signatures)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Par participant</DropdownMenuLabel>
              {participants.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => onExportPdf(p.id)}>
                  {getParticipantName(p)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {signatureStatuses.map((status) => {
          const slotKey = `${status.date}-${status.period}`;
          const isSending = sendingSlot === slotKey;
          const isComplete = status.totalSigned === participantsCount && participantsCount > 0;

          return (
            <div key={slotKey} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <span className="font-medium">{formatDateSlot(status.date)}</span>
                  <span className="text-muted-foreground ml-2">{getPeriodLabel(status.period)} ({status.startTime.replace(":", "h")} - {status.endTime.replace(":", "h")})</span>
                </div>
                <Badge variant={isComplete ? "default" : "secondary"} className="text-xs">
                  {status.totalSigned}/{participantsCount} signés
                </Badge>
                {status.trainerSigned ? (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                    <Check className="h-3 w-3 mr-1" />
                    Formateur
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-xs text-orange-500 border-orange-200 cursor-pointer hover:bg-orange-50"
                    onClick={() => onOpenTrainerSign(status.date, status.period)}
                  >
                    <UserPen className="h-3 w-3 mr-1" />
                    Signer
                  </Badge>
                )}
              </div>

              <Button
                size="sm"
                variant={status.hasSent ? "outline" : "default"}
                onClick={() => onSend(status.date, status.period)}
                disabled={isSending || isComplete}
              >
                {isSending ? (
                  <><Spinner className="mr-1" />Envoi...</>
                ) : isComplete ? (
                  <><Check className="h-4 w-4 mr-1" />Complet</>
                ) : status.hasSent ? (
                  <><RefreshCw className="h-4 w-4 mr-1" />Renvoyer</>
                ) : (
                  <><Send className="h-4 w-4 mr-1" />Envoyer</>
                )}
              </Button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        Formateur : {totalTrainerSigned}/{signatureStatuses.length} demi-journée(s) signée(s)
      </div>
    </CardContent>
  </Card>
);

export default AttendanceSlotList;
