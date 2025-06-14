import React from 'react';
import { SettingsPanel } from '../sidebar/SettingsPanel';
import { useAI } from '../../contexts';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { state: aiState, actions: aiActions } = useAI();

  return (
    <SettingsPanel
      settings={aiState.settings}
      onUpdateSettings={aiActions.updateSettings}
      onClose={onClose}
    />
  );
}