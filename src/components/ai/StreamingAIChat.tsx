import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAI, useDatabase } from '../../contexts/hooks';

// Enhanced streaming capabilities with real-time updates
interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isComplete: boolean;
  streamIndex: number;
  tokens?: number;
  model?: string;
  provider?: string;
  isError?: boolean;
  metadata?: {
    processingTime?: number;
    wordCount?: number;    sentiment?: 'positive' | 'neutral' | 'negative';
  };
}

// Real-time streaming state management
interface StreamingState {
  isActive: boolean;
  messageId: string;
  currentChunk: string;
  totalChunks: number;
  processingStartTime: number;
  estimatedTimeRemaining: number;
}

// Voice and accessibility features
interface AccessibilityState {
  isVoiceEnabled: boolean;
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  reduceMotion: boolean;
  screenReaderMode: boolean;
}

// Custom hooks for streaming
const useRealTimeStreaming = () => {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isActive: false,
    messageId: '',
    currentChunk: '',
    totalChunks: 0,
    processingStartTime: 0,
    estimatedTimeRemaining: 0
  });

  const startStreaming = useCallback((messageId: string) => {
    setStreamingState({
      isActive: true,
      messageId,
      currentChunk: '',
      totalChunks: 0,
      processingStartTime: Date.now(),
      estimatedTimeRemaining: 0
    });
  }, []);

  const updateStream = useCallback((chunk: string, isComplete: boolean = false) => {
    setStreamingState(prev => ({
      ...prev,
      currentChunk: prev.currentChunk + chunk,
      totalChunks: prev.totalChunks + 1,
      estimatedTimeRemaining: isComplete ? 0 : Math.max(0, (Date.now() - prev.processingStartTime) * 0.1)
    }));

    if (isComplete) {
      setStreamingState(prev => ({
        ...prev,
        isActive: false
      }));
    }
  }, []);

  const stopStreaming = useCallback(() => {
    setStreamingState(prev => ({
      ...prev,
      isActive: false
    }));
  }, []);

  return {
    streamingState,
    startStreaming,
    updateStream,
    stopStreaming
  };
};

