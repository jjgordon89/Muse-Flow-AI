import React, { useMemo } from 'react';
import { AIPanel } from './AIPanelOptimized';
import { useAI, useUI } from '../../contexts';

export function AIPanelContainer() {
  const { state: aiState, actions: aiActions } = useAI();
  const { actions: uiActions } = useUI();

  const handleShowSettings = () => {
    uiActions.openModal('settings');
  };

  // Memoize the service interface to prevent unnecessary re-renders
  const aiService = useMemo(() => ({
    generateContent: aiActions.generateContent,
    getSettings: () => aiState.settings
  }), [aiActions.generateContent, aiState.settings]);

  return (
    <AIPanel
      aiService={aiService}
      onShowSettings={handleShowSettings}
    />
  );
}