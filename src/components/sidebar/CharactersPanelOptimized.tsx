import React, { useState, useCallback, useMemo } from 'react';
import { Character, CharacterRelationship } from '../../types';
import { Plus, Edit2, Users, Heart, Sword, User, Link, Trash2, ArrowRight, Search } from 'lucide-react';
import { VirtualList, VirtualListItem } from '../common/VirtualList';
import { ErrorBoundary } from '../common/ErrorBoundary';

interface CharactersPanelProps {
  characters: Character[];
  onAddCharacter: (character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateCharacter: (id: string, updates: Partial<Character>) => void;
  onDeleteCharacter: (id: string) => void;
}

const roleIcons = {
  protagonist: Heart,
  antagonist: Sword,
  supporting: Users,
  minor: User,
};

const roleColors = {
  protagonist: 'text-red-600 bg-red-100',
  antagonist: 'text-gray-900 bg-gray-100',
  supporting: 'text-blue-600 bg-blue-100',
  minor: 'text-gray-600 bg-gray-50',
};

// Memoized character card component
const CharacterCard = React.memo<{
  character: Character;
  onClick: () => void;
}>(({ character, onClick }) => {
  const RoleIcon = roleIcons[character.role];
  
  return (
    <VirtualListItem onClick={onClick}>
      <div className="flex-1">
        <div className="flex items-center space-x-2 mb-2">
          <h4 className="font-medium text-gray-900">{character.name}</h4>
          <div className={`p-1 rounded-full ${roleColors[character.role]}`}>
            <RoleIcon className="w-3 h-3" />
          </div>
          {character.relationships.length > 0 && (
            <div className="flex items-center space-x-1">
              <Link className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500">{character.relationships.length}</span>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-600 line-clamp-2">
          {character.description || 'No description'}
        </p>
        {character.traits.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {character.traits.slice(0, 3).map((trait, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
              >
                {trait}
              </span>
            ))}
            {character.traits.length > 3 && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                +{character.traits.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
      <Edit2 className="w-4 h-4 text-gray-400 ml-2" />
    </VirtualListItem>
  );
});

CharacterCard.displayName = 'CharacterCard';

export const CharactersPanel = React.memo<CharactersPanelProps>(({ 
  characters, 
  onAddCharacter, 
  onUpdateCharacter, 
  onDeleteCharacter 
}) => {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showRelationships, setShowRelationships] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Memoized filtered characters
  const filteredCharacters = useMemo(() => {
    if (!searchTerm) return characters;
    
    const term = searchTerm.toLowerCase();
    return characters.filter(character =>
      character.name.toLowerCase().includes(term) ||
      character.description.toLowerCase().includes(term) ||
      character.traits.some(trait => trait.toLowerCase().includes(term))
    );
  }, [characters, searchTerm]);

  const handleCreateCharacter = useCallback(() => {
    const newCharacter = {
      name: 'New Character',
      role: 'supporting' as const,
      description: '',
      backstory: '',
      traits: [],
      relationships: [],
      notes: '',
    };
    onAddCharacter(newCharacter);
    setIsCreating(false);
  }, [onAddCharacter]);

  const handleCharacterClick = useCallback((character: Character) => {
    setSelectedCharacter(character);
  }, []);

  const renderCharacterItem = useCallback((character: Character, index: number) => (
    <CharacterCard
      key={character.id}
      character={character}
      onClick={() => handleCharacterClick(character)}
    />
  ), [handleCharacterClick]);

  const keyExtractor = useCallback((character: Character) => character.id, []);

  if (showRelationships) {
    return (
      <ErrorBoundary level="panel">
        <RelationshipMapView
          characters={characters}
          onUpdateCharacter={onUpdateCharacter}
          onBack={() => setShowRelationships(false)}
        />
      </ErrorBoundary>
    );
  }

  if (isCreating || selectedCharacter) {
    return (
      <ErrorBoundary level="panel">
        <CharacterForm
          character={selectedCharacter}
          allCharacters={characters}
          onSave={(character) => {
            if (selectedCharacter) {
              onUpdateCharacter(selectedCharacter.id, character);
            } else {
              onAddCharacter(character);
            }
            setSelectedCharacter(null);
            setIsCreating(false);
          }}
          onCancel={() => {
            setSelectedCharacter(null);
            setIsCreating(false);
          }}
          onDelete={selectedCharacter ? () => {
            onDeleteCharacter(selectedCharacter.id);
            setSelectedCharacter(null);
          } : undefined}
          onUpdateCharacter={onUpdateCharacter}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary level="panel">
      <div className="p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Characters</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowRelationships(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Link className="w-4 h-4" />
              <span>Map</span>
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search characters..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Character List */}
        <div className="flex-1">
          {filteredCharacters.length > 0 ? (
            <VirtualList
              items={filteredCharacters}
              itemHeight={100}
              containerHeight={400}
              renderItem={renderCharacterItem}
              keyExtractor={keyExtractor}
              className="border border-gray-200 rounded-lg"
            />
          ) : characters.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No characters yet</p>
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create your first character
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No characters match your search</p>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
});

CharactersPanel.displayName = 'CharactersPanel';

// Keep existing helper components but wrap them with error boundaries
const RelationshipMapView = React.memo<{
  characters: Character[];
  onUpdateCharacter: (id: string, updates: Partial<Character>) => void;
  onBack: () => void;
}>(({ characters, onUpdateCharacter, onBack }) => {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Link className="w-5 h-5 text-purple-600" />
          <span>Character Relationships</span>
        </h3>
        <button
          onClick={onBack}
          className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Back
        </button>
      </div>

      <div className="space-y-4">
        {characters.map((character) => (
          <div key={character.id} className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">{character.name}</h4>
              <button
                onClick={() => setSelectedCharacter(character)}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                Edit Relationships
              </button>
            </div>
            
            {character.relationships.length > 0 ? (
              <div className="space-y-2">
                {character.relationships.map((rel, index) => {
                  const relatedCharacter = characters.find(c => c.id === rel.characterId);
                  return (
                    <div key={index} className="flex items-center space-x-2 text-sm">
                      <span className="text-gray-600">{character.name}</span>
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-900">{relatedCharacter?.name || 'Unknown'}</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        {rel.relationship}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No relationships defined</p>
            )}
          </div>
        ))}
      </div>

      {selectedCharacter && (
        <RelationshipEditor
          character={selectedCharacter}
          allCharacters={characters}
          onSave={(relationships) => {
            onUpdateCharacter(selectedCharacter.id, { relationships });
            setSelectedCharacter(null);
          }}
          onCancel={() => setSelectedCharacter(null)}
        />
      )}
    </div>
  );
});

RelationshipMapView.displayName = 'RelationshipMapView';

// Keep other components but add error boundaries and memoization
const RelationshipEditor = React.memo<{
  character: Character;
  allCharacters: Character[];
  onSave: (relationships: CharacterRelationship[]) => void;
  onCancel: () => void;
}>(({ character, allCharacters, onSave, onCancel }) => {
  const [relationships, setRelationships] = useState<CharacterRelationship[]>([...character.relationships]);

  const addRelationship = useCallback(() => {
    const availableCharacters = allCharacters.filter(
      c => c.id !== character.id && !relationships.some(r => r.characterId === c.id)
    );
    
    if (availableCharacters.length > 0) {
      setRelationships([
        ...relationships,
        {
          characterId: availableCharacters[0].id,
          relationship: '',
          description: ''
        }
      ]);
    }
  }, [allCharacters, character.id, relationships]);

  const updateRelationship = useCallback((index: number, updates: Partial<CharacterRelationship>) => {
    const updated = [...relationships];
    updated[index] = { ...updated[index], ...updates };
    setRelationships(updated);
  }, [relationships]);

  const removeRelationship = useCallback((index: number) => {
    setRelationships(relationships.filter((_, i) => i !== index));
  }, [relationships]);

  return (
    <ErrorBoundary level="component">
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold">Edit Relationships for {character.name}</h3>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">×</button>
          </div>

          <div className="p-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-4">
              {relationships.map((rel, index) => {
                const relatedCharacter = allCharacters.find(c => c.id === rel.characterId);
                return (
                  <div key={index} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <select
                        value={rel.characterId}
                        onChange={(e) => updateRelationship(index, { characterId: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mr-2"
                      >
                        {allCharacters
                          .filter(c => c.id !== character.id)
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </select>
                      <button
                        onClick={() => removeRelationship(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <input
                      type="text"
                      value={rel.relationship}
                      onChange={(e) => updateRelationship(index, { relationship: e.target.value })}
                      placeholder="Relationship type (e.g., friend, enemy, sibling)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-2"
                    />
                    
                    <textarea
                      value={rel.description}
                      onChange={(e) => updateRelationship(index, { description: e.target.value })}
                      placeholder="Describe their relationship..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                );
              })}
              
              <button
                onClick={addRelationship}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                + Add Relationship
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-3 p-4 border-t">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(relationships)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Save Relationships
            </button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
});

RelationshipEditor.displayName = 'RelationshipEditor';

// Character form component with error boundary and optimization
const CharacterForm = React.memo<{
  character: Character | null;
  allCharacters: Character[];
  onSave: (character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onUpdateCharacter: (id: string, updates: Partial<Character>) => void;
}>(({ character, allCharacters, onSave, onCancel, onDelete }) => {
  const [formData, setFormData] = useState({
    name: character?.name || '',
    role: character?.role || 'supporting' as const,
    age: character?.age || undefined,
    description: character?.description || '',
    backstory: character?.backstory || '',
    traits: character?.traits.join(', ') || '',
    notes: character?.notes || '',
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      traits: formData.traits.split(',').map(t => t.trim()).filter(Boolean),
      relationships: character?.relationships || [],
    });
  }, [formData, onSave, character?.relationships]);

  return (
    <ErrorBoundary level="panel">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {character ? 'Edit Character' : 'New Character'}
          </h3>
          <div className="flex space-x-2">
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
              >
                Delete
              </button>
            )}
            <button
              onClick={onCancel}
              className="px-3 py-1 text-gray-600 hover:bg-gray-50 rounded"
            >
              Cancel
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="protagonist">Protagonist</option>
                <option value="antagonist">Antagonist</option>
                <option value="supporting">Supporting</option>
                <option value="minor">Minor</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age
              </label>
              <input
                type="number"
                value={formData.age || ''}
                onChange={(e) => setFormData({ ...formData, age: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Physical appearance, personality overview..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Backstory
            </label>
            <textarea
              value={formData.backstory}
              onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Character history, motivations, key events..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Traits
            </label>
            <input
              type="text"
              value={formData.traits}
              onChange={(e) => setFormData({ ...formData, traits: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="brave, stubborn, witty (separate with commas)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Additional notes, development ideas..."
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Save Character
            </button>
          </div>
        </form>
      </div>
    </ErrorBoundary>
  );
});

CharacterForm.displayName = 'CharacterForm';