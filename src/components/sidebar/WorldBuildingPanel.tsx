import React, { useState } from 'react';
import { Map, Plus, MapPin, Users, Book, Globe } from 'lucide-react';

interface WorldElement {
  id: string;
  name: string;
  type: 'location' | 'culture' | 'organization' | 'lore';
  description: string;
  details: string;
  connections: string[];
  tags: string[];
}

export function WorldBuildingPanel() {
  const [elements, setElements] = useState<WorldElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<WorldElement | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const typeIcons = {
    location: MapPin,
    culture: Users,
    organization: Globe,
    lore: Book,
  };

  const typeColors = {
    location: 'text-green-600 bg-green-100',
    culture: 'text-blue-600 bg-blue-100',
    organization: 'text-purple-600 bg-purple-100',
    lore: 'text-orange-600 bg-orange-100',
  };

  const addElement = (element: Omit<WorldElement, 'id'>) => {
    const newElement = {
      ...element,
      id: Date.now().toString(),
    };
    setElements([...elements, newElement]);
  };

  const updateElement = (id: string, updates: Partial<WorldElement>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const deleteElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id));
  };

  if (isCreating || selectedElement) {
    return (
      <WorldElementForm
        element={selectedElement}
        onSave={(element) => {
          if (selectedElement) {
            updateElement(selectedElement.id, element);
          } else {
            addElement(element);
          }
          setSelectedElement(null);
          setIsCreating(false);
        }}
        onCancel={() => {
          setSelectedElement(null);
          setIsCreating(false);
        }}
        onDelete={selectedElement ? () => {
          deleteElement(selectedElement.id);
          setSelectedElement(null);
        } : undefined}
      />
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Map className="w-5 h-5 text-indigo-600" />
          <span>World Building</span>
        </h3>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </div>

      <div className="space-y-3">
        {elements.map((element) => {
          const TypeIcon = typeIcons[element.type];
          return (
            <div
              key={element.id}
              onClick={() => setSelectedElement(element)}
              className="p-3 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-gray-900">{element.name}</h4>
                <div className={`p-1 rounded-full ${typeColors[element.type]}`}>
                  <TypeIcon className="w-3 h-3" />
                </div>
              </div>
              
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {element.description || 'No description'}
              </p>
              
              {element.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {element.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {element.tags.length > 3 && (
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      +{element.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {elements.length === 0 && (
          <div className="text-center py-8">
            <Map className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No world elements yet</p>
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Start building your world
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface WorldElementFormProps {
  element: WorldElement | null;
  onSave: (element: Omit<WorldElement, 'id'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function WorldElementForm({ element, onSave, onCancel, onDelete }: WorldElementFormProps) {
  const [formData, setFormData] = useState({
    name: element?.name || '',
    type: element?.type || 'location' as const,
    description: element?.description || '',
    details: element?.details || '',
    tags: element?.tags.join(', ') || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      connections: element?.connections || [],
    });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {element ? 'Edit World Element' : 'New World Element'}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="location">Location</option>
            <option value="culture">Culture</option>
            <option value="organization">Organization</option>
            <option value="lore">Lore</option>
          </select>
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
            placeholder="Brief overview..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Details
          </label>
          <textarea
            value={formData.details}
            onChange={(e) => setFormData({ ...formData, details: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Detailed information, history, characteristics..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="fantasy, medieval, important (separate with commas)"
          />
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Save Element
          </button>
        </div>
      </form>
    </div>
  );
}