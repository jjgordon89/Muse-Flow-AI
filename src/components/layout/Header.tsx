import React from 'react';
import { PenTool, Save, Settings, FileText, Download } from 'lucide-react';

interface HeaderProps {
  currentProject: string;
  onSave: () => void;
  onSettings: () => void;
  onNewProject: () => void;
  onExportImport: () => void;
  isSaving?: boolean;
}

export function Header({ 
  currentProject, 
  onSave, 
  onSettings, 
  onNewProject,
  onExportImport,
  isSaving = false 
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <PenTool className="w-8 h-8 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">AI Fiction Writer</h1>
        </div>
        <div className="h-6 w-px bg-gray-300" />
        <span className="text-sm text-gray-600">
          {currentProject || 'Untitled Project'}
        </span>
      </div>
      
      <div className="flex items-center space-x-3">
        <button
          onClick={onNewProject}
          className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <FileText className="w-4 h-4" />
          <span>New Project</span>
        </button>

        <button
          onClick={onExportImport}
          className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export/Import</span>
        </button>
        
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save'}</span>
        </button>
        
        <button
          onClick={onSettings}
          className="flex items-center justify-center w-10 h-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}