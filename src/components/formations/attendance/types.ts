export interface AttendanceSignatureBlockProps {
  trainingId: string;
  trainingName: string;
  trainerName: string;
  schedules: Array<{
    id: string;
    day_date: string;
    start_time: string;
    end_time: string;
  }>;
  participantsCount: number;
  participants: Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  }>;
  location: string;
  startDate: string | null;
  endDate: string | null;
  onUpdate?: () => void;
}

export interface SignatureStatus {
  date: string;
  period: "AM" | "PM";
  totalSent: number;
  totalSigned: number;
  hasSent: boolean;
  trainerSigned: boolean;
}

export interface TrainerSignature {
  schedule_date: string;
  period: string;
  signature_data: string | null;
  signed_at: string | null;
  trainer_name: string | null;
}
