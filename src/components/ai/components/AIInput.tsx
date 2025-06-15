import React, { useRef, useEffect, memo } from 'react';
import { Send, Upload, Mic, MicOff, Loader2, Trash2, Image, FileText } from 'lucide-react';
import { FileAttachment } from '../types/ai-types';

interface AIInputProps {
  input: string;
  attachments: FileAttachment[];
  isRecording: boolean;
  isStreaming: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (id: string) => void;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

const AttachmentPreview = memo(({ 
  attachments, 
  onRemoveAttachment, 
  onClearAll 
}: {
  attachments: FileAttachment[];
  onRemoveAttachment: (id: string) => void;
  onClearAll: () => void;
}) => {
  if (attachments.length === 0) return null;

  return (
    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Attachments ({attachments.length})
          </span>
          <button
            onClick={onClearAll}
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
                onClick={() => onRemoveAttachment(attachment.id)}
                className="p-1 text-gray-400 hover:text-red-600 flex-shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

AttachmentPreview.displayName = 'AttachmentPreview';

export const AIInput = memo(({
  input,
  attachments,
  isRecording,
  isStreaming,
  onInputChange,
  onSendMessage,
  onFileUpload,
  onRemoveAttachment,
  onStartRecording,
  onStopRecording,
  onKeyDown
}: AIInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleClearAllAttachments = () => {
    attachments.forEach(attachment => onRemoveAttachment(attachment.id));
  };

  const canSend = (input.trim() || attachments.length > 0) && !isStreaming;

  return (
    <>
      <AttachmentPreview
        attachments={attachments}
        onRemoveAttachment={onRemoveAttachment}
        onClearAll={handleClearAllAttachments}
      />

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-end space-x-2">
          {/* File Upload */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.txt,.md,.json,.csv"
            onChange={onFileUpload}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
            title="Upload file"
            disabled={isStreaming}
          >
            <Upload className="w-5 h-5" />
          </button>

          {/* Voice Input */}
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
              isRecording
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
            }`}
            title={isRecording ? 'Stop recording' : 'Start voice input'}
            disabled={isStreaming}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type your message... (Ctrl+Enter to send)"
              className="w-full p-3 pr-12 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[48px] max-h-32"
              rows={1}
              disabled={isStreaming}
            />
            
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              {input.length}/4000
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={onSendMessage}
            disabled={!canSend}
            className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            title="Send message (Ctrl+Enter)"
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </>
  );
});

AIInput.displayName = 'AIInput';