// Accessibility features hook
const useAccessibility = () => {
  const [accessibilityState, setAccessibilityState] = useState<AccessibilityState>({
    isVoiceEnabled: false,
    fontSize: 'medium',
    highContrast: false,
    reduceMotion: false,
    screenReaderMode: false
  });

  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window && accessibilityState.isVoiceEnabled) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
    }
  }, [accessibilityState.isVoiceEnabled]);

  const updateAccessibility = useCallback((updates: Partial<AccessibilityState>) => {
    setAccessibilityState(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    accessibilityState,
    updateAccessibility,
    speakText
  };
};

export function StreamingAIChat() {
  // State management
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [input, setInput] = useState('');
  const [currentConversationId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Custom hooks
  const { streamingState, startStreaming, updateStream, stopStreaming } = useRealTimeStreaming();
  const { accessibilityState, updateAccessibility, speakText } = useAccessibility();

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Contexts
  const { state: aiState, actions: aiActions } = useAI();
  const { actions: dbActions } = useDatabase();

  // Auto-scroll with smooth behavior
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current && !accessibilityState.reduceMotion) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [accessibilityState.reduceMotion]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingState.currentChunk, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // Message management
  const addMessage = useCallback((message: Omit<StreamingMessage, 'id' | 'timestamp' | 'isComplete' | 'streamIndex'>) => {
    const newMessage: StreamingMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      isComplete: true,
      streamIndex: 0
    };
    
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<StreamingMessage>) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === id ? { ...msg, ...updates } : msg
      )
    );
  }, []);

  // Real-time streaming simulation
  const simulateRealTimeStreaming = useCallback(async (messageId: string, fullText: string) => {
    startStreaming(messageId);
    
    // Split text into realistic chunks
    const sentences = fullText.split(/(?<=[.!?])\s+/);
    let accumulatedText = '';

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i] || '';
      accumulatedText += (i > 0 ? ' ' : '') + sentence;
      
      updateStream(sentence + (i < sentences.length - 1 ? ' ' : ''), false);
      updateMessage(messageId, {
        content: accumulatedText,
        streamIndex: i + 1
      });

      // Variable delay based on sentence length
      const delay = Math.min(Math.max(sentence.length * 15, 200), 800);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    updateStream('', true);
    updateMessage(messageId, { 
      content: fullText,
      isComplete: true
    });

    // Speak the completed message if voice is enabled
    if (accessibilityState.isVoiceEnabled) {
      speakText(fullText);
    }
  }, [startStreaming, updateStream, updateMessage, accessibilityState.isVoiceEnabled, speakText]);

  // Send message with streaming
  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;    addMessage({
      role: 'user',
      content: input.trim()
    });

    const inputText = input.trim();
    setInput('');

    // Add streaming assistant message
    const assistantMessageId = addMessage({
      role: 'assistant',
      content: ''
    });

    // Update it to be incomplete for streaming
    updateMessage(assistantMessageId, { isComplete: false });

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const startTime = Date.now();
      const response = await aiActions.generateContent({
        prompt: inputText,
        type: 'conversation'
      });

      if (response.success && response.data) {
        const processingTime = Date.now() - startTime;
        
        await simulateRealTimeStreaming(assistantMessageId, response.data.content);
        
        // Update with metadata
        updateMessage(assistantMessageId, {
          tokens: response.data.usage?.totalTokens,
          model: response.data.model,
          provider: response.data.provider,
          metadata: {
            processingTime,
            wordCount: response.data.content.split(' ').length,
            sentiment: 'neutral' // Could be analyzed
          }
        });

        // Save to database
        try {
          await dbActions.addContent(
            currentConversationId || 'default-conversation',
            'chat_message',
            `User: ${inputText}\n\nAssistant: ${response.data.content}`,
            assistantMessageId
          );
        } catch (error) {
          console.error('Failed to save conversation:', error);
        }
      } else {
        stopStreaming();
        updateMessage(assistantMessageId, {
          content: response.error || 'Failed to generate response',
          isError: true,
          isComplete: true
        });
      }
    } catch (error) {
      stopStreaming();
      updateMessage(assistantMessageId, {
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true,
        isComplete: true
      });
    }
  }, [input, addMessage, updateMessage, aiActions, simulateRealTimeStreaming, stopStreaming, dbActions, currentConversationId]);

  // Cancel current generation
  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    stopStreaming();
  }, [stopStreaming]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendMessage();
    }
    
    if (event.key === 'Escape' && streamingState.isActive) {
      cancelGeneration();
    }
  }, [sendMessage, cancelGeneration, streamingState.isActive]);

  // Copy message content
  const copyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  }, []);

  // CSS classes for accessibility
  const getFontSizeClass = () => {
    switch (accessibilityState.fontSize) {
      case 'small': return 'text-sm';
      case 'large': return 'text-lg';
      default: return 'text-base';
    }
  };

  const getContrastClass = () => {
    return accessibilityState.highContrast ? 'contrast-150' : '';
  };

  const getMotionClass = () => {
    return accessibilityState.reduceMotion ? 'motion-reduce' : '';
  };

  return (
    <div 
      className={`flex flex-col bg-white border border-gray-200 rounded-lg shadow-lg transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'h-[700px]'
      } ${getContrastClass()} ${getMotionClass()}`}
      role="application"
      aria-label="AI Chat Assistant"
    >
      {/* Enhanced Header with accessibility controls */}
      <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            {streamingState.isActive && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
            )}
          </div>
          
          <div>
            <h1 className={`font-semibold text-gray-900 ${getFontSizeClass()}`}>
              AI Writing Assistant
            </h1>
            <p className="text-sm text-gray-600">
              {streamingState.isActive ? 'Generating response...' : 'Ready to help with your writing'}
            </p>
          </div>
        </div>

        {/* Accessibility Controls */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-white rounded-lg p-1">
            <button
              onClick={() => updateAccessibility({ fontSize: 'small' })}
              className={`px-2 py-1 text-xs rounded ${accessibilityState.fontSize === 'small' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600'}`}
              aria-label="Small font size"
            >
              A
            </button>
            <button
              onClick={() => updateAccessibility({ fontSize: 'medium' })}
              className={`px-2 py-1 text-sm rounded ${accessibilityState.fontSize === 'medium' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600'}`}
              aria-label="Medium font size"
            >
              A
            </button>
            <button
              onClick={() => updateAccessibility({ fontSize: 'large' })}
              className={`px-2 py-1 text-base rounded ${accessibilityState.fontSize === 'large' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600'}`}
              aria-label="Large font size"
            >
              A
            </button>
          </div>

          <button
            onClick={() => updateAccessibility({ highContrast: !accessibilityState.highContrast })}
            className={`p-2 rounded-lg transition-colors ${
              accessibilityState.highContrast ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="Toggle high contrast"
            title="High contrast mode"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>

          <button
            onClick={() => updateAccessibility({ isVoiceEnabled: !accessibilityState.isVoiceEnabled })}
            className={`p-2 rounded-lg transition-colors ${
              accessibilityState.isVoiceEnabled ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="Toggle voice output"
            title="Text-to-speech"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 15V9a1 1 0 011-1h2.5l4-4v16l-4-4H6a1 1 0 01-1-1z" />
            </svg>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9l6 6m0-6l-6 6" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Messages Area with Enhanced Streaming */}
      <main 
        ref={messagesContainerRef}
        className={`flex-1 overflow-y-auto p-4 space-y-6 ${getFontSizeClass()}`}
        role="log"
        aria-live="polite"
        aria-label="Chat conversation"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-xl font-medium mb-2">Welcome to your AI Writing Assistant</h2>
            <p className="text-center max-w-md leading-relaxed">
              Start a conversation to get help with character development, plot ideas, 
              world building, dialogue, and any other aspects of your creative writing.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              role="article"
              aria-label={`${message.role} message`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : message.isError
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {/* Message Header with Enhanced Info */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      message.role === 'user' ? 'bg-white bg-opacity-20' : 'bg-indigo-100'
                    }`}>
                      {message.role === 'user' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {message.role === 'user' ? 'You' : 'AI Assistant'}
                    </span>
                    {message.model && (
                      <span className="text-xs opacity-75 bg-black bg-opacity-10 px-2 py-1 rounded">
                        {message.model}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <time 
                      className="text-xs opacity-75"
                      dateTime={message.timestamp.toISOString()}
                    >
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                    
                    {message.role === 'assistant' && !message.isError && (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => copyMessage(message.content)}
                          className="p-1 opacity-50 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-white rounded"
                          aria-label="Copy message"
                          title="Copy message"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        
                        {accessibilityState.isVoiceEnabled && (
                          <button
                            onClick={() => speakText(message.content)}
                            className="p-1 opacity-50 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-white rounded"
                            aria-label="Read message aloud"
                            title="Read aloud"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 15V9a1 1 0 011-1h2.5l4-4v16l-4-4H6a1 1 0 01-1-1z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Message Content with Streaming Effect */}
                <div className="whitespace-pre-wrap leading-relaxed">
                  {!message.isComplete && streamingState.messageId === message.id ? (
                    <div className="flex items-start space-x-1">
                      <span>{streamingState.currentChunk}</span>
                      <span className="inline-block w-2 h-5 bg-current animate-pulse ml-1">|</span>
                    </div>
                  ) : (
                    message.content
                  )}
                </div>

                {/* Message Metadata */}
                {message.metadata && (
                  <div className="mt-3 pt-2 border-t border-black border-opacity-10">
                    <div className="flex items-center justify-between text-xs opacity-75">
                      <div className="flex space-x-3">
                        {message.metadata.wordCount && (
                          <span>{message.metadata.wordCount} words</span>
                        )}
                        {message.tokens && (
                          <span>{message.tokens} tokens</span>
                        )}
                        {message.metadata.processingTime && (
                          <span>{(message.metadata.processingTime / 1000).toFixed(1)}s</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Streaming Progress */}
                {!message.isComplete && streamingState.messageId === message.id && (
                  <div className="mt-2 flex items-center space-x-2 text-xs opacity-75">
                    <div className="flex-1 bg-black bg-opacity-10 rounded-full h-1">
                      <div 
                        className="bg-current h-1 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((streamingState.totalChunks / 10) * 100, 100)}%` }}
                      />
                    </div>
                    <span>Generating...</span>
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </main>

      {/* Enhanced Input Area */}
      <footer className="p-4 border-t border-gray-200 bg-gray-50">
        {/* Streaming Status */}
        {streamingState.isActive && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-blue-700">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">AI is generating your response...</span>
              </div>
              <button
                onClick={cancelGeneration}
                className="px-3 py-1 text-sm text-blue-700 hover:bg-blue-100 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
            {streamingState.estimatedTimeRemaining > 0 && (
              <div className="mt-2 text-xs text-blue-600">
                Estimated time remaining: {(streamingState.estimatedTimeRemaining / 1000).toFixed(1)}s
              </div>
            )}
          </div>
        )}

        <div className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Ctrl+Enter to send)"
              className={`w-full p-3 pr-12 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[50px] ${getFontSizeClass()}`}
              rows={1}
              disabled={streamingState.isActive}
              aria-label="Message input"
              maxLength={4000}
            />
            
            <div 
              className="absolute bottom-2 right-2 text-xs text-gray-400"
              aria-live="polite"
            >
              {input.length}/4000
            </div>
          </div>

          <button
            onClick={sendMessage}
            disabled={!input.trim() || streamingState.isActive}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Send message"
          >
            {streamingState.isActive ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>

        {/* Status Bar */}
        <div 
          className="flex items-center justify-between mt-3 text-xs text-gray-500"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center space-x-4">
            <span>
              {streamingState.isActive ? 'Generating...' : 'Ready'}
            </span>
            
            {aiState.serviceMetrics?.requestCount > 0 && (
              <span>
                {aiState.serviceMetrics.requestCount} requests this session
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <span>Ctrl+Enter to send • Esc to cancel</span>
          </div>
        </div>
      </footer>
    </div>
  );
}