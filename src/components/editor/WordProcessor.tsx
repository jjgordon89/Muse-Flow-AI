import React, { useCallback, useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { useWordCount } from '../../hooks/useWordCount';

interface WordProcessorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  targetWordCount?: number;
}

export function WordProcessor({ 
  content, 
  onChange, 
  placeholder = "Begin your story...",
  targetWordCount = 50000
}: WordProcessorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wordCount = useWordCount(content);
  const progress = targetWordCount > 0 ? (wordCount / targetWordCount) * 100 : 0;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Word count bar */}
      <div className="flex-shrink-0 px-6 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">
              {wordCount.toLocaleString()} words
            </span>
            {targetWordCount > 0 && (
              <div className="flex items-center space-x-2">
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {Math.round(progress)}% of {targetWordCount.toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Main editor */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <TextareaAutosize
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            placeholder={placeholder}
            className="w-full min-h-[calc(100vh-200px)] p-0 text-lg leading-relaxed text-gray-900 placeholder-gray-400 border-none outline-none resize-none font-serif"
            style={{ 
              lineHeight: '1.8',
              fontFamily: 'Georgia, "Times New Roman", serif'
            }}
          />
        </div>
      </div>
    </div>
  );
}