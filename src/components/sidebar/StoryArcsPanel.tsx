import React, { useState } from 'react';
import { StoryArc, StoryAct, Scene, Character } from '../../types';
import { Plus, BookOpen, Play, CheckCircle, Clock, ChevronRight, ChevronDown, Users, MapPin, Edit2, Trash2, GripVertical } from 'lucide-react';

interface StoryArcsPanelProps {
  storyArcs: StoryArc[];
  characters: Character[];
  onAddStoryArc: (arc: Omit<StoryArc, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateStoryArc: (id: string, updates: Partial<StoryArc>) => void;
  onDeleteStoryArc: (id: string) => void;
}

const statusIcons = {
  planning: Clock,
  active: Play,
  completed: CheckCircle,
};

const statusColors = {
  planning: 'text-yellow-600 bg-yellow-100',
  active: 'text-green-600 bg-green-100',
  completed: 'text-blue-600 bg-blue-100',
};

const typeColors = {
  main: 'text-purple-600 bg-purple-100',
  subplot: 'text-indigo-600 bg-indigo-100',
  character: 'text-green-600 bg-green-100',
};

export function StoryArcsPanel({ 
  storyArcs, 
  characters,
  onAddStoryArc, 
  onUpdateStoryArc, 
  onDeleteStoryArc 
}: StoryArcsPanelProps) {
  const [selectedArc, setSelectedArc] = useState<StoryArc | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedArcs, setExpandedArcs] = useState<Set<string>>(new Set());
  const [detailView, setDetailView] = useState<{ arcId: string; actId?: string } | null>(null);

  const toggleArcExpansion = (arcId: string) => {
    const newExpanded = new Set(expandedArcs);
    if (newExpanded.has(arcId)) {
      newExpanded.delete(arcId);
    } else {
      newExpanded.add(arcId);
    }
    setExpandedArcs(newExpanded);
  };

  if (detailView) {
    const arc = storyArcs.find(a => a.id === detailView.arcId);
    if (!arc) return null;
    
    if (detailView.actId) {
      const act = arc.acts.find(a => a.id === detailView.actId);
      if (!act) return null;
      
      return (
        <ActDetailView
          arc={arc}
          act={act}
          characters={characters}
          onUpdateArc={onUpdateStoryArc}
          onBack={() => setDetailView({ arcId: arc.id })}
        />
      );
    }
    
    return (
      <ArcDetailView
        arc={arc}
        characters={characters}
        onUpdateArc={onUpdateStoryArc}
        onViewAct={(actId) => setDetailView({ arcId: arc.id, actId })}
        onBack={() => setDetailView(null)}
      />
    );
  }

