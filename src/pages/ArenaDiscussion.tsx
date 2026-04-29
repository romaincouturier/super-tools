import { useArenaDiscussion } from "@/hooks/useArenaDiscussion";
import ModuleLayout from "@/components/ModuleLayout";
import ArenaHeader from "@/components/arena/ArenaHeader";
import ArenaMessageList from "@/components/arena/ArenaMessageList";
import ArenaEndPanel from "@/components/arena/ArenaEndPanel";
import ArenaInputBar from "@/components/arena/ArenaInputBar";
import ArenaKeyPointsSidebar from "@/components/arena/ArenaKeyPointsSidebar";
import ArenaScrollButton from "@/components/arena/ArenaScrollButton";

export default function ArenaDiscussion() {
  const arena = useArenaDiscussion();

  if (!arena.config || !Array.isArray(arena.config.agents)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  const currentAgent = arena.config.agents.find((a) => a.id === arena.currentSpeaker);

  return (
    <ModuleLayout className="flex h-screen flex-col">
      <ArenaHeader
        config={arena.config}
        turnNumber={arena.turnNumber}
        totalTokens={arena.totalTokens}
        estimatedCostUsd={arena.estimatedCostUsd}
        discussionState={arena.discussionState}
        isRunning={arena.isRunning}
        isPaused={arena.isPaused}
        currentSpeaker={arena.currentSpeaker}
        copied={arena.copied}
        onPause={arena.handlePause}
        onStop={arena.handleStop}
        onForceVote={arena.forceVote}
        onForceDeliverable={arena.forceDeliverable}
        onCopyAll={arena.handleCopyAll}
        onDownloadMd={arena.handleDownloadMd}
        onContinue={arena.handleContinue}
        onGoToResults={arena.goToResults}
        messages={arena.messages}
      />

      <div className="relative flex flex-1 overflow-hidden">
        <div ref={arena.scrollContainerRef} onScroll={arena.handleScroll} className="flex-1 overflow-y-auto py-4">
          <ArenaMessageList
            messages={arena.messages}
            currentSpeaker={arena.currentSpeaker}
            currentAgent={currentAgent}
            streamingContent={arena.streamingContent}
            turnNumber={arena.turnNumber}
            error={arena.error}
          />

          {!arena.isRunning && arena.messages.length > 0 && (
            <ArenaEndPanel
              copied={arena.copied}
              rating={arena.rating}
              feedbackText={arena.feedbackText}
              feedbackSent={arena.feedbackSent}
              onCopyAll={arena.handleCopyAll}
              onDownloadMd={arena.handleDownloadMd}
              onContinue={arena.handleContinue}
              onGoToResults={arena.goToResults}
              onSetRating={arena.setRating}
              onSetFeedbackText={arena.setFeedbackText}
              onSubmitFeedback={arena.submitFeedback}
            />
          )}

          <div ref={arena.messagesEndRef} />
        </div>

        <ArenaScrollButton
          visible={arena.showScrollButton}
          onClick={arena.forceScrollToBottom}
        />

        <ArenaKeyPointsSidebar keyPoints={arena.keyPoints} />
      </div>

      {arena.isRunning && (
        <ArenaInputBar
          waitingForUser={arena.waitingForUser}
          userInput={arena.userInput}
          nextSpeakerSuggestion={arena.nextSpeakerSuggestion}
          agents={arena.config.agents}
          isListening={arena.isListening}
          micSupported={arena.micSupported}
          onSetUserInput={arena.setUserInput}
          onContinueStep={arena.handleContinueStep}
          onVoiceToInput={arena.voiceToInput}
          onRequestIntermediateSynthesis={arena.requestIntermediateSynthesis}
        />
      )}
    </ModuleLayout>
  );
}
