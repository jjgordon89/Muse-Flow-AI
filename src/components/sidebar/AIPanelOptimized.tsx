import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Bot, Send, Sparkles, Settings, Zap, AlertTriangle, Copy, CheckCircle, Clock, Search } from 'lucide-react';
import { SecureAIService, AIRequest, createDefaultSecureAISettings, AI_PROVIDERS } from '../../services/secureAIProviders';
import { VirtualList, VirtualListItem } from '../common/VirtualList';
import { ErrorBoundary } from '../common/ErrorBoundary';

interface AIPanelProps {
  aiService: {
    generateContent: (request: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    getSettings: () => any;
    getApiKey: (providerId: string) => Promise<string | null>;
  };
  onShowSettings: () => void;
}

interface GenerationEntry {
  id: string;
  prompt: string;
  content: string;
  provider: string;
  model: string;
  timestamp: Date;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

const quickPrompts = [
  {
    title: 'Character Development',
    prompts: [
      'Create a complex backstory for my character including their childhood, formative experiences, and what drives them.',
      'Develop realistic character flaws and internal motivations that create compelling conflict.',
      'Suggest character relationships and potential conflicts that could drive the story forward.'
    ]
  },
  {
    title: 'Plot Development',
    prompts: [
      'Generate unexpected plot twists that recontextualize previous events in the story.',
      'Create tension and conflict scenarios that test my characters in meaningful ways.',
      'Develop compelling subplot ideas that complement and enhance the main narrative.'
    ]
  },
  {
    title: 'World Building',
    prompts: [
      'Create detailed setting descriptions that bring locations to life with sensory details.',
      'Develop unique cultural elements, customs, and societal structures.',
      'Generate location names and geographical features that fit the story\'s tone and genre.'
    ]
  },
  {
    title: 'Dialogue & Scenes',
    prompts: [
      'Write realistic dialogue that reveals character personality and advances the plot.',
      'Improve pacing and flow in scenes to maintain reader engagement.',
      'Add sensory details and atmospheric elements that immerse readers in the scene.'
    ]
  }
];

// Memoized generation history item
const GenerationHistoryItem = React.memo<{
  entry: GenerationEntry;
  onCopy: (content: string) => void;
}>(({ entry, onCopy }) => (
  <VirtualListItem>
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">
          {entry.provider} • {entry.model}
        </span>
        <div className="flex items-center space-x-1">
          {entry.usage && (
            <span className="text-xs text-gray-500">
              {entry.usage.totalTokens} tokens
            </span>
          )}
          <button
            onClick={() => onCopy(entry.content)}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-600 line-clamp-2">
        {entry.prompt}
      </p>
    </div>
  </VirtualListItem>
));

GenerationHistoryItem.displayName = 'GenerationHistoryItem';

export const AIPanel = React.memo<AIPanelProps>(({ aiService, onShowSettings }) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [error, setError] = useState('');
  const [generationHistory, setGenerationHistory] = useState<GenerationEntry[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [isProviderConfigured, setIsProviderConfigured] = useState(false);
  const [checkingConfiguration, setCheckingConfiguration] = useState(true);

  const settings = aiService.getSettings();
  const activeProvider = AI_PROVIDERS.find(p => p.id === settings.defaultProvider);
  const providerConfig = settings.providers[settings.defaultProvider];

  // Check if provider is properly configured including API key in secure storage
  useEffect(() => {
    const checkProviderConfiguration = async () => {
      setCheckingConfiguration(true);
      
      if (!activeProvider || !providerConfig?.isEnabled) {
        setIsProviderConfigured(false);
        setCheckingConfiguration(false);
        return;
      }

      if (activeProvider.requiresApiKey) {
        try {
          const apiKey = await aiService.getApiKey(activeProvider.id);
          setIsProviderConfigured(!!apiKey);
        } catch (error) {
          console.error('Error checking API key:', error);
          setIsProviderConfigured(false);
        }
      } else {
        setIsProviderConfigured(true);
      }
      
      setCheckingConfiguration(false);
    };

    checkProviderConfiguration();
  }, [activeProvider, providerConfig, aiService]);

  // Memoized filtered history
  const filteredHistory = useMemo(() => {
    if (!historySearch) return generationHistory;
    
    const term = historySearch.toLowerCase();
    return generationHistory.filter(entry =>
      entry.prompt.toLowerCase().includes(term) ||
      entry.content.toLowerCase().includes(term) ||
      entry.provider.toLowerCase().includes(term)
    );
  }, [generationHistory, historySearch]);

  const handleGenerate = useCallback(async (prompt: string, type: string = 'custom') => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError('');
    
    try {
      const request: AIRequest = {
        prompt: prompt.trim(),
        type,
        model: providerConfig?.selectedModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens
      };

      const response = await aiService.generateContent(request);
      
      if (response.success && response.data) {
        setGeneratedContent(response.data.content);
        
        // Add to history
        const historyEntry: GenerationEntry = {
          id: Date.now().toString(),
          prompt: prompt.trim(),
          content: response.data.content,
          provider: response.data.provider,
          model: response.data.model,
          timestamp: new Date(),
          usage: response.data.usage
        };
        
        setGenerationHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // Keep last 10
      } else {
        setError(response.error || 'Generation failed');
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('AI generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [aiService, providerConfig, settings]);

  const handleCustomPrompt = useCallback(() => {
    if (customPrompt.trim()) {
      handleGenerate(customPrompt, 'custom');
    }
  }, [customPrompt, handleGenerate]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, []);

  const renderHistoryItem = useCallback((entry: GenerationEntry) => (
    <GenerationHistoryItem
      key={entry.id}
      entry={entry}
      onCopy={copyToClipboard}
    />
  ), [copyToClipboard]);

  const historyKeyExtractor = useCallback((entry: GenerationEntry) => entry.id, []);

  // Show loading state while checking configuration
  if (checkingConfiguration) {
    return (
      <ErrorBoundary level="panel">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Bot className="w-5 h-5 text-indigo-600" />
              <span>AI Assistant</span>
            </h3>
            <button 
              onClick={onShowSettings}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm">Checking AI provider configuration...</p>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  if (!isProviderConfigured) {
    return (
      <ErrorBoundary level="panel">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Bot className="w-5 h-5 text-indigo-600" />
              <span>AI Assistant</span>
            </h3>
            <button 
              onClick={onShowSettings}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Configure AI Providers</h4>
            <p className="text-gray-600 mb-6 text-sm leading-relaxed">
              {activeProvider?.requiresApiKey 
                ? `To start generating content, you need to configure an API key for ${activeProvider.name}.`
                : 'To start generating content, you need to configure at least one AI provider.'
              }
            </p>
            <button
              onClick={onShowSettings}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Open Settings
            </button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Zap className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h5 className="text-sm font-medium text-blue-800">Supported Providers</h5>
                <ul className="text-sm text-blue-700 mt-1 space-y-1">
                  <li>• Cloud: OpenAI, Anthropic, OpenRouter, HuggingFace</li>
                  <li>• Local: Ollama, LM Studio</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary level="panel">
      <div className="p-4 space-y-6 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            <span>AI Assistant</span>
          </h3>
          <button 
            onClick={onShowSettings}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Provider Status */}
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              {activeProvider?.name} ({providerConfig?.selectedModel || activeProvider?.models[0]})
            </span>
          </div>
          <div className="text-xs text-green-600">
            {settings.temperature}°C • {settings.maxTokens} tokens
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-red-800">Generation Failed</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Custom Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Prompt
          </label>
          <div className="space-y-3">
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="Enter your prompt here... Be specific about what you want the AI to help with."
              disabled={isGenerating}
            />
            <button
              onClick={handleCustomPrompt}
              disabled={isGenerating || !customPrompt.trim()}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Prompts */}
        <div className="flex-1 flex flex-col min-h-0">
          <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Quick Prompts</span>
          </h4>
          
          <div className="space-y-4 flex-1 overflow-y-auto">
            {quickPrompts.map((category, categoryIndex) => (
              <div key={categoryIndex}>
                <h5 className="text-sm font-medium text-gray-700 mb-2">
                  {category.title}
                </h5>
                <div className="space-y-1">
                  {category.prompts.map((prompt, promptIndex) => (
                    <button
                      key={promptIndex}
                      onClick={() => handleGenerate(prompt, category.title.toLowerCase())}
                      disabled={isGenerating}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Generated Content */}
        {generatedContent && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-md font-semibold text-gray-900">Generated Content</h4>
              <div className="flex space-x-1">
                <button
                  onClick={() => copyToClipboard(generatedContent)}
                  className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded flex items-center space-x-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
                <button
                  onClick={() => copyToClipboard(generatedContent)}
                  className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded"
                >
                  Insert
                </button>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                {generatedContent}
              </pre>
            </div>
          </div>
        )}

        {/* Generation History */}
        {generationHistory.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-semibold text-gray-900 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-600" />
                <span>Recent Generations</span>
              </h4>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search..."
                  className="text-xs pl-7 pr-2 py-1 border border-gray-300 rounded"
                />
              </div>
            </div>
            
            <div className="flex-1 min-h-0">
              <VirtualList
                items={filteredHistory}
                itemHeight={60}
                containerHeight={200}
                renderItem={renderHistoryItem}
                keyExtractor={historyKeyExtractor}
                className="border border-gray-200 rounded-lg"
              />
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
});

AIPanel.displayName = 'AIPanel';