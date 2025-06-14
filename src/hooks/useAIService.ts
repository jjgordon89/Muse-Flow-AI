import { useState, useEffect } from 'react';
import { AIService, AISettings, createDefaultAISettings } from '../services/aiProviders';

export function useAIService() {
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const saved = localStorage.getItem('aiSettings');
      return saved ? JSON.parse(saved) : createDefaultAISettings();
    } catch (error) {
      console.error('Failed to load AI settings:', error);
      return createDefaultAISettings();
    }
  });

  const [aiService, setAIService] = useState<AIService>(() => new AIService(settings));

  const updateSettings = (newSettings: AISettings) => {
    setSettings(newSettings);
    localStorage.setItem('aiSettings', JSON.stringify(newSettings));
    aiService.updateSettings(newSettings);
  };

  useEffect(() => {
    localStorage.setItem('aiSettings', JSON.stringify(settings));
  }, [settings]);

  return {
    settings,
    aiService,
    updateSettings
  };
}