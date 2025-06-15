import { memo } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { AIHeader } from './components/AIHeader';
import { MessageList } from './components/MessageList';
import { AIInput } from './components/AIInput';
import { useAIAssistant } from './hooks/useAIAssistant';

export const EnhancedAIAssistantRefactored = memo(() => {
  const {
    // State
    messages,
    input,
    attachments,
    streamingState,
    isExpanded,
    selectedModel,
    voiceEnabled,
    autoScroll,
    isRecording,
    aiState,
    
    // Actions
    setInput,
    setIsExpanded,
    setAutoScroll,
    sendMessage,
    handleFileUpload,
    removeAttachment,
    startRecording,
    stopRecording,
    speakText,
    stopSpeaking,
    copyMessage,
    exportConversation,
    clearConversation,
    handleKeyDown
  } = useAIAssistant();

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm">
      <AIHeader
        providerName={aiState.settings.defaultProvider}
        selectedModel={selectedModel}
        isExpanded={isExpanded}
        autoScroll={autoScroll}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
        onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
        onExportConversation={exportConversation}
        onClearConversation={clearConversation}
      />

      {isExpanded && (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            <MessageList
              messages={messages}
              streamingState={streamingState}
              autoScroll={autoScroll}
              onCopyMessage={copyMessage}
              onSpeakText={speakText}
            />
            
            {/* Streaming indicator */}
            {streamingState.isStreaming && (
              <div className="flex items-center space-x-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">AI is thinking...</span>
              </div>
            )}
          </div>

          {/* Voice Feedback */}
          {voiceEnabled && (
            <div className="px-4 py-2 bg-blue-50 border-t border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-blue-600">
                  <Volume2 className="w-4 h-4" />
                  <span className="text-sm">Reading aloud...</span>
                </div>
                <button
                  onClick={stopSpeaking}
                  className="p-1 text-blue-600 hover:text-blue-800"
                >
                  <VolumeX className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <AIInput
            input={input}
            attachments={attachments}
            isRecording={isRecording}
            isStreaming={streamingState.isStreaming}
            onInputChange={setInput}
            onSendMessage={sendMessage}
            onFileUpload={handleFileUpload}
            onRemoveAttachment={removeAttachment}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onKeyDown={handleKeyDown}
          />

          {/* Status Bar */}
          <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500 border-t border-gray-200">
            <div className="flex items-center space-x-4">
              <span>
                {aiState.isGenerating ? 'Generating...' : 'Ready'}
              </span>
              
              {aiState.serviceMetrics.requestCount > 0 && (
                <span>
                  {aiState.serviceMetrics.requestCount} requests this session
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {isRecording && (
                <div className="flex items-center space-x-1 text-red-600">
                  <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                  <span>Recording</span>
                </div>
              )}
              
              <span>Ctrl+Enter to send</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

EnhancedAIAssistantRefactored.displayName = 'EnhancedAIAssistantRefactored';