import React from 'react';
import { Header } from './Header';
import { useProject, useUI } from '../../contexts';
import { useAsyncErrorHandler } from '../../hooks/useAsyncErrorHandler';

export function HeaderContainer() {
  const { state: projectState, actions: projectActions } = useProject();
  const { actions: uiActions } = useUI();
  const { wrapAsync } = useAsyncErrorHandler({ component: 'HeaderContainer' });

  const handleSave = async () => {
    await wrapAsync(
      () => projectActions.saveProject(),
      { action: 'save-project' }
    );
  };

  const handleNewProject = () => {
    projectActions.createNewProject();
  };

  const handleSettings = () => {
    uiActions.openModal('settings');
  };

  const handleExportImport = () => {
    uiActions.openModal('exportImport');
  };

  return (
    <Header
      currentProject={projectState.currentProject.title}
      onSave={handleSave}
      onSettings={handleSettings}
      onNewProject={handleNewProject}
      onExportImport={handleExportImport}
      isSaving={projectState.isSaving}
    />
  );
}