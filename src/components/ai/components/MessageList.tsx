import { useRef, useEffect, memo } from 'react';
import { Bot, User, Copy, Volume2, Image, FileText } from 'lucide-react';
import { Message, FileAttachment } from '../types/ai-types';

interface MessageListProps {
  messages: Message[];
  streamingState: {
    isStreaming: boolean;
    currentMessage: string;
    messageId: string;
  };
  autoScroll: boolean;
  onCopyMessage: (content: string) => void;
  onSpeakText: (text: string) => void;
}

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

const MessageAttachments = memo(({ attachments }: { attachments: FileAttachment[] }) => (
  <div className="mt-3 space-y-2">
    {attachments.map((attachment) => (
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
));

MessageAttachments.displayName = 'MessageAttachments';

const MessageContent = memo(({ 
  message, 
  streamingState, 
  onCopyMessage, 
  onSpeakText 
}: {
  message: Message;
  streamingState: MessageListProps['streamingState'];
  onCopyMessage: (content: string) => void;
  onSpeakText: (text: string) => void;
}) => (
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
              onClick={() => onCopyMessage(message.content)}
              className="p-1 opacity-50 hover:opacity-100 transition-opacity"
              title="Copy message"
            >
              <Copy className="w-3 h-3" />
            </button>
            
            <button
              onClick={() => onSpeakText(message.content)}
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
      <MessageAttachments attachments={message.attachments} />
    )}

    {/* Token Usage */}
    {message.tokens && (
      <div className="mt-2 text-xs opacity-75">
        {message.tokens} tokens
      </div>
    )}
  </div>
));

MessageContent.displayName = 'MessageContent';

export const MessageList = memo(({
  messages,
  streamingState,
  autoScroll,
  onCopyMessage,
  onSpeakText
}: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingState.currentMessage, autoScroll]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <Bot className="w-12 h-12 mb-4 text-gray-300" />
        <p className="text-lg font-medium">Start a conversation</p>
        <p className="text-sm">Ask me anything about your writing project</p>
      </div>
    );
  }

  return (
    <>
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <MessageContent
            message={message}
            streamingState={streamingState}
            onCopyMessage={onCopyMessage}
            onSpeakText={onSpeakText}
          />
        </div>
      ))}
      <div ref={messagesEndRef} />
    </>
  );
});

MessageList.displayName = 'MessageList';