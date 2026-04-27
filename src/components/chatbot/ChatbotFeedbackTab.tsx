import { ScrollArea } from "@/components/ui/scroll-area";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";

export function ChatbotFeedbackTab() {
  return (
    <ScrollArea className="flex-1">
      <FeedbackForm />
    </ScrollArea>
  );
}
