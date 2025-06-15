import { memo } from 'react';
import { Bot, ChevronDown, ChevronUp, Download, Trash2 } from 'lucide-react';

interface AIHeaderProps {
  providerName: string;
  selectedModel: string;
  isExpanded: boolean;
  autoScroll: boolean;
  onToggleExpanded: () => void;
  onToggleAutoScroll: () => void;
  onExportConversation: () => void;
  onClearConversation: () => void;
}

export const AIHeader = memo(({
  providerName,
  selectedModel,
  isExpanded,
  autoScroll,
  onToggleExpanded,
  onToggleAutoScroll,
  onExportConversation,
  onClearConversation
}: AIHeaderProps) => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center space-x-3">
        <Bot className="w-6 h-6 text-indigo-600" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
          <p className="text-sm text-gray-600">
            {providerName} • {selectedModel || 'Default Model'}
          </p>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <button
          onClick={onToggleAutoScroll}
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
          onClick={onExportConversation}
          className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          title="Export conversation"
        >
          <Download className="w-4 h-4" />
        </button>
        
        <button
          onClick={onClearConversation}
          className="p-2 bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
          title="Clear conversation"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        
        <button
          onClick={onToggleExpanded}
          className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
});

AIHeader.displayName = 'AIHeader';