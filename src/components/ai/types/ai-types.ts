export interface Message {
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

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
  preview?: string;
}

export interface StreamingState {
  isStreaming: boolean;
  currentMessage: string;
  messageId: string;
}

export interface VoiceInputState {
  isRecording: boolean;
  mediaRecorder: MediaRecorder | null;
}

export interface AIAssistantState {
  messages: Message[];
  input: string;
  attachments: FileAttachment[];
  streamingState: StreamingState;
  isExpanded: boolean;
  selectedModel: string;
  voiceEnabled: boolean;
  autoScroll: boolean;
  isRecording: boolean;
}

export interface AIAssistantActions {
  setInput: (input: string) => void;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setAttachments: (attachments: FileAttachment[] | ((prev: FileAttachment[]) => FileAttachment[])) => void;
  setStreamingState: (state: StreamingState | ((prev: StreamingState) => StreamingState)) => void;
  setIsExpanded: (expanded: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setAutoScroll: (enabled: boolean) => void;
  setIsRecording: (recording: boolean) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  sendMessage: () => Promise<void>;
  clearConversation: () => void;
  exportConversation: () => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  removeAttachment: (id: string) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  speakText: (text: string) => void;
  stopSpeaking: () => void;
  copyMessage: (content: string) => Promise<void>;
}