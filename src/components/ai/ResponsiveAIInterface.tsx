import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAI, useDatabase } from '../../contexts/hooks';

// Simple icon components to replace lucide-react
const IconBot = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const IconSend = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const IconMic = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const IconUpload = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const IconCopy = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const IconSettings = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconLoader = () => (
  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const IconUser = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const IconError = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconExpand = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
  </svg>
);

const IconCollapse = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9l6 6m0-6l-6 6" />
  </svg>
);

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
  model?: string;
  provider?: string;
  isStreaming?: boolean;
  isError?: boolean;
}

interface StreamingState {
  isStreaming: boolean;
  currentMessage: string;
  messageId: string;
}

// Utility functions
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
};

export function ResponsiveAIInterface() {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    currentMessage: '',
    messageId: ''
  });
  const [isMobile, setIsMobile] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contexts
  const { state: aiState, actions: aiActions } = useAI();
  const { actions: dbActions } = useDatabase();

  // Responsive design detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingState.currentMessage, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Message handling
  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === id ? { ...msg, ...updates } : msg
      )
    );
  }, []);

  // Simulate streaming response
  const simulateStreaming = useCallback(async (messageId: string, fullText: string) => {
    setStreamingState({
      isStreaming: true,
      currentMessage: '',
      messageId
    });

    const words = fullText.split(' ');
    let currentText = '';

    for (let i = 0; i < words.length; i++) {
      currentText += (i > 0 ? ' ' : '') + words[i];
      
      setStreamingState(prev => ({
        ...prev,
        currentMessage: currentText
      }));

      // Simulate typing delay
      await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 70));
    }

    // Finalize message
    updateMessage(messageId, { 
      content: fullText, 
      isStreaming: false 
    });

    setStreamingState({
      isStreaming: false,
      currentMessage: '',
      messageId: ''
    });
  }, [updateMessage]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const userMessage = addMessage({
      role: 'user',
      content: input.trim()
    });

    const inputText = input.trim();
    setInput('');

    // Add loading assistant message
    const assistantMessageId = addMessage({
      role: 'assistant',
      content: '',
      isStreaming: true
    });

    try {
      const response = await aiActions.generateContent({
        prompt: inputText,
        type: 'conversation'
      });

      if (response.success && response.data) {
        await simulateStreaming(assistantMessageId, response.data.content);
        
        // Save to database
        try {
          await dbActions.addContent(
            'current-project',
            'conversation',
            `User: ${inputText}\n\nAssistant: ${response.data.content}`,
            userMessage
          );
        } catch (error) {
          console.error('Failed to save conversation to database:', error);
        }
      } else {
        updateMessage(assistantMessageId, {
          content: response.error || 'Failed to generate response',
          isError: true,
          isStreaming: false
        });
      }
    } catch (error) {
      updateMessage(assistantMessageId, {
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true,
        isStreaming: false
      });
    }
  }, [input, addMessage, updateMessage, aiActions, dbActions, simulateStreaming]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      if (event.ctrlKey || event.metaKey || (isMobile && !event.shiftKey)) {
        event.preventDefault();
        sendMessage();
      }
    }
  }, [sendMessage, isMobile]);

  // Copy message
  const handleCopyMessage = useCallback(async (content: string, messageId: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      setCopySuccess(messageId);
      setTimeout(() => setCopySuccess(null), 2000);
    }
  }, []);

  // Voice input (placeholder)
  const toggleRecording = useCallback(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setIsRecording(!isRecording);
      // Implement actual speech recognition here
    }
  }, [isRecording]);

  // File upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setInput(prev => prev + `\n\n[File: ${file.name}]\n${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}`);
      };
      reader.readAsText(file);
    });
  }, []);

  return (
    <div 
      className={`flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm transition-all duration-300 ${
        isMobile ? 'h-screen rounded-none' : isExpanded ? 'h-[600px]' : 'h-16'
      }`}
      role="region"
      aria-label="AI Assistant Chat Interface"
    >
      {/* Header */}
      <header 
        className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50"
        role="banner"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <IconBot />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-gray-900 truncate">AI Assistant</h1>
            <p className="text-sm text-gray-600 truncate">
              {aiState.isGenerating ? 'Generating...' : 'Ready to help'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {!isMobile && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
              aria-label={isExpanded ? 'Collapse chat' : 'Expand chat'}
            >
              {isExpanded ? <IconCollapse /> : <IconExpand />}
            </button>
          )}
          
          <button
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
            aria-label="AI settings"
          >
            <IconSettings />
          </button>
        </div>
      </header>

      {(isExpanded || isMobile) && (
        <>
          {/* Messages Area */}
          <main 
            className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 min-h-0"
            role="main"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                <div className="p-4 bg-gray-100 rounded-full mb-4">
                  <IconBot />
                </div>
                <h2 className="text-xl font-medium mb-2">Start a conversation</h2>
                <p className="text-center text-gray-600 max-w-md">
                  Ask me anything about your writing project. I can help with character development, 
                  plot ideas, world building, and more.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    role="article"
                    aria-label={`${message.role} message`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : message.isError
                          ? 'bg-red-50 border border-red-200 text-red-800'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {/* Message Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {message.role === 'user' ? (
                            <IconUser />
                          ) : message.isError ? (
                            <IconError />
                          ) : (
                            <IconBot />
                          )}
                          <span className="text-sm font-medium">
                            {message.role === 'user' ? 'You' : 'Assistant'}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <time 
                            className="text-xs opacity-75"
                            dateTime={message.timestamp.toISOString()}
                          >
                            {formatTimeAgo(message.timestamp)}
                          </time>
                          
                          {message.role === 'assistant' && !message.isError && (
                            <button
                              onClick={() => handleCopyMessage(message.content, message.id)}
                              className="p-1 opacity-50 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 rounded"
                              aria-label="Copy message"
                              title="Copy message"
                            >
                              {copySuccess === message.id ? (
                                <span className="text-green-600 text-xs">✓</span>
                              ) : (
                                <IconCopy />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Message Content */}
                      <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">
                        {message.isStreaming && streamingState.messageId === message.id ? (
                          <div className="flex items-center space-x-2">
                            <span>{streamingState.currentMessage}</span>
                            <span className="inline-block w-2 h-5 bg-current animate-pulse">|</span>
                          </div>
                        ) : (
                          message.content
                        )}
                      </div>

                      {/* Token Usage */}
                      {message.tokens && (
                        <div className="mt-2 text-xs opacity-75">
                          {message.tokens} tokens
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            
            {/* Streaming indicator */}
            {streamingState.isStreaming && (
              <div 
                className="flex items-center space-x-2 text-gray-500 justify-center"
                role="status"
                aria-live="polite"
              >
                <IconLoader />
                <span className="text-sm">AI is thinking...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </main>

          {/* Input Area */}
          <footer 
            className="p-3 md:p-4 border-t border-gray-200 bg-gray-50"
            role="contentinfo"
          >
            <div className="flex items-end space-x-2 md:space-x-3">
              {/* File Upload */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.json"
                onChange={handleFileUpload}
                className="hidden"
                aria-label="Upload files"
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 md:p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Upload file"
                title="Upload file"
              >
                <IconUpload />
              </button>

              {/* Voice Input */}
              <button
                onClick={toggleRecording}
                className={`p-2 md:p-3 rounded-lg transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isRecording
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
                aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                title={isRecording ? 'Stop recording' : 'Start voice input'}
              >
                <IconMic />
                {isRecording && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </button>

              {/* Text Input */}
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isMobile ? "Type a message..." : "Type your message... (Ctrl+Enter to send)"}
                  className="w-full p-3 pr-12 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[48px] text-sm md:text-base"
                  rows={1}
                  disabled={streamingState.isStreaming}
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

              {/* Send Button */}
              <button
                onClick={sendMessage}
                disabled={!input.trim() || streamingState.isStreaming}
                className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                aria-label="Send message"
                title="Send message"
              >
                {streamingState.isStreaming ? (
                  <IconLoader />
                ) : (
                  <IconSend />
                )}
              </button>
            </div>

            {/* Status Bar */}
            <div 
              className="flex items-center justify-between mt-2 text-xs text-gray-500"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center space-x-4">
                <span>
                  {streamingState.isStreaming ? 'Generating...' : 'Ready'}
                </span>
                
                {aiState.serviceMetrics?.requestCount > 0 && (
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
                
                {!isMobile && (
                  <span>Ctrl+Enter to send</span>
                )}
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}