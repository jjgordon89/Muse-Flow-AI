import React, { useState } from 'react';
import { Download, Upload, FileText, FileImage, File, AlertCircle, CheckCircle, X, Settings } from 'lucide-react';
import { ExportImportService, ExportOptions, ImportResult } from '../../services/exportImport';
import { Project } from '../../types';

interface ExportImportPanelProps {
  project: Project;
  onImportProject: (project: Project) => void;
  onClose: () => void;
}

type TabType = 'export' | 'import';

export function ExportImportPanel({ project, onImportProject, onClose }: ExportImportPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('export');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  // Export state
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'markdown',
    includeMetadata: true,
    includeCharacters: true,
    includeStoryArcs: true,
    includeWorldBuilding: true,
    contentOnly: false
  });

  // Import state
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const formatIcons = {
    json: File,
    markdown: FileText,
    docx: FileImage,
    pdf: FileImage,
    txt: FileText
  };

  const formatDescriptions = {
    json: 'Complete project data with all metadata, characters, and story structure',
    markdown: 'Human-readable format perfect for sharing and version control',
    docx: 'Rich text format compatible with Microsoft Word (RTF)',
    pdf: 'Print-ready HTML format that can be converted to PDF',
    txt: 'Plain text format for maximum compatibility'
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus(null);

    try {
      await ExportImportService.exportProject(project, exportOptions);
      setExportStatus({
        type: 'success',
        message: `Project exported successfully as ${exportOptions.format.toUpperCase()}`
      });
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Export failed'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setImportStatus(null);
    setImportWarnings([]);
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setImportStatus(null);
    setImportWarnings([]);

    try {
      const result: ImportResult = await ExportImportService.importProject(selectedFile);
      
      if (result.success && result.project) {
        onImportProject(result.project);
        setImportStatus({
          type: 'success',
          message: 'Project imported successfully!'
        });
        
        if (result.warnings && result.warnings.length > 0) {
          setImportWarnings(result.warnings);
        }
      } else {
        setImportStatus({
          type: 'error',
          message: result.error || 'Import failed'
        });
      }
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Import failed'
      });
    } finally {
      setIsImporting(false);
      setSelectedFile(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <Settings className="w-6 h-6 text-indigo-600" />
            <span>Export & Import</span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Download className="w-4 h-4 inline mr-2" />
            Export Project
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'import'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Import Project
          </button>
        </div>

        <div className="h-[calc(90vh-140px)] overflow-y-auto">
          {activeTab === 'export' ? (
            <ExportTab
              project={project}
              exportOptions={exportOptions}
              setExportOptions={setExportOptions}
              onExport={handleExport}
              isExporting={isExporting}
              exportStatus={exportStatus}
              formatIcons={formatIcons}
              formatDescriptions={formatDescriptions}
            />
          ) : (
            <ImportTab
              onFileSelect={handleFileInput}
              onImport={handleImport}
              isImporting={isImporting}
              importStatus={importStatus}
              importWarnings={importWarnings}
              selectedFile={selectedFile}
              dragActive={dragActive}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface ExportTabProps {
  project: Project;
  exportOptions: ExportOptions;
  setExportOptions: (options: ExportOptions) => void;
  onExport: () => void;
  isExporting: boolean;
  exportStatus: { type: 'success' | 'error'; message: string } | null;
  formatIcons: Record<string, any>;
  formatDescriptions: Record<string, string>;
}

function ExportTab({
  project,
  exportOptions,
  setExportOptions,
  onExport,
  isExporting,
  exportStatus,
  formatIcons,
  formatDescriptions
}: ExportTabProps) {
  const formats = Object.keys(formatIcons) as Array<keyof typeof formatIcons>;

  return (
    <div className="p-6 space-y-6">
      {/* Project Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-2">Project Overview</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Title:</span>
            <span className="ml-2 font-medium">{project.title}</span>
          </div>
          <div>
            <span className="text-gray-500">Word Count:</span>
            <span className="ml-2 font-medium">{project.content.split(' ').filter(w => w.length > 0).length.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Characters:</span>
            <span className="ml-2 font-medium">{project.characters.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Story Arcs:</span>
            <span className="ml-2 font-medium">{project.storyArcs.length}</span>
          </div>
        </div>
      </div>

      {/* Format Selection */}
      <div>
        <h3 className="font-medium text-gray-900 mb-3">Export Format</h3>
        <div className="grid grid-cols-1 gap-3">
          {formats.map((format) => {
            const Icon = formatIcons[format];
            return (
              <label
                key={format}
                className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                  exportOptions.format === format
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={format}
                  checked={exportOptions.format === format}
                  onChange={(e) => setExportOptions({ ...exportOptions, format: e.target.value as any })}
                  className="mt-1"
                />
                <Icon className="w-5 h-5 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 uppercase">{format}</div>
                  <div className="text-sm text-gray-600">{formatDescriptions[format]}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Export Options */}
      <div>
        <h3 className="font-medium text-gray-900 mb-3">Export Options</h3>
        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={exportOptions.includeMetadata}
              onChange={(e) => setExportOptions({ ...exportOptions, includeMetadata: e.target.checked })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Include project metadata (description, genre, word count, dates)</span>
          </label>
          
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={exportOptions.includeCharacters}
              onChange={(e) => setExportOptions({ ...exportOptions, includeCharacters: e.target.checked })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Include character profiles and relationships</span>
          </label>
          
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={exportOptions.includeStoryArcs}
              onChange={(e) => setExportOptions({ ...exportOptions, includeStoryArcs: e.target.checked })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Include story structure (arcs, acts, scenes)</span>
          </label>
          
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={exportOptions.contentOnly}
              onChange={(e) => setExportOptions({ ...exportOptions, contentOnly: e.target.checked })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Content only (exclude all metadata and structure)</span>
          </label>
        </div>
      </div>

      {/* Status Messages */}
      {exportStatus && (
        <div className={`p-4 rounded-lg ${
          exportStatus.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center space-x-2">
            {exportStatus.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className={`text-sm font-medium ${
              exportStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>
              {exportStatus.message}
            </span>
          </div>
        </div>
      )}

      {/* Export Button */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          onClick={onExport}
          disabled={isExporting}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Export Project</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface ImportTabProps {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImport: () => void;
  isImporting: boolean;
  importStatus: { type: 'success' | 'error' | 'warning'; message: string } | null;
  importWarnings: string[];
  selectedFile: File | null;
  dragActive: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function ImportTab({
  onFileSelect,
  onImport,
  isImporting,
  importStatus,
  importWarnings,
  selectedFile,
  dragActive,
  onDragOver,
  onDragLeave,
  onDrop
}: ImportTabProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Import Instructions</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>JSON files:</strong> Complete project import with all data preserved</li>
          <li>• <strong>Markdown files:</strong> Content and basic structure import</li>
          <li>• <strong>Text files:</strong> Content-only import (manual structure recreation needed)</li>
          <li>• Importing will replace your current project</li>
        </ul>
      </div>

      {/* File Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          type="file"
          onChange={onFileSelect}
          accept=".json,.md,.markdown,.txt"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Drop your file here or click to browse
        </h3>
        <p className="text-sm text-gray-600">
          Supported formats: JSON, Markdown (.md), Text (.txt)
        </p>
        
        {selectedFile && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-center space-x-2">
              <File className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">{selectedFile.name}</span>
              <span className="text-xs text-gray-500">
                ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {importStatus && (
        <div className={`p-4 rounded-lg ${
          importStatus.type === 'success' ? 'bg-green-50 border border-green-200' :
          importStatus.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center space-x-2">
            {importStatus.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : importStatus.type === 'warning' ? (
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className={`text-sm font-medium ${
              importStatus.type === 'success' ? 'text-green-800' :
              importStatus.type === 'warning' ? 'text-yellow-800' :
              'text-red-800'
            }`}>
              {importStatus.message}
            </span>
          </div>
        </div>
      )}

      {/* Warnings */}
      {importWarnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">Import Warnings:</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            {importWarnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Import Button */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          onClick={onImport}
          disabled={!selectedFile || isImporting}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          {isImporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Importing...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Import Project</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}