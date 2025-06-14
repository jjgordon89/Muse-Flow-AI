import React from 'react';
import { Project } from '../../types';
import { useWordCount } from '../../hooks/useWordCount';
import { Target, Users, BookOpen, Calendar } from 'lucide-react';

interface OverviewPanelProps {
  project: Project;
  onUpdateProject: (updates: Partial<Project>) => void;
}

export function OverviewPanel({ project, onUpdateProject }: OverviewPanelProps) {
  const wordCount = useWordCount(project.content);
  const progress = project.targetWordCount > 0 ? (wordCount / project.targetWordCount) * 100 : 0;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Project Overview</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={project.title}
              onChange={(e) => onUpdateProject({ title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter project title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Genre
            </label>
            <input
              type="text"
              value={project.genre}
              onChange={(e) => onUpdateProject({ genre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g., Fantasy, Romance, Mystery..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={project.description}
              onChange={(e) => onUpdateProject({ description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Brief description of your story..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Word Count
            </label>
            <input
              type="number"
              value={project.targetWordCount}
              onChange={(e) => onUpdateProject({ targetWordCount: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="50000"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Progress</h4>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Target className="w-5 h-5 text-indigo-600" />
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">Word Count</span>
                <span className="text-gray-500">
                  {wordCount.toLocaleString()} / {project.targetWordCount.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-green-600" />
            <div>
              <span className="font-medium text-gray-700">Characters</span>
              <p className="text-sm text-gray-500">{project.characters.length} created</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <BookOpen className="w-5 h-5 text-purple-600" />
            <div>
              <span className="font-medium text-gray-700">Story Arcs</span>
              <p className="text-sm text-gray-500">{project.storyArcs.length} planned</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-orange-600" />
            <div>
              <span className="font-medium text-gray-700">Last Updated</span>
              <p className="text-sm text-gray-500">
                {new Date(project.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}