import React, { useState } from 'react';
import { Settings, Eye, EyeOff, AlertTriangle, CheckCircle, Zap, Key, Globe, Monitor } from 'lucide-react';
import { AI_PROVIDERS, AISettings, AIProvider } from '../../services/aiProviders';

interface SettingsPanelProps {
  settings: AISettings;
  onUpdateSettings: (settings: AISettings) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onUpdateSettings, onClose }: SettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState<AISettings>({ ...settings });
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({});

  const handleProviderToggle = (providerId: string) => {
    setLocalSettings({
      ...localSettings,
      providers: {
        ...localSettings.providers,
        [providerId]: {
          ...localSettings.providers[providerId],
          isEnabled: !localSettings.providers[providerId]?.isEnabled
        }
      }
    });
  };

  const handleApiKeyChange = (providerId: string, apiKey: string) => {
    setLocalSettings({
      ...localSettings,
      providers: {
        ...localSettings.providers,
        [providerId]: {
          ...localSettings.providers[providerId],
          apiKey
        }
      }
    });
  };

  const handleEndpointChange = (providerId: string, endpoint: string) => {
    setLocalSettings({
      ...localSettings,
      providers: {
        ...localSettings.providers,
        [providerId]: {
          ...localSettings.providers[providerId],
          endpoint: endpoint || undefined
        }
      }
    });
  };

  const handleModelChange = (providerId: string, model: string) => {
    setLocalSettings({
      ...localSettings,
      providers: {
        ...localSettings.providers,
        [providerId]: {
          ...localSettings.providers[providerId],
          selectedModel: model
        }
      }
    });
  };

  const testConnection = async (provider: AIProvider) => {
    setTestingProvider(provider.id);
    setTestResults({ ...testResults, [provider.id]: null });

    try {
      const providerSettings = localSettings.providers[provider.id];
      const baseUrl = providerSettings?.endpoint || provider.baseUrl;
      
      let testUrl: string;
      let testOptions: RequestInit;

      if (provider.id === 'ollama') {
        testUrl = `${baseUrl}/api/tags`;
        testOptions = { method: 'GET' };
      } else if (provider.id === 'lmstudio') {
        testUrl = `${baseUrl}/models`;
        testOptions = { method: 'GET' };
      } else if (provider.requiresApiKey) {
        if (!providerSettings?.apiKey) {
          throw new Error('API key is required');
        }
        
        // Test with a simple request
        if (provider.id === 'openai' || provider.id === 'openrouter') {
          testUrl = `${baseUrl}/models`;
          testOptions = {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${providerSettings.apiKey}`,
              ...(provider.id === 'openrouter' && {
                'HTTP-Referer': window.location.origin,
                'X-Title': 'AI Fiction Writer'
              })
            }
          };
        } else if (provider.id === 'anthropic') {
          // Anthropic doesn't have a models endpoint, so we'll just validate the key format
          if (!providerSettings.apiKey.startsWith('sk-ant-')) {
            throw new Error('Invalid Anthropic API key format');
          }
          setTestResults({ ...testResults, [provider.id]: 'success' });
          setTestingProvider(null);
          return;
        } else if (provider.id === 'huggingface') {
          testUrl = 'https://huggingface.co/api/whoami';
          testOptions = {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${providerSettings.apiKey}`
            }
          };
        } else {
          throw new Error('Test not implemented for this provider');
        }
      } else {
        throw new Error('Unknown provider type');
      }

      const response = await fetch(testUrl, testOptions);
      
      if (response.ok) {
        setTestResults({ ...testResults, [provider.id]: 'success' });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Connection test failed for ${provider.name}:`, error);
      setTestResults({ ...testResults, [provider.id]: 'error' });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSave = () => {
    onUpdateSettings(localSettings);
    onClose();
  };

  const getProviderIcon = (provider: AIProvider) => {
    return provider.type === 'local' ? Monitor : Globe;
  };

  const enabledProviders = Object.entries(localSettings.providers).filter(([_, config]) => config.isEnabled);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <Settings className="w-6 h-6 text-indigo-600" />
            <span>AI Provider Settings</span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Sidebar */}
          <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
            <nav className="space-y-2">
              <div className="text-sm font-medium text-gray-700 mb-2">Configuration</div>
              <a href="#providers" className="block px-3 py-2 text-sm text-indigo-600 bg-indigo-50 rounded-lg">
                AI Providers
              </a>
              <a href="#general" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                General Settings
              </a>
            </nav>

            {enabledProviders.length > 0 && (
              <div className="mt-6">
                <div className="text-sm font-medium text-gray-700 mb-2">Active Providers</div>
                <div className="space-y-1">
                  {enabledProviders.map(([providerId, config]) => {
                    const provider = AI_PROVIDERS.find(p => p.id === providerId);
                    if (!provider) return null;
                    
                    const Icon = getProviderIcon(provider);
                    return (
                      <div key={providerId} className="flex items-center space-x-2 px-2 py-1 text-xs text-gray-600">
                        <Icon className="w-3 h-3" />
                        <span>{provider.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Security Warning */}
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800">Security Notice</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      API keys are stored locally in your browser and sent directly to AI providers. 
                      Never share your API keys or use them on untrusted devices.
                    </p>
                  </div>
                </div>
              </div>

              {/* General Settings */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">General Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Provider
                    </label>
                    <select
                      value={localSettings.defaultProvider}
                      onChange={(e) => setLocalSettings({ ...localSettings, defaultProvider: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      {AI_PROVIDERS.map(provider => (
                        <option key={provider.id} value={provider.id} disabled={!localSettings.providers[provider.id]?.isEnabled}>
                          {provider.name} {!localSettings.providers[provider.id]?.isEnabled && '(Disabled)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Temperature ({localSettings.temperature})
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={localSettings.temperature}
                      onChange={(e) => setLocalSettings({ ...localSettings, temperature: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Focused</span>
                      <span>Creative</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      value={localSettings.maxTokens}
                      onChange={(e) => setLocalSettings({ ...localSettings, maxTokens: parseInt(e.target.value) || 1500 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      min="100"
                      max="4000"
                    />
                  </div>
                </div>
              </div>

              {/* Providers */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">AI Providers</h3>
                
                <div className="space-y-4">
                  {AI_PROVIDERS.map(provider => {
                    const providerConfig = localSettings.providers[provider.id] || {};
                    const isEnabled = providerConfig.isEnabled;
                    const Icon = getProviderIcon(provider);
                    
                    return (
                      <div
                        key={provider.id}
                        className={`border rounded-lg p-4 ${
                          isEnabled ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start space-x-3">
                            <Icon className={`w-6 h-6 mt-1 ${
                              provider.type === 'local' ? 'text-gray-600' : 'text-blue-600'
                            }`} />
                            <div>
                              <h4 className="font-medium text-gray-900 flex items-center space-x-2">
                                <span>{provider.name}</span>
                                {provider.type === 'local' && (
                                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                    Local
                                  </span>
                                )}
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">{provider.description}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {testResults[provider.id] === 'success' && (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            )}
                            {testResults[provider.id] === 'error' && (
                              <AlertTriangle className="w-5 h-5 text-red-500" />
                            )}
                            
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={() => handleProviderToggle(provider.id)}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">Enable</span>
                            </label>
                          </div>
                        </div>

                        {isEnabled && (
                          <div className="space-y-3 border-t border-gray-200 pt-3">
                            {/* API Key */}
                            {provider.requiresApiKey && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  API Key
                                </label>
                                <div className="flex space-x-2">
                                  <div className="flex-1 relative">
                                    <input
                                      type={showApiKeys[provider.id] ? 'text' : 'password'}
                                      value={providerConfig.apiKey || ''}
                                      onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                      placeholder="Enter your API key..."
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowApiKeys({
                                        ...showApiKeys,
                                        [provider.id]: !showApiKeys[provider.id]
                                      })}
                                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                      {showApiKeys[provider.id] ? (
                                        <EyeOff className="w-4 h-4" />
                                      ) : (
                                        <Eye className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Custom Endpoint */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Custom Endpoint (Optional)
                              </label>
                              <input
                                type="url"
                                value={providerConfig.endpoint || ''}
                                onChange={(e) => handleEndpointChange(provider.id, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder={provider.baseUrl}
                              />
                            </div>

                            {/* Model Selection */}
                            <div className="flex space-x-4">
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Default Model
                                </label>
                                <select
                                  value={providerConfig.selectedModel || provider.models[0]}
                                  onChange={(e) => handleModelChange(provider.id, e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                  {provider.models.map(model => (
                                    <option key={model} value={model}>{model}</option>
                                  ))}
                                </select>
                              </div>
                              
                              <div className="flex items-end">
                                <button
                                  onClick={() => testConnection(provider)}
                                  disabled={testingProvider === provider.id || (provider.requiresApiKey && !providerConfig.apiKey)}
                                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                                >
                                  {testingProvider === provider.id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                                  ) : (
                                    <Zap className="w-4 h-4" />
                                  )}
                                  <span>Test</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}