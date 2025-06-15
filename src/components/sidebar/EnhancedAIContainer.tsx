import React, { useState, useMemo } from 'react';
import { EnhancedAIAssistant } from '../ai/EnhancedAIAssistant';
import { ResponsiveAIInterface } from '../ai/ResponsiveAIInterface';
import { StreamingAIChat } from '../ai/StreamingAIChat';
import { AIPanelOptimized } from './AIPanelOptimized';
import { useAI, useUI } from '../../contexts/hooks';

// Simple icon components to replace lucide-react
const IconSettings = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconChevronDown = ({ className }: { className?: string }) => (
  <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const IconBot = ({ className }: { className?: string }) => (
  <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const IconMessageSquare = ({ className }: { className?: string }) => (
  <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const IconZap = ({ className }: { className?: string }) => (
  <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const IconBrain = ({ className }: { className?: string }) => (
  <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

type AIInterfaceType = 'optimized' | 'enhanced' | 'responsive' | 'streaming';

interface AIInterfaceOption {
  id: AIInterfaceType;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
}

const AI_INTERFACES: AIInterfaceOption[] = [
  {
    id: 'optimized',
    name: 'AI Panel (Original)',
    description: 'The original AI assistant with quick prompts and generation',
    icon: IconBot,
    features: ['Quick Prompts', 'Character Development', 'Plot Development', 'Simple Interface']
  },
  {
    id: 'enhanced',
    name: 'Enhanced AI Assistant',
    description: 'Advanced AI assistant with voice input, file attachments, and conversation management',
    icon: IconBrain,
    features: ['Voice Input', 'File Attachments', 'Conversation History', 'Export/Import', 'Advanced Controls']
  },
  {
    id: 'responsive',
    name: 'Responsive AI Interface',
    description: 'Mobile-friendly AI interface that adapts to different screen sizes',
    icon: IconMessageSquare,
    features: ['Mobile Optimized', 'Adaptive Layout', 'Touch Friendly', 'Copy to Clipboard', 'Clean Design']
  },
  {
    id: 'streaming',
    name: 'Streaming AI Chat',
    description: 'Real-time streaming AI chat with accessibility features and conversation management',
    icon: IconZap,
    features: ['Real-time Streaming', 'Accessibility Support', 'Voice Output', 'Conversation History', 'Fullscreen Mode']
  }
];

export function EnhancedAIContainer() {
  const [selectedInterface, setSelectedInterface] = useState<AIInterfaceType>('optimized');
  const [showInterfaceSelector, setShowInterfaceSelector] = useState(false);
  
  const { state: aiState, actions: aiActions } = useAI();
  const { actions: uiActions } = useUI();

  const handleShowSettings = () => {
    uiActions.openModal('settings');
  };  // Memoize the service interface to prevent unnecessary re-renders
  const aiService = useMemo(() => ({
    generateContent: aiActions.generateContent,
    getSettings: () => aiState.settings,
    getApiKey: async (providerId: string) => {
      // Add getApiKey method for compatibility
      try {
        return await aiActions.getApiKey?.(providerId) || null;
      } catch {
        return null;
      }
    }
  }), [aiActions, aiState.settings]);

  const currentInterface = AI_INTERFACES.find(i => i.id === selectedInterface);

  const renderInterface = () => {
    switch (selectedInterface) {
      case 'enhanced':
        return <EnhancedAIAssistant />;
      case 'responsive':
        return <ResponsiveAIInterface />;
      case 'streaming':
        return <StreamingAIChat />;
      case 'optimized':
      default:
        return (
          <AIPanelOptimized
            aiService={aiService}
            onShowSettings={handleShowSettings}
          />
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Interface Selector Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>          <button
            onClick={handleShowSettings}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="AI Settings"
          >
            <IconSettings />
          </button>
        </div>
        
        {/* Interface Type Selector */}
        <div className="relative">
          <button
            onClick={() => setShowInterfaceSelector(!showInterfaceSelector)}
            className="w-full flex items-center justify-between p-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
          >
            <div className="flex items-center space-x-2">
              {currentInterface && (
                <>
                  <currentInterface.icon className="w-4 h-4" />
                  <span className="font-medium">{currentInterface.name}</span>
                </>
              )}
            </div>
            <IconChevronDown className={`w-4 h-4 transition-transform ${showInterfaceSelector ? 'rotate-180' : ''}`} />
          </button>          {showInterfaceSelector && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
              {AI_INTERFACES.map((aiInterface) => {
                const Icon = aiInterface.icon;
                return (
                  <button
                    key={aiInterface.id}
                    onClick={() => {
                      setSelectedInterface(aiInterface.id);
                      setShowInterfaceSelector(false);
                    }}
                    className={`w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                      selectedInterface === aiInterface.id ? 'bg-indigo-50 border-indigo-200' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <Icon className={`w-5 h-5 mt-0.5 ${
                        selectedInterface === aiInterface.id ? 'text-indigo-600' : 'text-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className={`font-medium text-sm ${
                            selectedInterface === aiInterface.id ? 'text-indigo-900' : 'text-gray-900'
                          }`}>
                            {aiInterface.name}
                          </p>
                          {selectedInterface === aiInterface.id && (
                            <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {aiInterface.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {aiInterface.features.slice(0, 3).map((feature) => (
                            <span
                              key={feature}
                              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                            >
                              {feature}
                            </span>
                          ))}
                          {aiInterface.features.length > 3 && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                              +{aiInterface.features.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Current Interface Description */}
        {currentInterface && (
          <div className="mt-3 p-2 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">
              {currentInterface.description}
            </p>
          </div>
        )}
      </div>

      {/* Interface Content */}
      <div className="flex-1 overflow-hidden">
        {renderInterface()}
      </div>
    </div>
  );
}