  if (isCreating || selectedArc) {
    return (
      <StoryArcForm
        storyArc={selectedArc}
        characters={characters}
        onSave={(arc) => {
          if (selectedArc) {
            onUpdateStoryArc(selectedArc.id, arc);
          } else {
            onAddStoryArc(arc);
          }
          setSelectedArc(null);
          setIsCreating(false);
        }}
        onCancel={() => {
          setSelectedArc(null);
          setIsCreating(false);
        }}
        onDelete={selectedArc ? () => {
          onDeleteStoryArc(selectedArc.id);
          setSelectedArc(null);
        } : undefined}
      />
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Story Arcs</h3>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </div>

      <div className="space-y-3">
        {storyArcs.map((arc) => {
          const StatusIcon = statusIcons[arc.status];
          const isExpanded = expandedArcs.has(arc.id);
          
          return (
            <div key={arc.id} className="bg-white rounded-lg border border-gray-200">
              <div
                className="p-3 hover:border-indigo-300 cursor-pointer transition-colors"
                onClick={() => setDetailView({ arcId: arc.id })}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleArcExpansion(arc.id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    <h4 className="font-medium text-gray-900">{arc.title}</h4>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${typeColors[arc.type]}`}>
                      {arc.type}
                    </div>
                    <div className={`p-1 rounded-full ${statusColors[arc.status]}`}>
                      <StatusIcon className="w-3 h-3" />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedArc(arc);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 line-clamp-2 mb-2 ml-6">
                  {arc.description || 'No description'}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500 ml-6">
                  <span>{arc.acts.length} acts</span>
                  <span>{arc.characters.length} characters</span>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-3 bg-gray-50">
                  <div className="space-y-2">
                    {arc.acts.map((act, index) => (
                      <div
                        key={act.id}
                        className="flex items-center justify-between p-2 bg-white rounded border hover:border-indigo-200 cursor-pointer"
                        onClick={() => setDetailView({ arcId: arc.id, actId: act.id })}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            Act {index + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{act.title}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span>{act.scenes.length} scenes</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    ))}
                    
                    {arc.acts.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-2">
                        No acts defined. Click to add structure.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {storyArcs.length === 0 && (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No story arcs yet</p>
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create your first story arc
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ArcDetailViewProps {
  arc: StoryArc;
  characters: Character[];
  onUpdateArc: (id: string, updates: Partial<StoryArc>) => void;
  onViewAct: (actId: string) => void;
  onBack: () => void;
}

function ArcDetailView({ arc, characters, onUpdateArc, onViewAct, onBack }: ArcDetailViewProps) {
  const addAct = () => {
    const newAct: StoryAct = {
      id: Date.now().toString(),
      title: `Act ${arc.acts.length + 1}`,
      description: '',
      scenes: [],
      order: arc.acts.length
    };
    
    onUpdateArc(arc.id, {
      acts: [...arc.acts, newAct]
    });
  };

  const updateAct = (actId: string, updates: Partial<StoryAct>) => {
    const updatedActs = arc.acts.map(act =>
      act.id === actId ? { ...act, ...updates } : act
    );
    onUpdateArc(arc.id, { acts: updatedActs });
  };

  const deleteAct = (actId: string) => {
    const filteredActs = arc.acts.filter(act => act.id !== actId);
    onUpdateArc(arc.id, { acts: filteredActs });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{arc.title}</h3>
        <button
          onClick={onBack}
          className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Back
        </button>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-700 mb-2">{arc.description}</p>
        <div className="flex items-center space-x-4 text-xs text-gray-500">
          <span className={`px-2 py-1 rounded ${typeColors[arc.type]}`}>
            {arc.type}
          </span>
          <span className={`px-2 py-1 rounded ${statusColors[arc.status]}`}>
            {arc.status}
          </span>
          <span>{arc.characters.length} characters involved</span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h4 className="text-md font-semibold text-gray-900">Acts Structure</h4>
        <button
          onClick={addAct}
          className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Act</span>
        </button>
      </div>

      <div className="space-y-3">
        {arc.acts.map((act, index) => (
          <div key={act.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <GripVertical className="w-4 h-4 text-gray-400" />
                <h5 className="font-medium text-gray-900">Act {index + 1}: {act.title}</h5>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => onViewAct(act.id)}
                  className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteAct(act.id)}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">{act.description || 'No description'}</p>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{act.scenes.length} scenes</span>
              <button
                onClick={() => onViewAct(act.id)}
                className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800"
              >
                <span>Manage scenes</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        {arc.acts.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 mb-4">No acts defined</p>
            <button
              onClick={addAct}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Add First Act
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ActDetailViewProps {
  arc: StoryArc;
  act: StoryAct;
  characters: Character[];
  onUpdateArc: (id: string, updates: Partial<StoryArc>) => void;
  onBack: () => void;
}

function ActDetailView({ arc, act, characters, onUpdateArc, onBack }: ActDetailViewProps) {
  const [editingScene, setEditingScene] = useState<Scene | null>(null);

  const addScene = () => {
    const newScene: Scene = {
      id: Date.now().toString(),
      title: `Scene ${act.scenes.length + 1}`,
      description: '',
      characters: [],
      location: '',
      notes: '',
      order: act.scenes.length
    };

    const updatedAct = {
      ...act,
      scenes: [...act.scenes, newScene]
    };

    const updatedActs = arc.acts.map(a => a.id === act.id ? updatedAct : a);
    onUpdateArc(arc.id, { acts: updatedActs });
  };

  const updateScene = (sceneId: string, updates: Partial<Scene>) => {
    const updatedScenes = act.scenes.map(scene =>
      scene.id === sceneId ? { ...scene, ...updates } : scene
    );

    const updatedAct = { ...act, scenes: updatedScenes };
    const updatedActs = arc.acts.map(a => a.id === act.id ? updatedAct : a);
    onUpdateArc(arc.id, { acts: updatedActs });
  };

  const deleteScene = (sceneId: string) => {
    const filteredScenes = act.scenes.filter(scene => scene.id !== sceneId);
    const updatedAct = { ...act, scenes: filteredScenes };
    const updatedActs = arc.acts.map(a => a.id === act.id ? updatedAct : a);
    onUpdateArc(arc.id, { acts: updatedActs });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{act.title}</h3>
        <button
          onClick={onBack}
          className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Back to Arc
        </button>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-700">{act.description}</p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h4 className="text-md font-semibold text-gray-900">Scenes</h4>
        <button
          onClick={addScene}
          className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Scene</span>
        </button>
      </div>

      <div className="space-y-3">
        {act.scenes.map((scene, index) => (
          <div key={scene.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <GripVertical className="w-4 h-4 text-gray-400" />
                <h5 className="font-medium text-gray-900">Scene {index + 1}: {scene.title}</h5>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => setEditingScene(scene)}
                  className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteScene(scene.id)}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">{scene.description || 'No description'}</p>
            
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <MapPin className="w-3 h-3" />
                <span>{scene.location || 'No location'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="w-3 h-3" />
                <span>{scene.characters.length} characters</span>
              </div>
            </div>
          </div>
        ))}

        {act.scenes.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <Play className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 mb-4">No scenes defined</p>
            <button
              onClick={addScene}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Add First Scene
            </button>
          </div>
        )}
      </div>

      {editingScene && (
        <SceneEditor
          scene={editingScene}
          characters={characters}
          onSave={(updates) => {
            updateScene(editingScene.id, updates);
            setEditingScene(null);
          }}
          onCancel={() => setEditingScene(null)}
        />
      )}
    </div>
  );
}

interface SceneEditorProps {
  scene: Scene;
  characters: Character[];
  onSave: (updates: Partial<Scene>) => void;
  onCancel: () => void;
}

function SceneEditor({ scene, characters, onSave, onCancel }: SceneEditorProps) {
  const [formData, setFormData] = useState({
    title: scene.title,
    description: scene.description,
    location: scene.location,
    characters: scene.characters,
    notes: scene.notes,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const toggleCharacter = (characterId: string) => {
    const updated = formData.characters.includes(characterId)
      ? formData.characters.filter(id => id !== characterId)
      : [...formData.characters, characterId];
    setFormData({ ...formData, characters: updated });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Edit Scene</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Where does this scene take place?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="What happens in this scene?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Characters in Scene</label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {characters.map(character => (
                <label key={character.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.characters.includes(character.id)}
                    onChange={() => toggleCharacter(character.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">{character.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Additional notes about this scene..."
            />
          </div>
        </form>

        <div className="flex justify-end space-x-3 p-4 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Save Scene
          </button>
        </div>
      </div>
    </div>
  );
}

interface StoryArcFormProps {
  storyArc: StoryArc | null;
  characters: Character[];
  onSave: (arc: Omit<StoryArc, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function StoryArcForm({ storyArc, characters, onSave, onCancel, onDelete }: StoryArcFormProps) {
  const [formData, setFormData] = useState({
    title: storyArc?.title || '',
    type: storyArc?.type || 'subplot' as const,
    description: storyArc?.description || '',
    status: storyArc?.status || 'planning' as const,
    notes: storyArc?.notes || '',
    characters: storyArc?.characters || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      acts: storyArc?.acts || [],
    });
  };

  const toggleCharacter = (characterId: string) => {
    const updated = formData.characters.includes(characterId)
      ? formData.characters.filter(id => id !== characterId)
      : [...formData.characters, characterId];
    setFormData({ ...formData, characters: updated });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {storyArc ? 'Edit Story Arc' : 'New Story Arc'}
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
            Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="main">Main Plot</option>
              <option value="subplot">Subplot</option>
              <option value="character">Character Arc</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Describe the arc's purpose, conflicts, and resolution..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Involved Characters
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-3">
            {characters.map(character => (
              <label key={character.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.characters.includes(character.id)}
                  onChange={() => toggleCharacter(character.id)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{character.name}</span>
              </label>
            ))}
            {characters.length === 0 && (
              <p className="text-sm text-gray-500 col-span-2">No characters created yet</p>
            )}
          </div>
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
            placeholder="Additional notes, ideas, connections..."
          />
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Save Story Arc
          </button>
        </div>
      </form>
    </div>
  );
}