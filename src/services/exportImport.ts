export interface ExportOptions {
  format: 'json' | 'markdown' | 'docx' | 'pdf' | 'txt';
  includeMetadata?: boolean;
  includeCharacters?: boolean;
  includeStoryArcs?: boolean;
  includeWorldBuilding?: boolean;
  contentOnly?: boolean;
}

export interface ImportResult {
  success: boolean;
  project?: any;
  error?: string;
  warnings?: string[];
}

export class ExportImportService {
  static async exportProject(project: any, options: ExportOptions): Promise<void> {
    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      switch (options.format) {
        case 'json':
          ({ content, filename, mimeType } = this.exportToJSON(project, options));
          break;
        case 'markdown':
          ({ content, filename, mimeType } = this.exportToMarkdown(project, options));
          break;
        case 'docx':
          ({ content, filename, mimeType } = this.exportToDocx(project, options));
          break;
        case 'pdf':
          ({ content, filename, mimeType } = this.exportToPDF(project, options));
          break;
        case 'txt':
          ({ content, filename, mimeType } = this.exportToTxt(project, options));
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      this.downloadFile(content, filename, mimeType);
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async importProject(file: File): Promise<ImportResult> {
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const content = await this.readFile(file);

      switch (fileExtension) {
        case 'json':
          return this.importFromJSON(content);
        case 'md':
        case 'markdown':
          return this.importFromMarkdown(content, file.name);
        case 'txt':
          return this.importFromTxt(content, file.name);
        default:
          return {
            success: false,
            error: `Unsupported file format: ${fileExtension}`
          };
      }
    } catch (error) {
      console.error('Import failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown import error'
      };
    }
  }

  private static exportToJSON(project: any, options: ExportOptions) {
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        exportOptions: options
      },
      project: {
        ...project,
        ...(options.includeMetadata === false && {
          createdAt: undefined,
          updatedAt: undefined
        }),
        ...(options.includeCharacters === false && { characters: [] }),
        ...(options.includeStoryArcs === false && { storyArcs: [] }),
        ...(options.contentOnly && {
          characters: [],
          storyArcs: [],
          description: '',
          genre: ''
        })
      }
    };

    const content = JSON.stringify(exportData, null, 2);
    const filename = `${this.sanitizeFilename(project.title)}.json`;
    const mimeType = 'application/json';

