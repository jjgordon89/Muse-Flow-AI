import { useState, useRef, useCallback } from 'react';
import { useAI, useDatabase } from '../../../contexts/hooks';
import { Message, FileAttachment, StreamingState } from '../types/ai-types';

export function useAIAssistant() {
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Contexts
  const { state: aiState, actions: aiActions } = useAI();
  const { actions: dbActions } = useDatabase();

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

  // Voice input setup
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
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

  return {
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
  };
}