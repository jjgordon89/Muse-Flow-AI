import React, { useState } from 'react';
import { AIPrompt } from '../../types';
import { Plus, Star, Copy, Edit2, Trash2, Sparkles } from 'lucide-react';

const defaultPrompts: AIPrompt[] = [
  {
    id: '1',
    title: 'Character Backstory',
    prompt: 'Create a detailed backstory for a character named [CHARACTER_NAME] who is a [ROLE] in a [GENRE] story. Include their childhood, formative experiences, and what drives them.',
    category: 'character',
    isFavorite: false,
  },
  {
    id: '2',
    title: 'Plot Twist Generator',
    prompt: 'Generate 3 unexpected plot twists for a story about [BRIEF_DESCRIPTION]. Each twist should change the reader\'s understanding of previous events.',
    category: 'plot',
    isFavorite: true,
  },
  {
    id: '3',
    title: 'Dialogue Enhancement',
    prompt: 'Rewrite this dialogue to make it more natural and character-specific: [DIALOGUE]. Consider the characters\' backgrounds, relationships, and emotional states.',
    category: 'dialogue',
    isFavorite: false,
  },
  {
    id: '4',
    title: 'Setting Description',
    prompt: 'Write a vivid description of [LOCATION] that includes sensory details, atmosphere, and hints about the story\'s mood. Make it feel alive and specific to the genre.',
    category: 'description',
    isFavorite: false,
  },
];

export function PromptsPanel() {
  const [prompts, setPrompts] = useState<AIPrompt[]>(defaultPrompts);
  const [selectedPrompt, setSelectedPrompt] = useState<AIPrompt | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const categories = ['all', 'character', 'plot', 'dialogue', 'description', 'custom'];

  const addPrompt = (prompt: Omit<AIPrompt, 'id'>) => {
    const newPrompt = {
      ...prompt,
      id: Date.now().toString(),
    };
    setPrompts([...prompts, newPrompt]);
  };

  const updatePrompt = (id: string, updates: Partial<AIPrompt>) => {
    setPrompts(prompts.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePrompt = (id: string) => {
    setPrompts(prompts.filter(p => p.id !== id));
  };

  const toggleFavorite = (id: string) => {
    updatePrompt(id, { isFavorite: !prompts.find(p => p.id === id)?.isFavorite });
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
  };

  const filteredPrompts = prompts.filter(prompt => 
    filterCategory === 'all' || prompt.category === filterCategory
  );

  if (isCreating || selectedPrompt) {
    return (
      <PromptForm
        prompt={selectedPrompt}
        onSave={(prompt) => {
          if (selectedPrompt) {
            updatePrompt(selectedPrompt.id, prompt);
          } else {
            addPrompt(prompt);
          }
          setSelectedPrompt(null);
          setIsCreating(false);
        }}
        onCancel={() => {
          setSelectedPrompt(null);
          setIsCreating(false);
        }}
        onDelete={selectedPrompt ? () => {
          deletePrompt(selectedPrompt.id);
          setSelectedPrompt(null);
        } : undefined}
      />
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <span>Prompt Library</span>
        </h3>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </div>

      {/* Category Filter */}
      <div className="mb-4">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="all">All Categories</option>
          <option value="character">Character</option>
          <option value="plot">Plot</option>
          <option value="dialogue">Dialogue</option>
          <option value="description">Description</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div className="space-y-3">
        {filteredPrompts.map((prompt) => (
          <div
            key={prompt.id}
            className="p-3 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-medium text-gray-900 flex items-center space-x-2">
                <span>{prompt.title}</span>
                {prompt.isFavorite && (
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                )}
              </h4>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => toggleFavorite(prompt.id)}
                  className={`p-1 rounded ${
                    prompt.isFavorite ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
                  }`}
                >
                  <Star className="w-4 h-4" />
                </button>
                <button
                  onClick={() => copyPrompt(prompt.prompt)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedPrompt(prompt)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 line-clamp-3 mb-2">
              {prompt.prompt}
            </p>
            
            <div className="flex items-center justify-between">
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded capitalize">
                {prompt.category}
              </span>
            </div>
          </div>
        ))}

        {filteredPrompts.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No prompts in this category</p>
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create your first prompt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface PromptFormProps {
  prompt: AIPrompt | null;
  onSave: (prompt: Omit<AIPrompt, 'id'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function PromptForm({ prompt, onSave, onCancel, onDelete }: PromptFormProps) {
  const [formData, setFormData] = useState({
    title: prompt?.title || '',
    prompt: prompt?.prompt || '',
    category: prompt?.category || 'custom' as const,
    isFavorite: prompt?.isFavorite || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {prompt ? 'Edit Prompt' : 'New Prompt'}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="character">Character</option>
            <option value="plot">Plot</option>
            <option value="dialogue">Dialogue</option>
            <option value="description">Description</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Prompt
          </label>
          <textarea
            value={formData.prompt}
            onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Enter your prompt here. Use [PLACEHOLDERS] for dynamic content..."
            required
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="favorite"
            checked={formData.isFavorite}
            onChange={(e) => setFormData({ ...formData, isFavorite: e.target.checked })}
            className="mr-2"
          />
          <label htmlFor="favorite" className="text-sm text-gray-700">
            Mark as favorite
          </label>
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Save Prompt
          </button>
        </div>
      </form>
    </div>
  );
}