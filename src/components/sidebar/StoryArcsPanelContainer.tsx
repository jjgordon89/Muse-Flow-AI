import React from 'react';
import { StoryArcsPanel } from './StoryArcsPanel';
import { useProject } from '../../contexts';

export function StoryArcsPanelContainer() {
  const { state: projectState, actions: projectActions } = useProject();

  return (
    <StoryArcsPanel
      storyArcs={projectState.currentProject.storyArcs}
      characters={projectState.currentProject.characters}
      onAddStoryArc={projectActions.addStoryArc}
      onUpdateStoryArc={projectActions.updateStoryArc}
      onDeleteStoryArc={projectActions.deleteStoryArc}
    />
  );
}