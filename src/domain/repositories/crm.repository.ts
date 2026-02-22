import type {
  CrmColumn,
  CrmCard,
  CrmTag,
  CrmAttachment,
  CrmComment,
  CrmActivityLog,
  CrmCardEmail,
  CrmActivityType,
} from "../entities";

export interface ICrmRepository {
  fetchBoardData(): Promise<{
    columns: CrmColumn[];
    cards: CrmCard[];
    tags: CrmTag[];
  }>;

  fetchCardDetails(cardId: string): Promise<{
    attachments: CrmAttachment[];
    comments: CrmComment[];
    activity: CrmActivityLog[];
    emails: CrmCardEmail[];
  }>;

  logActivity(
    cardId: string,
    actionType: CrmActivityType,
    actorEmail: string,
    oldValue?: string | null,
    newValue?: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
}
