import { 
  DatabaseManagerInterface,
  DatabaseConfig,
  DatabaseTransaction,
  DatabaseError,
  SQLiteManagerInterface,
  LanceDBManagerInterface,
  SyncManagerInterface
} from '../types/database-types';
import { SQLiteManager } from './SQLiteManager';
import { LanceDBManager } from './LanceDBManager';
import { SyncManager, EmbeddingGenerator } from './SyncManager';

export class DatabaseManager implements DatabaseManagerInterface {
  private sqliteManager: SQLiteManagerInterface;
  private lancedbManager: LanceDBManagerInterface;
  private syncManager: SyncManagerInterface;
  private embeddingGenerator: EmbeddingGenerator;
  private config: DatabaseConfig;
  private isInitialized = false;
  private crossDbTransactions: Map<string, {
    sqliteTransactionId?: string;
    lancedbTransactionId?: string;
    status: 'pending' | 'committed' | 'rolled_back';
  }> = new Map();

  constructor(config: DatabaseConfig, embeddingGenerator: EmbeddingGenerator) {
    this.config = config;
    this.embeddingGenerator = embeddingGenerator;
    
    // Initialize database managers
    this.sqliteManager = new SQLiteManager(config.sqlite);
    this.lancedbManager = new LanceDBManager(config.lancedb);
    this.syncManager = new SyncManager(
      this.sqliteManager,
      this.lancedbManager,
      embeddingGenerator
    );
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing database system...');

      // Initialize SQLite first (it's the primary database)
      await this.sqliteManager.initialize();
      console.log('SQLite initialized');

      // Initialize LanceDB
      await this.lancedbManager.initialize();
      console.log('LanceDB initialized');

      // Verify both connections
      if (!this.sqliteManager.isConnected()) {
        throw new DatabaseError('SQLite connection failed', 'CONNECTION_ERROR');
      }

      if (!this.lancedbManager.isConnected()) {
        throw new DatabaseError('LanceDB connection failed', 'CONNECTION_ERROR');
      }

      // Check if this is a first-time setup or migration needed
      await this.checkAndMigrateData();

      this.isInitialized = true;
      console.log('Database system initialized successfully');

    } catch (error) {
      console.error('Database initialization failed:', error);
      throw new DatabaseError('Database initialization failed', 'INIT_ERROR', error);
    }
  }

  async beginTransaction(): Promise<string> {
    const transactionId = this.generateTransactionId();
    
    try {
      // Start transactions in both databases
      const sqliteTransactionId = await this.sqliteManager.beginTransaction();
      const lancedbTransactionId = await this.lancedbManager.beginTransaction();

      // Track the cross-database transaction
      this.crossDbTransactions.set(transactionId, {
        sqliteTransactionId,
        lancedbTransactionId,
        status: 'pending'
      });

      return transactionId;

    } catch (error) {
      throw new DatabaseError('Failed to begin cross-database transaction', 'TRANSACTION_ERROR', error);
    }
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.crossDbTransactions.get(transactionId);
    if (!transaction) {
      throw new DatabaseError('Transaction not found', 'TRANSACTION_ERROR');
    }

    try {
      // Commit SQLite transaction first
      if (transaction.sqliteTransactionId) {
        await this.sqliteManager.commitTransaction(transaction.sqliteTransactionId);
      }

      // Commit LanceDB transaction
      if (transaction.lancedbTransactionId) {
        await this.lancedbManager.commitTransaction(transaction.lancedbTransactionId);
      }

      transaction.status = 'committed';
      this.crossDbTransactions.delete(transactionId);

    } catch (error) {
      // If commit fails, try to rollback
      try {
        await this.rollbackTransaction(transactionId);
      } catch (rollbackError) {
        console.error('Rollback after failed commit also failed:', rollbackError);
      }
      
      throw new DatabaseError('Failed to commit cross-database transaction', 'TRANSACTION_ERROR', error);
    }
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const transaction = this.crossDbTransactions.get(transactionId);
    if (!transaction) {
      throw new DatabaseError('Transaction not found', 'TRANSACTION_ERROR');
    }

    try {
      // Rollback both transactions
      const rollbackPromises = [];

      if (transaction.sqliteTransactionId) {
        rollbackPromises.push(
          this.sqliteManager.rollbackTransaction(transaction.sqliteTransactionId)
        );
      }

      if (transaction.lancedbTransactionId) {
        rollbackPromises.push(
          this.lancedbManager.rollbackTransaction(transaction.lancedbTransactionId)
        );
      }

      await Promise.allSettled(rollbackPromises);

      transaction.status = 'rolled_back';
      this.crossDbTransactions.delete(transactionId);

    } catch (error) {
      throw new DatabaseError('Failed to rollback cross-database transaction', 'TRANSACTION_ERROR', error);
    }
  }

  isConnected(): boolean {
    return this.isInitialized && 
           this.sqliteManager.isConnected() && 
           this.lancedbManager.isConnected();
  }

  getConnectionInfo(): { sqlite: boolean; lancedb: boolean } {
    return {
      sqlite: this.sqliteManager.isConnected(),
      lancedb: this.lancedbManager.isConnected()
    };
  }

  async close(): Promise<void> {
    try {
      console.log('Closing database system...');

      // Rollback any pending transactions
      for (const [transactionId] of this.crossDbTransactions) {
        try {
          await this.rollbackTransaction(transactionId);
        } catch (error) {
          console.warn(`Failed to rollback transaction ${transactionId}:`, error);
        }
      }

      // Close database connections
      await Promise.allSettled([
        this.sqliteManager.close(),
        this.lancedbManager.close()
      ]);

      this.isInitialized = false;
      console.log('Database system closed');

    } catch (error) {
      console.error('Error closing database system:', error);
      throw new DatabaseError('Failed to close database system', 'CLOSE_ERROR', error);
    }
  }

  // Getter methods for individual managers
  get sqlite(): SQLiteManagerInterface {
    if (!this.isInitialized) {
      throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
    }
    return this.sqliteManager;
  }

  get vector(): LanceDBManagerInterface {
    if (!this.isInitialized) {
      throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
    }
    return this.lancedbManager;
  }

  get sync(): SyncManagerInterface {
    if (!this.isInitialized) {
      throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
    }
    return this.syncManager;
  }

  // High-level convenience methods that combine both databases
  async createProject(projectData: {
    title: string;
    description?: string;
    genre?: string;
    targetWordCount?: number;
  }): Promise<string> {
    const transactionId = await this.beginTransaction();
    
    try {
      const projectId = this.generateId();
      const now = new Date().toISOString();

      // Insert into SQLite
      await this.sqliteManager.run(
        `INSERT INTO projects (id, title, description, genre, target_word_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          projectData.title,
          projectData.description || '',
          projectData.genre || '',
          projectData.targetWordCount || 80000,
          now,
          now
        ]
      );

      await this.commitTransaction(transactionId);
      return projectId;

    } catch (error) {
      await this.rollbackTransaction(transactionId);
      throw new DatabaseError('Failed to create project', 'CREATE_ERROR', error);
    }
  }

  async addContentWithEmbedding(
    projectId: string,
    contentType: string,
    contentText: string,
    contentId?: string
  ): Promise<string> {
    const transactionId = await this.beginTransaction();
    
    try {
      const blockId = this.generateId();
      const now = new Date().toISOString();
      const wordCount = this.countWords(contentText);

      // Insert content into SQLite
      await this.sqliteManager.run(
        `INSERT INTO content_blocks (id, project_id, content_type, content_id, content_text, word_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [blockId, projectId, contentType, contentId, contentText, wordCount, now, now]
      );

      // Sync to vector database
      await this.syncManager.syncContentToVector(blockId, 'content_block');

      await this.commitTransaction(transactionId);
      return blockId;

    } catch (error) {
      await this.rollbackTransaction(transactionId);
      throw new DatabaseError('Failed to add content with embedding', 'CREATE_ERROR', error);
    }
  }

  async updateContentWithEmbedding(
    contentBlockId: string,
    newText: string
  ): Promise<void> {
    const transactionId = await this.beginTransaction();
    
    try {
      const now = new Date().toISOString();
      const wordCount = this.countWords(newText);

      // Update content in SQLite
      await this.sqliteManager.run(
        `UPDATE content_blocks SET content_text = ?, word_count = ?, updated_at = ? WHERE id = ?`,
        [newText, wordCount, now, contentBlockId]
      );

      // Re-sync to vector database
      await this.syncManager.syncContentToVector(contentBlockId, 'content_block');

      await this.commitTransaction(transactionId);

    } catch (error) {
      await this.rollbackTransaction(transactionId);
      throw new DatabaseError('Failed to update content with embedding', 'UPDATE_ERROR', error);
    }
  }

  async deleteContentWithEmbedding(contentBlockId: string): Promise<void> {
    const transactionId = await this.beginTransaction();
    
    try {
      // Delete from SQLite
      await this.sqliteManager.run(
        'DELETE FROM content_blocks WHERE id = ?',
        [contentBlockId]
      );

      // Delete embedding
      await this.syncManager.deleteContentEmbedding(contentBlockId, 'content_block');

      await this.commitTransaction(transactionId);

    } catch (error) {
      await this.rollbackTransaction(transactionId);
      throw new DatabaseError('Failed to delete content with embedding', 'DELETE_ERROR', error);
    }
  }

  async deleteProjectWithEmbeddings(projectId: string): Promise<void> {
    const transactionId = await this.beginTransaction();
    
    try {
      // Delete all embeddings for the project
      await this.syncManager.deleteProjectEmbeddings(projectId);

      // Delete from SQLite (cascading will handle related records)
      await this.sqliteManager.run('DELETE FROM projects WHERE id = ?', [projectId]);

      await this.commitTransaction(transactionId);

    } catch (error) {
      await this.rollbackTransaction(transactionId);
      throw new DatabaseError('Failed to delete project with embeddings', 'DELETE_ERROR', error);
    }
  }

  // Data migration and integrity methods
  private async checkAndMigrateData(): Promise<void> {
    try {
      // Check if there's existing localStorage data to migrate
      const hasLocalStorageData = this.checkForLocalStorageData();
      
      if (hasLocalStorageData) {
        console.log('Found existing localStorage data, starting migration...');
        await this.migrateFromLocalStorage();
      }

      // Validate data integrity
      const integrity = await this.syncManager.validateDataIntegrity();
      if (!integrity.isValid) {
        console.warn('Data integrity issues found:', integrity.errors);
        await this.syncManager.repairInconsistencies();
      }

    } catch (error) {
      console.error('Migration/validation failed:', error);
      // Don't throw here - allow the app to continue with empty database
    }
  }

  private checkForLocalStorageData(): boolean {
    try {
      const currentProject = localStorage.getItem('currentProject');
      return currentProject !== null;
    } catch (error) {
      return false;
    }
  }

  private async migrateFromLocalStorage(): Promise<void> {
    try {
      const currentProjectData = localStorage.getItem('currentProject');
      if (!currentProjectData) return;

      const project = JSON.parse(currentProjectData);
      
      // Create project in new database
      const projectId = await this.createProject({
        title: project.title || 'Migrated Project',
        description: project.description,
        genre: project.genre,
        targetWordCount: project.targetWordCount
      });

      // Migrate main content
      if (project.content) {
        await this.addContentWithEmbedding(
          projectId,
          'main_text',
          project.content
        );
      }

      // Migrate characters
      if (project.characters && Array.isArray(project.characters)) {
        for (const character of project.characters) {
          await this.sqliteManager.run(
            `INSERT INTO characters (id, project_id, name, role, age, description, backstory, traits, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              character.id || this.generateId(),
              projectId,
              character.name,
              character.role,
              character.age,
              character.description,
              character.backstory,
              JSON.stringify(character.traits || []),
              character.notes,
              character.createdAt || new Date().toISOString(),
              character.updatedAt || new Date().toISOString()
            ]
          );

          // Create embedding for character
          const characterText = `${character.name}. ${character.description || ''} ${character.backstory || ''}`.trim();
          if (characterText.length > 10) {
            await this.syncManager.syncContentToVector(character.id, 'character');
          }
        }
      }

      // Mark migration as complete
      localStorage.setItem('migrated_to_database', 'true');
      console.log('Migration from localStorage completed successfully');

    } catch (error) {
      console.error('Migration failed:', error);
      throw new DatabaseError('Migration from localStorage failed', 'MIGRATION_ERROR', error);
    }
  }

  // Utility methods
  private generateTransactionId(): string {
    return `cross_txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  // Database statistics and monitoring
  async getStats(): Promise<{
    sqlite: { size: number; pageCount: number; pageSize: number };
    vector: { count: number; size: number };
    sync: { lastSync: Date | null; inProgress: boolean; totalEmbeddings: number };
  }> {
    try {
      const [sqliteStats, vectorStats, syncStats] = await Promise.all([
        this.sqliteManager.getStats?.() || { size: 0, pageCount: 0, pageSize: 0 },
        this.lancedbManager.getTableStats(),
        this.syncManager.getSyncStats()
      ]);

      return {
        sqlite: sqliteStats,
        vector: vectorStats,
        sync: syncStats
      };

    } catch (error) {
      throw new DatabaseError('Failed to get database stats', 'STATS_ERROR', error);
    }
  }

  async backup(): Promise<{ sqlite: Uint8Array; timestamp: Date }> {
    try {
      const sqliteBackup = await this.sqliteManager.backup();
      return {
        sqlite: sqliteBackup,
        timestamp: new Date()
      };
    } catch (error) {
      throw new DatabaseError('Backup failed', 'BACKUP_ERROR', error);
    }
  }

  async restore(backupData: { sqlite: Uint8Array }): Promise<void> {
    try {
      await this.sqliteManager.restore(backupData.sqlite);
      
      // Re-sync all embeddings after restore
      const projects = await this.sqliteManager.query<{ id: string }>('SELECT id FROM projects');
      for (const project of projects) {
        await this.syncManager.syncProjectEmbeddings(project.id);
      }

    } catch (error) {
      throw new DatabaseError('Restore failed', 'RESTORE_ERROR', error);
    }
  }
}