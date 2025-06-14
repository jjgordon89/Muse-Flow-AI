import React from 'react';
import { WordProcessor } from './WordProcessor';
import { useProject } from '../../contexts';
import { useWordCount } from '../../hooks/useWordCount';

export function WordProcessorContainer() {
  const { state: projectState, actions: projectActions } = useProject();
  const wordCount = useWordCount(projectState.currentProject.content);

  const handleContentChange = (content: string) => {
    projectActions.updateProject({ 
      content,
      currentWordCount: wordCount
    });
  };

  return (
    <WordProcessor
      content={projectState.currentProject.content}
      onChange={handleContentChange}
      targetWordCount={projectState.currentProject.targetWordCount}
      placeholder="Begin your story here... Let your imagination flow onto the page."
    />
  );
}