    return { content, filename, mimeType };
  }

  private static exportToMarkdown(project: any, options: ExportOptions) {
    let markdown = '';

    // Title and metadata
    markdown += `# ${project.title}\n\n`;
    
    if (project.description && options.includeMetadata !== false) {
      markdown += `**Description:** ${project.description}\n\n`;
    }
    
    if (project.genre && options.includeMetadata !== false) {
      markdown += `**Genre:** ${project.genre}\n\n`;
    }

    if (options.includeMetadata !== false) {
      markdown += `**Word Count:** ${this.countWords(project.content)}\n`;
      markdown += `**Target:** ${project.targetWordCount.toLocaleString()}\n\n`;
    }

    markdown += '---\n\n';

    // Main content
    if (project.content) {
      markdown += '## Story Content\n\n';
      markdown += project.content + '\n\n';
    }

    // Characters
    if (project.characters.length > 0 && options.includeCharacters !== false) {
      markdown += '## Characters\n\n';
      project.characters.forEach((char: any) => {
        markdown += `### ${char.name}\n`;
        markdown += `**Role:** ${char.role}\n`;
        if (char.age) markdown += `**Age:** ${char.age}\n`;
        if (char.description) markdown += `**Description:** ${char.description}\n`;
        if (char.backstory) markdown += `**Backstory:** ${char.backstory}\n`;
        if (char.traits.length > 0) markdown += `**Traits:** ${char.traits.join(', ')}\n`;
        
        if (char.relationships.length > 0) {
          markdown += `**Relationships:**\n`;
          char.relationships.forEach((rel: any) => {
            const relatedChar = project.characters.find((c: any) => c.id === rel.characterId);
            if (relatedChar) {
              markdown += `- ${rel.relationship} with ${relatedChar.name}`;
              if (rel.description) markdown += `: ${rel.description}`;
              markdown += '\n';
            }
          });
        }
        
        if (char.notes) markdown += `**Notes:** ${char.notes}\n`;
        markdown += '\n';
      });
    }

    // Story Arcs
    if (project.storyArcs.length > 0 && options.includeStoryArcs !== false) {
      markdown += '## Story Structure\n\n';
      project.storyArcs.forEach((arc: any) => {
        markdown += `### ${arc.title} (${arc.type})\n`;
        markdown += `**Status:** ${arc.status}\n`;
        if (arc.description) markdown += `**Description:** ${arc.description}\n`;
        
        if (arc.acts.length > 0) {
          markdown += `**Acts:**\n`;
          arc.acts.forEach((act: any, actIndex: number) => {
            markdown += `#### Act ${actIndex + 1}: ${act.title}\n`;
            if (act.description) markdown += `${act.description}\n`;
            
            if (act.scenes.length > 0) {
              markdown += `**Scenes:**\n`;
              act.scenes.forEach((scene: any, sceneIndex: number) => {
                markdown += `${sceneIndex + 1}. **${scene.title}**`;
                if (scene.location) markdown += ` (${scene.location})`;
                markdown += '\n';
                if (scene.description) markdown += `   ${scene.description}\n`;
                if (scene.characters.length > 0) {
                  const sceneChars = scene.characters.map((id: string) => {
                    const char = project.characters.find((c: any) => c.id === id);
                    return char ? char.name : 'Unknown';
                  }).join(', ');
                  markdown += `   Characters: ${sceneChars}\n`;
                }
              });
            }
            markdown += '\n';
          });
        }
        
        if (arc.notes) markdown += `**Notes:** ${arc.notes}\n`;
        markdown += '\n';
      });
    }

    const content = markdown;
    const filename = `${this.sanitizeFilename(project.title)}.md`;
    const mimeType = 'text/markdown';

    return { content, filename, mimeType };
  }

  private static exportToDocx(project: any, options: ExportOptions) {
    // For DOCX export, we'll create a simplified RTF format that most word processors can read
    let rtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}';
    
    // Title
    rtf += `\\f0\\fs28\\b ${project.title}\\b0\\fs24\\par\\par`;
    
    // Metadata
    if (options.includeMetadata !== false) {
      if (project.description) rtf += `\\b Description:\\b0 ${project.description}\\par`;
      if (project.genre) rtf += `\\b Genre:\\b0 ${project.genre}\\par`;
      rtf += `\\b Word Count:\\b0 ${this.countWords(project.content)}\\par\\par`;
    }

    // Main content
    if (project.content) {
      rtf += `\\b Story Content:\\b0\\par\\par`;
      rtf += project.content.replace(/\n/g, '\\par') + '\\par\\par';
    }

    // Characters
    if (project.characters.length > 0 && options.includeCharacters !== false) {
      rtf += `\\b Characters:\\b0\\par\\par`;
      project.characters.forEach((char: any) => {
        rtf += `\\b ${char.name}\\b0\\par`;
        rtf += `Role: ${char.role}\\par`;
        if (char.description) rtf += `Description: ${char.description}\\par`;
        rtf += '\\par';
      });
    }

    rtf += '}';

    const content = rtf;
    const filename = `${this.sanitizeFilename(project.title)}.rtf`;
    const mimeType = 'application/rtf';

    return { content, filename, mimeType };
  }

  private static exportToPDF(project: any, options: ExportOptions) {
    // For PDF export, we'll create an HTML file that can be printed to PDF
    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${project.title}</title>
    <style>
        body { font-family: 'Times New Roman', serif; max-width: 8.5in; margin: 0 auto; padding: 1in; line-height: 1.6; }
        h1 { font-size: 24pt; margin-bottom: 20pt; }
        h2 { font-size: 18pt; margin-top: 20pt; margin-bottom: 10pt; }
        h3 { font-size: 14pt; margin-top: 15pt; margin-bottom: 8pt; }
        p { margin-bottom: 12pt; text-align: justify; }
        .metadata { font-style: italic; margin-bottom: 20pt; }
        .character { margin-bottom: 15pt; }
        @media print { body { margin: 0; } }
    </style>
</head>
<body>
    <h1>${project.title}</h1>`;

    if (options.includeMetadata !== false) {
      html += '<div class="metadata">';
      if (project.description) html += `<p><strong>Description:</strong> ${project.description}</p>`;
      if (project.genre) html += `<p><strong>Genre:</strong> ${project.genre}</p>`;
      html += `<p><strong>Word Count:</strong> ${this.countWords(project.content)}</p>`;
      html += '</div>';
    }

    if (project.content) {
      html += '<h2>Story Content</h2>';
      html += project.content.split('\n').map(p => `<p>${p}</p>`).join('');
    }

    if (project.characters.length > 0 && options.includeCharacters !== false) {
      html += '<h2>Characters</h2>';
      project.characters.forEach((char: any) => {
        html += `<div class="character">`;
        html += `<h3>${char.name}</h3>`;
        html += `<p><strong>Role:</strong> ${char.role}</p>`;
        if (char.description) html += `<p><strong>Description:</strong> ${char.description}</p>`;
        html += `</div>`;
      });
    }

    html += '</body></html>';

    const content = html;
    const filename = `${this.sanitizeFilename(project.title)}.html`;
    const mimeType = 'text/html';

    return { content, filename, mimeType };
  }

  private static exportToTxt(project: any, options: ExportOptions) {
    let text = '';

    // Title and metadata
    text += `${project.title}\n`;
    text += '='.repeat(project.title.length) + '\n\n';
    
    if (options.includeMetadata !== false) {
      if (project.description) text += `Description: ${project.description}\n`;
      if (project.genre) text += `Genre: ${project.genre}\n`;
      text += `Word Count: ${this.countWords(project.content)}\n\n`;
    }

    // Main content
    if (project.content) {
      text += 'STORY CONTENT\n';
      text += '-'.repeat(13) + '\n\n';
      text += project.content + '\n\n';
    }

    // Characters
    if (project.characters.length > 0 && options.includeCharacters !== false) {
      text += 'CHARACTERS\n';
      text += '-'.repeat(10) + '\n\n';
      project.characters.forEach((char: any) => {
        text += `${char.name} (${char.role})\n`;
        if (char.description) text += `  Description: ${char.description}\n`;
        if (char.backstory) text += `  Backstory: ${char.backstory}\n`;
        text += '\n';
      });
    }

    const content = text;
    const filename = `${this.sanitizeFilename(project.title)}.txt`;
    const mimeType = 'text/plain';

    return { content, filename, mimeType };
  }

  private static importFromJSON(content: string): ImportResult {
    try {
      const data = JSON.parse(content);
      
      // Validate JSON structure
      if (!data.project) {
        return {
          success: false,
          error: 'Invalid project file format. Missing project data.'
        };
      }

      const project = data.project;
      
      // Validate required fields
      if (!project.title || !project.hasOwnProperty('content')) {
        return {
          success: false,
          error: 'Invalid project file. Missing required fields (title, content).'
        };
      }

      // Ensure arrays exist
      project.characters = project.characters || [];
      project.storyArcs = project.storyArcs || [];
      
      // Update timestamps
      project.updatedAt = new Date();
      project.id = Date.now().toString(); // Generate new ID for imported project

      return {
        success: true,
        project,
        warnings: data.metadata?.version !== '1.0.0' ? 
          ['Project was exported from a different version. Some features may not work correctly.'] : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid JSON file format.'
      };
    }
  }

  private static importFromMarkdown(content: string, filename: string): ImportResult {
    try {
      const title = filename.replace(/\.(md|markdown)$/i, '');
      
      // Basic markdown parsing - extract title and content
      const lines = content.split('\n');
      let projectTitle = title;
      let projectContent = '';
      let inContent = false;
      
      for (const line of lines) {
        if (line.startsWith('# ') && !inContent) {
          projectTitle = line.substring(2).trim();
        } else if (line === '## Story Content') {
          inContent = true;
        } else if (inContent && !line.startsWith('##')) {
          projectContent += line + '\n';
        } else if (line.startsWith('##') && inContent) {
          break;
        }
      }

      const project = {
        id: Date.now().toString(),
        title: projectTitle,
        description: '',
        genre: '',
        targetWordCount: 80000,
        currentWordCount: this.countWords(projectContent),
        content: projectContent.trim(),
        characters: [],
        storyArcs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return {
        success: true,
        project,
        warnings: ['Markdown import only preserves basic content. Characters and story structure need to be recreated.']
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to parse markdown file.'
      };
    }
  }

  private static importFromTxt(content: string, filename: string): ImportResult {
    try {
      const title = filename.replace(/\.txt$/i, '');
      
      const project = {
        id: Date.now().toString(),
        title: title,
        description: '',
        genre: '',
        targetWordCount: 80000,
        currentWordCount: this.countWords(content),
        content: content,
        characters: [],
        storyArcs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return {
        success: true,
        project,
        warnings: ['Text import only preserves content. All other project data needs to be created manually.']
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to read text file.'
      };
    }
  }

  private static readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private static downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-z0-9\s\-_]/gi, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
  }

  private static countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}