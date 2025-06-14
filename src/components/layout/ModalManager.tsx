import React from 'react';
import { SettingsModal } from './SettingsModal';
import { ExportImportModal } from './ExportImportModal';
import { useUI } from '../../contexts';
import { EnhancedErrorBoundary } from '../common/EnhancedErrorBoundary';

export function ModalManager() {
  const { state: uiState, actions: uiActions } = useUI();

  return (
    <>
      {uiState.modals.settings && (
        <EnhancedErrorBoundary level="component" component="SettingsModal">
          <SettingsModal onClose={() => uiActions.closeModal('settings')} />
        </EnhancedErrorBoundary>
      )}

      {uiState.modals.exportImport && (
        <EnhancedErrorBoundary level="component" component="ExportImportModal">
          <ExportImportModal onClose={() => uiActions.closeModal('exportImport')} />
        </EnhancedErrorBoundary>
      )}
    </>
  );
}