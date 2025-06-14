import React, { useState } from 'react';
import { Link, Users, BookOpen, Map, Search, Filter, ArrowRight, Tag } from 'lucide-react';
import { Character, StoryArc, Project } from '../../types';

interface CrossReferencesPanelProps {
  project: Project;
}

interface CrossReference {
  type: 'character-arc' | 'character-character' | 'arc-worldelement';
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  relationship: string;
  description?: string;
}

export function CrossReferencesPanel({ project }: CrossReferencesPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedElement, setSelectedElement] = useState<{type: string; id: string} | null>(null);

  // Generate cross-references from project data
  const generateCrossReferences = (): CrossReference[] => {
    const refs: CrossReference[] = [];

    // Character to Character relationships
    project.characters.forEach(character => {
      character.relationships.forEach(rel => {
        const targetCharacter = project.characters.find(c => c.id === rel.characterId);
        if (targetCharacter) {
          refs.push({
            type: 'character-character',
            sourceId: character.id,
            targetId: targetCharacter.id,
            sourceName: character.name,
            targetName: targetCharacter.name,
            relationship: rel.relationship,
            description: rel.description
          });
        }
      });
    });

    // Character to Story Arc connections
    project.storyArcs.forEach(arc => {
      arc.characters.forEach(characterId => {
        const character = project.characters.find(c => c.id === characterId);
        if (character) {
          refs.push({
            type: 'character-arc',
            sourceId: character.id,
            targetId: arc.id,
            sourceName: character.name,
            targetName: arc.title,
            relationship: 'involved in',
            description: `${character.name} is involved in the ${arc.type} "${arc.title}"`
          });
        }
      });
    });

    // Scene to Character connections
    project.storyArcs.forEach(arc => {
      arc.acts.forEach(act => {
        act.scenes.forEach(scene => {
          scene.characters.forEach(characterId => {
            const character = project.characters.find(c => c.id === characterId);
            if (character) {
              refs.push({
                type: 'character-arc',
                sourceId: character.id,
                targetId: scene.id,
                sourceName: character.name,
                targetName: `${scene.title} (${arc.title})`,
                relationship: 'appears in scene',
                description: `${character.name} appears in scene "${scene.title}"`
              });
            }
          });
        });
      });
    });

    return refs;
  };

  const crossReferences = generateCrossReferences();

  // Filter cross-references
  const filteredReferences = crossReferences.filter(ref => {
    const matchesSearch = searchTerm === '' || 
      ref.sourceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ref.targetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ref.relationship.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || ref.type === filterType;
    
    return matchesSearch && matchesFilter;
  });

  // Get element details for selected element
  const getElementConnections = (elementType: string, elementId: string) => {
    return crossReferences.filter(ref => 
      (ref.sourceId === elementId) || (ref.targetId === elementId)
    );
  };

  const getElementsByType = () => {
    const elements = [
      ...project.characters.map(c => ({ type: 'character', id: c.id, name: c.name, description: c.description })),
      ...project.storyArcs.map(a => ({ type: 'arc', id: a.id, name: a.title, description: a.description }))
    ];
    
    // Add scenes as elements
    project.storyArcs.forEach(arc => {
      arc.acts.forEach(act => {
        act.scenes.forEach(scene => {
          elements.push({
            type: 'scene',
            id: scene.id,
            name: `${scene.title} (${arc.title})`,
            description: scene.description
          });
        });
      });
    });

    return elements;
  };

  const getConnectionStrength = (elementId: string) => {
    return crossReferences.filter(ref => 
      ref.sourceId === elementId || ref.targetId === elementId
    ).length;
  };

  if (selectedElement) {
    const element = getElementsByType().find(e => e.id === selectedElement.id);
    const connections = getElementConnections(selectedElement.type, selectedElement.id);
    
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Link className="w-5 h-5 text-indigo-600" />
            <span>Connections</span>
          </h3>
          <button
            onClick={() => setSelectedElement(null)}
            className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Back
          </button>
        </div>

        {element && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">{element.name}</h4>
            <p className="text-sm text-gray-600">{element.description || 'No description'}</p>
            <div className="mt-2">
              <span className={`px-2 py-1 text-xs rounded ${
                element.type === 'character' ? 'bg-green-100 text-green-800' :
                element.type === 'arc' ? 'bg-blue-100 text-blue-800' :
                'bg-purple-100 text-purple-800'
              }`}>
                {element.type}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h5 className="font-medium text-gray-900">Connected Elements ({connections.length})</h5>
          
          {connections.map((ref, index) => {
            const isSource = ref.sourceId === selectedElement.id;
            const connectedElement = getElementsByType().find(e => 
              e.id === (isSource ? ref.targetId : ref.sourceId)
            );
            
            return (
              <div key={index} className="p-3 bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {isSource ? ref.targetName : ref.sourceName}
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                    {ref.relationship}
                  </span>
                </div>
                {ref.description && (
                  <p className="text-sm text-gray-600">{ref.description}</p>
                )}
              </div>
            );
          })}
          
          {connections.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No connections found for this element
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Link className="w-5 h-5 text-indigo-600" />
          <span>Cross References</span>
        </h3>
      </div>

      {/* Search and Filter */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search connections..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">All Connections</option>
            <option value="character-character">Character Relationships</option>
            <option value="character-arc">Character-Story Connections</option>
          </select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 p-3 rounded-lg text-center">
          <div className="text-lg font-semibold text-green-800">{project.characters.length}</div>
          <div className="text-xs text-green-600">Characters</div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <div className="text-lg font-semibold text-blue-800">{project.storyArcs.length}</div>
          <div className="text-xs text-blue-600">Story Arcs</div>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg text-center">
          <div className="text-lg font-semibold text-purple-800">{crossReferences.length}</div>
          <div className="text-xs text-purple-600">Connections</div>
        </div>
      </div>

      {/* Element Network View */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 mb-3">Element Network</h4>
        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
          {getElementsByType().map(element => {
            const connectionCount = getConnectionStrength(element.id);
            return (
              <button
                key={`${element.type}-${element.id}`}
                onClick={() => setSelectedElement({ type: element.type, id: element.id })}
                className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded hover:border-indigo-300 transition-colors text-left"
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    element.type === 'character' ? 'bg-green-500' :
                    element.type === 'arc' ? 'bg-blue-500' :
                    'bg-purple-500'
                  }`} />
                  <span className="text-sm font-medium text-gray-900">{element.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`px-2 py-1 text-xs rounded ${
                    connectionCount > 5 ? 'bg-red-100 text-red-800' :
                    connectionCount > 2 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {connectionCount}
                  </div>
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Connection List */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">All Connections ({filteredReferences.length})</h4>
        
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredReferences.map((ref, index) => (
            <div key={index} className="p-3 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium text-gray-900">{ref.sourceName}</span>
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">{ref.targetName}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Tag className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-600">{ref.relationship}</span>
                <span className={`px-2 py-1 text-xs rounded ${
                  ref.type === 'character-character' ? 'bg-green-100 text-green-800' :
                  ref.type === 'character-arc' ? 'bg-blue-100 text-blue-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {ref.type.replace('-', ' → ')}
                </span>
              </div>
              
              {ref.description && (
                <p className="text-xs text-gray-500 mt-1">{ref.description}</p>
              )}
            </div>
          ))}
          
          {filteredReferences.length === 0 && (
            <div className="text-center py-8">
              <Link className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 mb-2">No connections found</p>
              <p className="text-sm text-gray-400">
                {searchTerm || filterType !== 'all' 
                  ? 'Try adjusting your search or filter'
                  : 'Start creating characters and story arcs to see connections'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}