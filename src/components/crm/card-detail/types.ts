import type {
  CrmCard,
  CrmTag,
  CrmColumn,
  SalesStatus,
  AcquisitionSource,
  BriefQuestion,
  EmailAttachment,
} from "@/types/crm";

/** Shared state bag passed to all card-detail sub-components */
export interface CardDetailState {
  card: CrmCard;
  allTags: CrmTag[];
  allColumns: CrmColumn[];
  tagUsageCounts: Record<string, number>;

  // Core fields
  title: string;
  setTitle: (v: string) => void;
  cardEmoji: string | null;
  setCardEmoji: (v: string | null) => void;
  descriptionHtml: string;
  salesStatus: SalesStatus;
  estimatedValue: string;
  setEstimatedValue: (v: string) => void;
  quoteUrl: string;
  setQuoteUrl: (v: string) => void;
  columnId: string;

  // Contact
  contactExpanded: boolean;
  setContactExpanded: (v: boolean) => void;
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  company: string;
  setCompany: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  linkedinUrl: string;
  setLinkedinUrl: (v: string) => void;
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  // Company identity (synced from SIREN lookup on quote creation)
  siren: string;
  setSiren: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  postalCode: string;
  setPostalCode: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
  serviceType: "formation" | "mission" | null;
  setServiceType: (v: "formation" | "mission" | null) => void;
  assignedTo: string | null;
  setAssignedTo: (v: string | null) => void;

  // Confidence & acquisition
  confidenceScore: number | null;
  setConfidenceScore: (v: number | null) => void;
  acquisitionSource: AcquisitionSource | null;
  setAcquisitionSource: (v: AcquisitionSource | null) => void;

  // Schedule
  scheduledDate: string;
  setScheduledDate: (v: string) => void;
  scheduledText: string;
  setScheduledText: (v: string) => void;
  showSchedulePopover: boolean;
  setShowSchedulePopover: (v: boolean) => void;

  // Next action
  nextActionText: string;
  setNextActionText: (v: string) => void;
  nextActionDone: boolean;
  setNextActionDone: (v: boolean) => void;
  nextActionType: "email" | "phone" | "rdv_physique" | "rdv_visio" | "other";
  setNextActionType: (v: "email" | "phone" | "rdv_physique" | "rdv_visio" | "other") => void;
  nextActionSuggesting: boolean;

  // Brief
  localBriefQuestions: BriefQuestion[];
  setLocalBriefQuestions: (v: BriefQuestion[]) => void;
  briefExpanded: boolean;
  setBriefExpanded: (v: boolean) => void;

  // Linked mission
  linkedMissionId: string | null;
  setLinkedMissionId: (v: string | null) => void;
  missionSearchQuery: string;
  setMissionSearchQuery: (v: string) => void;
  showMissionSearch: boolean;
  setShowMissionSearch: (v: boolean) => void;

  // Email composer
  emailTo: string;
  setEmailTo: (v: string) => void;
  emailCc: string;
  setEmailCc: (v: string) => void;
  emailBcc: string;
  setEmailBcc: (v: string) => void;
  showCcBcc: boolean;
  setShowCcBcc: (v: boolean) => void;
  emailSubject: string;
  setEmailSubject: (v: string) => void;
  emailBody: string;
  setEmailBody: (v: string) => void;
  emailAttachments: EmailAttachment[];
  setEmailAttachments: React.Dispatch<React.SetStateAction<EmailAttachment[]>>;
  emailSubjectBeforeAi: string | null;
  emailBodyBeforeAi: string | null;
  improvingSubject: boolean;
  improvingBody: boolean;
  sendEmailPending: boolean;

  // UI
  isFullScreen: boolean;
  setIsFullScreen: (v: boolean) => void;
  fieldSaving: boolean;
  fieldSaved: boolean;
  descriptionSaving: boolean;
  descriptionSaved: boolean;

  // AI
  aiAnalyzing: boolean;
  aiAnalysis: string | null;
  setAiAnalysis: (v: string | null) => void;
  quoteGenerating: boolean;
  quoteDescription: string | null;
  setQuoteDescription: (v: string | null) => void;

  // Pricing
  showPricingDialog: boolean;
  setShowPricingDialog: (v: boolean) => void;

  // Comment
  newComment: string;
  setNewComment: (v: string) => void;
}

/** Handler bag passed to sub-components */
export interface CardDetailHandlers {
  handleDescriptionChange: (value: string) => void;
  handleSalesStatusChange: (status: SalesStatus) => Promise<void>;
  handleColumnChange: (columnId: string, columnName: string) => Promise<void>;
  handleScheduleAction: () => Promise<void>;
  handleClearSchedule: () => Promise<void>;
  handleSuggestNextAction: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleToggleTag: (tagId: string) => Promise<void>;
  handleAddComment: () => Promise<void>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleEmailAttachFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveAttachment: (index: number) => void;
  handleSendEmail: () => Promise<void>;
  handleAiAnalysis: () => Promise<void>;
  handleGenerateQuoteDescription: () => Promise<void>;
  handleImproveEmailSubject: () => Promise<void>;
  handleImproveEmailBody: () => Promise<void>;
  handleUndoSubjectAi: () => void;
  handleUndoBodyAi: () => void;
  copyToClipboard: (text: string) => Promise<void>;
  promptCreateTraining: () => void;
}

export interface CardDetails {
  comments: Array<{
    id: string;
    author_email: string;
    content: string;
    created_at: string;
    is_deleted: boolean;
  }>;
  attachments: Array<{
    id: string;
    file_name: string;
    file_path: string;
    file_size: number | null;
    mime_type: string | null;
  }>;
  activity: Array<{
    id: string;
    action_type: string;
    actor_email: string;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
  }>;
  emails: Array<{
    id: string;
    subject: string;
    body_html: string;
    sent_at: string;
    recipient_email: string;
    sender_email: string;
    attachment_names: string[];
    attachment_paths?: string[] | null;
    delivery_status?: string;
    opened_at?: string | null;
    open_count?: number;
    clicked_at?: string | null;
    click_count?: number;
  }>;
}
