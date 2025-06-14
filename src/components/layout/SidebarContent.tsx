import React from 'react';
import { OverviewPanel } from '../sidebar/OverviewPanel';
import { CharactersPanelContainer } from '../sidebar/CharactersPanelContainer';
import { StoryArcsPanelContainer } from '../sidebar/StoryArcsPanelContainer';
import { WorldBuildingPanel } from '../sidebar/WorldBuildingPanel';
import { CrossReferencesPanel } from '../sidebar/CrossReferencesPanel';
import { AIPanelContainer } from '../sidebar/AIPanelContainer';
import { PromptsPanel } from '../sidebar/PromptsPanel';
import { useProject, useUI } from '../../contexts';
import { EnhancedErrorBoundary } from '../common/EnhancedErrorBoundary';

interface SidebarContentProps {
  activeTab: string;
}

export function SidebarContent({ activeTab }: SidebarContentProps) {
  const { state: projectState, actions: projectActions } = useProject();
  const { actions: uiActions } = useUI();

  const renderPanel = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <EnhancedErrorBoundary level="panel" component="OverviewPanel">
            <OverviewPanel 
              project={projectState.currentProject} 
              onUpdateProject={projectActions.updateProject}
            />
          </EnhancedErrorBoundary>
        );
      
      case 'characters':
        return (
          <EnhancedErrorBoundary level="panel" component="CharactersPanel">
            <CharactersPanelContainer />
          </EnhancedErrorBoundary>
        );
      
      case 'story':
        return (
          <EnhancedErrorBoundary level="panel" component="StoryArcsPanel">
            <StoryArcsPanelContainer />
          </EnhancedErrorBoundary>
        );
      
      case 'worldbuilding':
        return (
          <EnhancedErrorBoundary level="panel" component="WorldBuildingPanel">
            <WorldBuildingPanel />
          </EnhancedErrorBoundary>
        );
      
      case 'crossrefs':
        return (
          <EnhancedErrorBoundary level="panel" component="CrossReferencesPanel">
            <CrossReferencesPanel project={projectState.currentProject} />
          </EnhancedErrorBoundary>
        );
      
      case 'ai':
        return (
          <EnhancedErrorBoundary level="panel" component="AIPanel">
            <AIPanelContainer />
          </EnhancedErrorBoundary>
        );
      
      case 'prompts':
        return (
          <EnhancedErrorBoundary level="panel" component="PromptsPanel">
            <PromptsPanel />
          </EnhancedErrorBoundary>
        );
      
      default:
        return null;
    }
  };

  return renderPanel();
}