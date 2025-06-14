import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Bot, Send, Mic, MicOff, Upload, Download, Copy,
  User, FileText, Image, Loader2,
  ChevronDown, ChevronUp, Trash2, Volume2,
  VolumeX
} from 'lucide-react';
import { useAI, useDatabase } from '../../contexts/hooks';
// Simple date formatting utility
const formatDistanceToNow = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
  model?: string;
  provider?: string;
  attachments?: FileAttachment[];
  isStreaming?: boolean;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
  preview?: string;
}

interface StreamingState {
  isStreaming: boolean;
  currentMessage: string;
  messageId: string;
}

export function EnhancedAIAssistant() {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    currentMessage: '',
    messageId: ''
  });
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedModel] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Contexts
  const { state: aiState, actions: aiActions } = useAI();
  const { actions: dbActions } = useDatabase();

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScroll]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingState.currentMessage, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Voice input setup
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        // TODO: Send audioBlob to speech-to-text service
        // For now, we'll simulate text input
        console.log('Audio blob created:', audioBlob.size, 'bytes');
        setInput(prev => prev + '[Voice input transcription would appear here]');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // Text-to-speech
  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      // Stop current speech
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      speechSynthesisRef.current = utterance;
      speechSynthesis.speak(utterance);
      setVoiceEnabled(true);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    speechSynthesis.cancel();
    setVoiceEnabled(false);
  }, []);

  // File handling
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const attachment: FileAttachment = {
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          content: e.target?.result as string
        };

        // Generate preview for images
        if (file.type.startsWith('image/')) {
          attachment.preview = e.target?.result as string;
        }

        setAttachments(prev => [...prev, attachment]);
      };
      
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  }, []);

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

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
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
    if (!input.trim() && attachments.length === 0) return;

    const userMessage = addMessage({
      role: 'user',
      content: input.trim(),
      attachments: [...attachments]
    });

    // Save to database
    try {
      await dbActions.addContent(
        'current-project', // This should come from project context
        'user_message',
        input.trim(),
        userMessage
      );
    } catch (error) {
      console.error('Failed to save message to database:', error);
    }

    // Clear input
    setInput('');
    setAttachments([]);

    // Add loading message
    const assistantMessageId = addMessage({
      role: 'assistant',
      content: '',
      isStreaming: true
    });

    try {
      // Generate AI response
      const response = await aiActions.generateContent({
        prompt: input.trim(),
        type: 'conversation',
        model: selectedModel,
        attachments: attachments.map(att => ({
          type: att.type,
          content: att.content
        }))
      });

      if (response.success && response.data) {
        // Simulate streaming effect
        await simulateStreaming(assistantMessageId, response.data.content);
        
        // Save assistant response to database
        await dbActions.addContent(
          'current-project',
          'assistant_message',
          response.data.content,
          assistantMessageId
        );
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
  }, [input, attachments, addMessage, updateMessage, aiActions, dbActions, selectedModel, simulateStreaming]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        sendMessage();
      }
    }
    
    if (event.key === 'Escape') {
      setInput('');
      setAttachments([]);
    }
  }, [sendMessage]);

  // Copy message content
  const copyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  }, []);

  // Export conversation
  const exportConversation = useCallback(() => {
    const conversationData = {
      timestamp: new Date().toISOString(),
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        model: msg.model,
        provider: msg.provider
      }))
    };

    const blob = new Blob([JSON.stringify(conversationData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-conversation-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    if (window.confirm('Are you sure you want to clear the conversation?')) {
      setMessages([]);
      setStreamingState({
        isStreaming: false,
        currentMessage: '',
        messageId: ''
      });
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3">
          <Bot className="w-6 h-6 text-indigo-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
            <p className="text-sm text-gray-600">
              {aiState.settings.defaultProvider} • {selectedModel || 'Default Model'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-2 rounded-lg transition-colors ${
              autoScroll 
                ? 'bg-indigo-100 text-indigo-600' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Auto-scroll"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          
          <button
            onClick={exportConversation}
            className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            title="Export conversation"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <button
            onClick={clearConversation}
            className="p-2 bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
            title="Clear conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Bot className="w-12 h-12 mb-4 text-gray-300" />
                <p className="text-lg font-medium">Start a conversation</p>
                <p className="text-sm">Ask me anything about your writing project</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
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
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium">
                          {message.role === 'user' ? 'You' : 'Assistant'}
                        </span>
                        {message.model && (
                          <span className="text-xs opacity-75">
                            {message.model}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <span className="text-xs opacity-75">
                          {formatDistanceToNow(message.timestamp)}
                        </span>
                        
                        {message.role === 'assistant' && !message.isError && (
                          <>
                            <button
                              onClick={() => copyMessage(message.content)}
                              className="p-1 opacity-50 hover:opacity-100 transition-opacity"
                              title="Copy message"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            
                            <button
                              onClick={() => speakText(message.content)}
                              className="p-1 opacity-50 hover:opacity-100 transition-opacity"
                              title="Read aloud"
                            >
                              <Volume2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Message Content */}
                    <div className="whitespace-pre-wrap">
                      {message.isStreaming && streamingState.messageId === message.id ? (
                        <div className="flex items-center space-x-2">
                          <span>{streamingState.currentMessage}</span>
                          <div className="animate-pulse">▋</div>
                        </div>
                      ) : (
                        message.content
                      )}
                    </div>

                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center space-x-2 p-2 bg-white bg-opacity-20 rounded"
                          >
                            {attachment.type.startsWith('image/') ? (
                              <Image className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                            <span className="text-sm">{attachment.name}</span>
                            <span className="text-xs opacity-75">
                              ({(attachment.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Token Usage */}
                    {message.tokens && (
                      <div className="mt-2 text-xs opacity-75">
                        {message.tokens} tokens
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {/* Streaming indicator */}
            {streamingState.isStreaming && (
              <div className="flex items-center space-x-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">AI is thinking...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
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

          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Attachments ({attachments.length})
                  </span>
                  <button
                    onClick={() => setAttachments([])}
                    className="text-xs text-gray-500 hover:text-red-600"
                  >
                    Clear all
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-2 bg-white rounded border"
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        {attachment.type.startsWith('image/') ? (
                          <Image className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {attachment.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(attachment.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => removeAttachment(attachment.id)}
                        className="p-1 text-gray-400 hover:text-red-600 flex-shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-end space-x-2">
              {/* File Upload */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.txt,.md,.json,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                title="Upload file"
              >
                <Upload className="w-5 h-5" />
              </button>

              {/* Voice Input */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                  isRecording
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
                title={isRecording ? 'Stop recording' : 'Start voice input'}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Text Input */}
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (Ctrl+Enter to send)"
                  className="w-full p-3 pr-12 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[48px] max-h-32"
                  rows={1}
                  disabled={streamingState.isStreaming}
                />
                
                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                  {input.length}/4000
                </div>
              </div>

              {/* Send Button */}
              <button
                onClick={sendMessage}
                disabled={(!input.trim() && attachments.length === 0) || streamingState.isStreaming}
                className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                title="Send message (Ctrl+Enter)"
              >
                {streamingState.isStreaming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
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
          </div>
        </>
      )}
    </div>
  );
}