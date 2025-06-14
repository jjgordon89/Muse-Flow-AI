import { 
  SyncManagerInterface,
  SQLiteManagerInterface,
  LanceDBManagerInterface,
  VectorEmbedding,
  ContentBlockRecord,
  CharacterRecord,
  SyncError
} from '../types/database-types';

export interface EmbeddingGenerator {
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
}

export class SyncManager implements SyncManagerInterface {
  private sqliteManager: SQLiteManagerInterface;
  private lancedbManager: LanceDBManagerInterface;
  private embeddingGenerator: EmbeddingGenerator;
  private syncInProgress = false;
  private lastSyncTime: Date | null = null;

  constructor(
    sqliteManager: SQLiteManagerInterface,
    lancedbManager: LanceDBManagerInterface,
    embeddingGenerator: EmbeddingGenerator
  ) {
    this.sqliteManager = sqliteManager;
    this.lancedbManager = lancedbManager;
    this.embeddingGenerator = embeddingGenerator;
  }

  async syncContentToVector(contentId: string, contentType: string): Promise<void> {
    if (this.syncInProgress) {
      console.warn('Sync already in progress, skipping');
      return;
    }

    try {
      this.syncInProgress = true;

      // Get content from SQLite
      const content = await this.getContentFromSQLite(contentId, contentType);
      if (!content) {
        throw new SyncError(`Content not found: ${contentId}`);
      }

      // Generate embedding
      const embeddings = await this.embeddingGenerator.generateEmbeddings([content.text]);
      const embedding = embeddings[0];

      if (!embedding || embedding.length !== this.embeddingGenerator.getDimensions()) {
        throw new SyncError('Failed to generate valid embedding');
      }

      // Create vector embedding record
      const vectorEmbedding: VectorEmbedding = {
        id: this.generateEmbeddingId(contentId, contentType),
        project_id: content.project_id,
        content_type: this.mapContentType(contentType),
        content_id: contentId,
        content_text: content.text,
        embedding_vector: embedding,
        metadata: {
          word_count: this.countWords(content.text),
          timestamp: new Date().toISOString(),
          ...content.metadata
        },
        created_at: new Date().toISOString()
      };

      // Check if embedding already exists
      const existingEmbedding = await this.lancedbManager.getEmbedding(vectorEmbedding.id);
      
      if (existingEmbedding) {
        // Update existing embedding
        await this.lancedbManager.updateEmbedding(vectorEmbedding.id, vectorEmbedding);
      } else {
        // Insert new embedding
        await this.lancedbManager.insertEmbeddings([vectorEmbedding]);
      }

      console.log(`Synced content to vector database: ${contentId}`);

    } catch (error) {
      console.error('Failed to sync content to vector:', error);
      throw new SyncError('Content sync failed', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncProjectEmbeddings(projectId: string): Promise<void> {
    if (this.syncInProgress) {
      console.warn('Sync already in progress, skipping');
      return;
    }

    try {
      this.syncInProgress = true;
      console.log(`Starting project embedding sync: ${projectId}`);

      // Get all content that needs embeddings
      const contentItems = await this.getAllProjectContent(projectId);
      
      if (contentItems.length === 0) {
        console.log('No content to sync');
        return;
      }

      // Process in batches to avoid overwhelming the embedding service
      const batchSize = 10;
      const batches = this.chunkArray(contentItems, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        if (!batch) continue;
        
        console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} items)`);

        // Generate embeddings for the batch
        const texts = batch.map(item => item.text);
        const embeddings = await this.embeddingGenerator.generateEmbeddings(texts);

        // Create vector embedding records
        const vectorEmbeddings: VectorEmbedding[] = batch.map((item, index) => ({
          id: this.generateEmbeddingId(item.id, item.type),
          project_id: projectId,
          content_type: this.mapContentType(item.type),
          content_id: item.id,
          content_text: item.text,
          embedding_vector: embeddings[index] || [],
          metadata: {
            word_count: this.countWords(item.text),
            timestamp: new Date().toISOString(),
            ...item.metadata
          },
          created_at: new Date().toISOString()
        }));

        // Insert embeddings
        await this.lancedbManager.insertEmbeddings(vectorEmbeddings);

        // Small delay between batches to prevent overwhelming the system
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      this.lastSyncTime = new Date();
      console.log(`Project embedding sync completed: ${projectId}`);

    } catch (error) {
      console.error('Failed to sync project embeddings:', error);
      throw new SyncError('Project sync failed', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async validateDataIntegrity(): Promise<{ isValid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    try {
      // Check SQLite connection
      if (!this.sqliteManager.isConnected()) {
        errors.push('SQLite database not connected');
      }

      // Check LanceDB connection
      if (!this.lancedbManager.isConnected()) {
        errors.push('LanceDB not connected');
      }

      if (errors.length > 0) {
        return { isValid: false, errors };
      }

      // Validate data consistency between databases
      const projects = await this.sqliteManager.query<{ id: string }>('SELECT id FROM projects');
      
      for (const project of projects) {
        // Check if project has corresponding embeddings
        try {
          const embeddings = await this.lancedbManager.getEmbeddingsByProject?.(project.id);
          if (!embeddings || embeddings.length === 0) {
            console.warn(`Project ${project.id} has no embeddings`);
          }
        } catch (error) {
          errors.push(`Failed to validate embeddings for project ${project.id}: ${error}`);
        }
      }

      // Check for orphaned embeddings
      try {
        // This would require a method to get all project IDs from LanceDB
        // For now, we'll skip this check as it's complex with the current LanceDB API
      } catch (error) {
        errors.push(`Failed to check for orphaned embeddings: ${error}`);
      }

      return {
        isValid: errors.length === 0,
        ...(errors.length > 0 && { errors })
      };

    } catch (error) {
      return { 
        isValid: false, 
        errors: [`Integrity validation failed: ${error instanceof Error ? error.message : error}`] 
      };
    }
  }

  async repairInconsistencies(): Promise<void> {
    try {
      console.log('Starting data consistency repair...');

      // Get all projects from SQLite
      const projects = await this.sqliteManager.query<{ id: string }>('SELECT id FROM projects');

      for (const project of projects) {
        try {
          // Re-sync all project embeddings
          await this.syncProjectEmbeddings(project.id);
        } catch (error) {
          console.error(`Failed to repair project ${project.id}:`, error);
        }
      }

      console.log('Data consistency repair completed');

    } catch (error) {
      throw new SyncError('Failed to repair inconsistencies', error);
    }
  }

  async getLastSyncTime(): Promise<Date | null> {
    return this.lastSyncTime;
  }

  // Helper methods
  private async getContentFromSQLite(contentId: string, contentType: string): Promise<{
    text: string;
    project_id: string;
    metadata: Record<string, any>;
  } | null> {
    try {
      switch (contentType) {
        case 'content_block':
          const contentBlocks = await this.sqliteManager.query<ContentBlockRecord>(
            'SELECT * FROM content_blocks WHERE id = ?',
            [contentId]
          );
          if (contentBlocks.length === 0) return null;
          const block = contentBlocks[0];
          if (!block) return null;
          return {
            text: block.content_text,
            project_id: block.project_id,
            metadata: { content_type: block.content_type, word_count: block.word_count }
          };

        case 'character':
          const characters = await this.sqliteManager.query<CharacterRecord>(
            'SELECT * FROM characters WHERE id = ?',
            [contentId]
          );
          if (characters.length === 0) return null;
          const character = characters[0];
          if (!character) return null;
          return {
            text: `${character.name}. ${character.description || ''} ${character.backstory || ''}`.trim(),
            project_id: character.project_id,
            metadata: {
              character_name: character.name,
              role: character.role,
              traits: character.traits
            }
          };

        case 'scene':
          const scenes = await this.sqliteManager.query(
            `SELECT s.*, sa.story_arc_id, sa.project_id 
             FROM scenes s 
             JOIN story_acts act ON s.story_act_id = act.id 
             JOIN story_arcs sa ON act.story_arc_id = sa.id 
             WHERE s.id = ?`,
            [contentId]
          );
          if (scenes.length === 0) return null;
          const scene = scenes[0];
          return {
            text: `${scene.title}. ${scene.description || ''} Location: ${scene.location || 'Unknown'}`.trim(),
            project_id: scene.project_id,
            metadata: { 
              scene_title: scene.title, 
              location: scene.location,
              order_index: scene.order_index
            }
          };

        default:
          throw new SyncError(`Unsupported content type: ${contentType}`);
      }
    } catch (error) {
      console.error(`Failed to get content from SQLite: ${contentId}`, error);
      return null;
    }
  }

  private async getAllProjectContent(projectId: string): Promise<Array<{
    id: string;
    type: string;
    text: string;
    metadata: Record<string, any>;
  }>> {
    const contentItems: Array<{
      id: string;
      type: string;
      text: string;
      metadata: Record<string, any>;
    }> = [];

    try {
      // Get content blocks
      const contentBlocks = await this.sqliteManager.query<ContentBlockRecord>(
        'SELECT * FROM content_blocks WHERE project_id = ? AND LENGTH(content_text) > 10',
        [projectId]
      );

      for (const block of contentBlocks) {
        contentItems.push({
          id: block.id,
          type: 'content_block',
          text: block.content_text,
          metadata: { content_type: block.content_type, word_count: block.word_count }
        });
      }

      // Get characters
      const characters = await this.sqliteManager.query<CharacterRecord>(
        'SELECT * FROM characters WHERE project_id = ?',
        [projectId]
      );

      for (const character of characters) {
        const text = `${character.name}. ${character.description || ''} ${character.backstory || ''}`.trim();
        if (text.length > 10) {
          contentItems.push({
            id: character.id,
            type: 'character',
            text,
            metadata: { 
              character_name: character.name, 
              role: character.role,
              traits: character.traits 
            }
          });
        }
      }

      // Get scenes
      const scenes = await this.sqliteManager.query(
        `SELECT s.*, sa.project_id 
         FROM scenes s 
         JOIN story_acts act ON s.story_act_id = act.id 
         JOIN story_arcs sa ON act.story_arc_id = sa.id 
         WHERE sa.project_id = ?`,
        [projectId]
      );

      for (const scene of scenes) {
        const text = `${scene.title}. ${scene.description || ''} Location: ${scene.location || 'Unknown'}`.trim();
        if (text.length > 10) {
          contentItems.push({
            id: scene.id,
            type: 'scene',
            text,
            metadata: { 
              scene_title: scene.title, 
              location: scene.location,
              order_index: scene.order_index
            }
          });
        }
      }

      return contentItems;

    } catch (error) {
      throw new SyncError('Failed to get project content', error);
    }
  }

  private mapContentType(contentType: string): VectorEmbedding['content_type'] {
    switch (contentType) {
      case 'content_block':
        return 'story_content';
      case 'character':
        return 'character_description';
      case 'scene':
        return 'scene_description';
      default:
        return 'plot_element';
    }
  }

  private generateEmbeddingId(contentId: string, contentType: string): string {
    return `emb_${contentType}_${contentId}`;
  }

  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Public utility methods
  async syncContentOnChange(contentId: string, contentType: string): Promise<void> {
    // Debounced sync to avoid too frequent updates
    clearTimeout((this as any).syncTimeout);
    (this as any).syncTimeout = setTimeout(async () => {
      try {
        await this.syncContentToVector(contentId, contentType);
      } catch (error) {
        console.error('Auto-sync failed:', error);
      }
    }, 1000); // 1 second debounce
  }

  async deleteContentEmbedding(contentId: string, contentType: string): Promise<void> {
    try {
      const embeddingId = this.generateEmbeddingId(contentId, contentType);
      await this.lancedbManager.deleteEmbedding(embeddingId);
    } catch (error) {
      console.error('Failed to delete content embedding:', error);
      throw new SyncError('Failed to delete embedding', error);
    }
  }

  async deleteProjectEmbeddings(projectId: string): Promise<void> {
    try {
      await this.lancedbManager.deleteEmbeddingsByProject?.(projectId);
    } catch (error) {
      console.error('Failed to delete project embeddings:', error);
      throw new SyncError('Failed to delete project embeddings', error);
    }
  }

  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  async getSyncStats(): Promise<{
    lastSync: Date | null;
    inProgress: boolean;
    totalEmbeddings: number;
  }> {
    try {
      const stats = await this.lancedbManager.getTableStats?.();
      return {
        lastSync: this.lastSyncTime,
        inProgress: this.syncInProgress,
        totalEmbeddings: stats?.count || 0
      };
    } catch (error) {
      return {
        lastSync: this.lastSyncTime,
        inProgress: this.syncInProgress,
        totalEmbeddings: 0
      };
    }
  }
}