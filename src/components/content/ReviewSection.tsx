// ReviewSection
import CommentThread from "./CommentThread";

interface ReviewSectionProps {
  cardId: string;
  cardTitle: string;
}

const ReviewSection = ({ cardId, cardTitle }: ReviewSectionProps) => {
  return (
    <CommentThread
      cardId={cardId}
      cardTitle={cardTitle}
    />
  );
};

export default ReviewSection;
