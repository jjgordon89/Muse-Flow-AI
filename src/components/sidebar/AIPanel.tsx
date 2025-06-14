import React, { useState } from 'react';
import { Bot, Send, Sparkles, Settings, Zap, AlertTriangle, Copy, CheckCircle, Clock } from 'lucide-react';
import { AIService, AIRequest, createDefaultAISettings, AI_PROVIDERS } from '../../services/aiProviders';

interface AIPanelProps {
  aiService: AIService;
  onShowSettings: () => void;
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

export function AIPanel({ aiService, onShowSettings }: AIPanelProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [error, setError] = useState('');
  const [generationHistory, setGenerationHistory] = useState<Array<{
    id: string;
    prompt: string;
    content: string;
    provider: string;
    model: string;
    timestamp: Date;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }>>([]);

  const settings = aiService.getSettings();
  const activeProvider = AI_PROVIDERS.find(p => p.id === settings.defaultProvider);
  const providerConfig = settings.providers[settings.defaultProvider];
  const isProviderConfigured = providerConfig?.isEnabled && 
    (!activeProvider?.requiresApiKey || providerConfig?.apiKey);

  const handleGenerate = async (prompt: string, type: string = 'custom') => {
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
      
      setGeneratedContent(response.content);
      
      // Add to history
      const historyEntry = {
        id: Date.now().toString(),
        prompt: prompt.trim(),
        content: response.content,
        provider: response.provider,
        model: response.model,
        timestamp: new Date(),
        usage: response.usage
      };
      
      setGenerationHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // Keep last 10
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('AI generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomPrompt = () => {
    if (customPrompt.trim()) {
      handleGenerate(customPrompt, 'custom');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const insertIntoEditor = (content: string) => {
    // This would need to be connected to the main editor
    // For now, we'll just copy to clipboard
    copyToClipboard(content);
  };

  if (!isProviderConfigured) {
    return (
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
            To start generating content, you need to configure at least one AI provider with a valid API key.
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
    );
  }

  return (
    <div className="p-4 space-y-6">
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
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>Quick Prompts</span>
        </h4>
        
        <div className="space-y-4">
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
                onClick={() => insertIntoEditor(generatedContent)}
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
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-600" />
            <span>Recent Generations</span>
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {generationHistory.map((entry) => (
              <div key={entry.id} className="p-2 bg-gray-50 rounded border border-gray-200">
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
                      onClick={() => copyToClipboard(entry.content)}
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}