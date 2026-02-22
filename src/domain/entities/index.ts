// Domain entities — barrel export
// Single source of truth for all business types

export type { Training, Schedule, Participant, ScheduledAction } from "./training";

export type { EmailTemplate, AddressMode } from "./email-template";

// Re-export existing well-structured types
export type {
  CrmColumn,
  CrmCard,
  CrmTag,
  CrmCardTag,
  CrmAttachment,
  CrmComment,
  CrmCardEmail,
  CrmActivityLog,
  CrmActivityType,
  CrmBoardData,
  StatusOperational,
  SalesStatus,
  ServiceType,
  AcquisitionSource,
  LossReason,
  BriefQuestion,
  OpportunityExtraction,
  CreateCardInput,
  UpdateCardInput,
  CrmRevenueTarget,
  CommercialCoachContext,
  CoachContextType,
  CreateColumnInput,
  CreateTagInput,
  SendEmailInput,
} from "@/types/crm";

export type {
  Mission,
  MissionContact,
  MissionStatus,
  CreateMissionInput,
  UpdateMissionInput,
} from "@/types/missions";

export type {
  OKRObjective,
  OKRKeyResult,
  OKRInitiative,
  OKRParticipant,
  OKRCheckIn,
  OKRScheduledEmail,
  OKRTimeTarget,
  OKRCadence,
  OKRStatus,
  OKRParticipantRole,
  CreateOKRObjectiveInput,
  UpdateOKRObjectiveInput,
  CreateOKRKeyResultInput,
  UpdateOKRKeyResultInput,
  CreateOKRInitiativeInput,
  UpdateOKRInitiativeInput,
  CreateOKRCheckInInput,
} from "@/types/okr";

export type { Event, EventMedia } from "@/types/events";

export type {
  FormationConfig,
  FormationDate,
  DevisFormData,
  DevisHistoryItem,
} from "@/types/micro-devis";
