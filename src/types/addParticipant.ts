/** Réponse de l'edge function add-training-participant */
export interface AddParticipantResponse {
  participantId: string;
  alreadyExisted: boolean;
  status: string;
  ongoing: boolean;
  welcomeSent: boolean;
  welcomeFailed: boolean;
  welcomeScheduled: boolean;
  needsSurveyScheduled: boolean;
  trainerSummaryScheduled: boolean;
  attendanceCatchUp: { sentSlots: number; errors: number } | null;
  elearningAccessSent: boolean;
  elearningMode: "magic_link" | "woocommerce" | null;
  couponGenerated: boolean;
  conventionGenerated: boolean;
  conventionEmailSent: boolean;
}
