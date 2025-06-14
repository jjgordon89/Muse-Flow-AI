import React from 'react';
import { CharactersPanel } from './CharactersPanel';
import { useProject } from '../../contexts';

export function CharactersPanelContainer() {
  const { state: projectState, actions: projectActions } = useProject();

  return (
    <CharactersPanel
      characters={projectState.currentProject.characters}
      onAddCharacter={projectActions.addCharacter}
      onUpdateCharacter={projectActions.updateCharacter}
      onDeleteCharacter={projectActions.deleteCharacter}
    />
  );
}