import React from 'react';
import { ExportImportPanel } from './ExportImportPanel';
import { useProject } from '../../contexts';

interface ExportImportModalProps {
  onClose: () => void;
}

export function ExportImportModal({ onClose }: ExportImportModalProps) {
  const { state: projectState, actions: projectActions } = useProject();

  const handleImportProject = (project: any) => {
    projectActions.setProject(project);
    onClose();
  };

  return (
    <ExportImportPanel
      project={projectState.currentProject}
      onImportProject={handleImportProject}
      onClose={onClose}
    />
  );
}