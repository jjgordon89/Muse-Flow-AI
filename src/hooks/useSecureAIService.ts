import { useState, useEffect } from 'react';
import { SecureAIService, SecureAISettings, createDefaultSecureAISettings } from '../services/secureAIProviders';

export function useSecureAIService() {
  const [settings, setSettings] = useState<SecureAISettings>(() => {
    try {
      const saved = localStorage.getItem('aiSettings');
      return saved ? JSON.parse(saved) : createDefaultSecureAISettings();
    } catch (error) {
      console.error('Failed to load AI settings:', error);
      return createDefaultSecureAISettings();
    }
  });

  const [aiService, setAIService] = useState<SecureAIService>(() => new SecureAIService(settings));
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize secure storage
  useEffect(() => {
    const initializeService = async () => {
      try {
        await aiService.initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize AI service:', error);
      }
    };

    initializeService();
  }, [aiService]);

  const updateSettings = (newSettings: SecureAISettings) => {
    setSettings(newSettings);
    localStorage.setItem('aiSettings', JSON.stringify(newSettings));
    aiService.updateSettings(newSettings);
  };

  const setApiKey = async (providerId: string, apiKey: string) => {
    try {
      await aiService.setApiKey(providerId, apiKey);
    } catch (error) {
      throw new Error(`Failed to save API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getApiKey = async (providerId: string): Promise<string | null> => {
    try {
      return await aiService.getApiKey(providerId);
    } catch (error) {
      console.error('Failed to retrieve API key:', error);
      return null;
    }
  };

  const removeApiKey = async (providerId: string) => {
    try {
      await aiService.removeApiKey(providerId);
    } catch (error) {
      console.error('Failed to remove API key:', error);
    }
  };

  useEffect(() => {
    localStorage.setItem('aiSettings', JSON.stringify(settings));
  }, [settings]);

  return {
    settings,
    aiService,
    isInitialized,
    updateSettings,
    setApiKey,
    getApiKey,
    removeApiKey
  };
}