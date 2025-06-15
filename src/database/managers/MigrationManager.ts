import { DatabaseError } from '../types/database-types';
import { DatabaseManager } from './DatabaseManager';

export interface MigrationStep {
  id: string;
  version: string;
  description: string;
  up: (db: DatabaseManager) => Promise<void>;
  down: (db: DatabaseManager) => Promise<void>;
}

export interface MigrationResult {
  success: boolean;
  appliedMigrations: string[];
  errors: string[];
  rollbackPerformed?: boolean;
}

export interface BackupData {
  version: string;
  timestamp: Date;
  sqlite: Uint8Array;
  vectorCount: number;
  migrations: string[];
  metadata: {
    projectCount: number;
    contentBlockCount: number;
    characterCount: number;
  };
}

export class MigrationManager {
  private migrations: Map<string, MigrationStep> = new Map();
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
    this.initializeMigrations();
  }

  private initializeMigrations(): void {
    // Migration v1.0.1 - Add indexes for better performance
    this.addMigration({
      id: 'add_performance_indexes',
      version: '1.0.1',
      description: 'Add database indexes for improved query performance',
      up: async (db) => {
        await db.sqlite.run('CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at)');
        await db.sqlite.run('CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at)');
        await db.sqlite.run('CREATE INDEX IF NOT EXISTS idx_content_blocks_project_id ON content_blocks(project_id)');
        await db.sqlite.run('CREATE INDEX IF NOT EXISTS idx_content_blocks_content_type ON content_blocks(content_type)');
        await db.sqlite.run('CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id)');
        await db.sqlite.run('CREATE INDEX IF NOT EXISTS idx_story_arcs_project_id ON story_arcs(project_id)');
      },
      down: async (db) => {
        await db.sqlite.run('DROP INDEX IF EXISTS idx_projects_created_at');
        await db.sqlite.run('DROP INDEX IF EXISTS idx_projects_updated_at');
        await db.sqlite.run('DROP INDEX IF EXISTS idx_content_blocks_project_id');
        await db.sqlite.run('DROP INDEX IF EXISTS idx_content_blocks_content_type');
        await db.sqlite.run('DROP INDEX IF EXISTS idx_characters_project_id');
        await db.sqlite.run('DROP INDEX IF EXISTS idx_story_arcs_project_id');
      }
    });

    // Migration v1.0.2 - Add full-text search support
    this.addMigration({
      id: 'add_fulltext_search',
      version: '1.0.2',
      description: 'Add full-text search capabilities',
      up: async (db) => {
        // Create FTS virtual table for content search
        await db.sqlite.run(`
          CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
            content_text,
            content_type,
            project_id,
            content=content_blocks,
            content_rowid=id
          )
        `);
        
        // Create triggers to keep FTS table in sync
        await db.sqlite.run(`
          CREATE TRIGGER IF NOT EXISTS content_fts_insert AFTER INSERT ON content_blocks
          BEGIN
            INSERT INTO content_fts(rowid, content_text, content_type, project_id)
            VALUES (new.rowid, new.content_text, new.content_type, new.project_id);
          END
        `);

        await db.sqlite.run(`
          CREATE TRIGGER IF NOT EXISTS content_fts_update AFTER UPDATE ON content_blocks
          BEGIN
            UPDATE content_fts SET 
              content_text = new.content_text,
              content_type = new.content_type,
              project_id = new.project_id
            WHERE rowid = new.rowid;
          END
        `);

        await db.sqlite.run(`
          CREATE TRIGGER IF NOT EXISTS content_fts_delete AFTER DELETE ON content_blocks
          BEGIN
            DELETE FROM content_fts WHERE rowid = old.rowid;
          END
        `);

        // Populate FTS table with existing data
        await db.sqlite.run(`
          INSERT INTO content_fts(rowid, content_text, content_type, project_id)
          SELECT rowid, content_text, content_type, project_id FROM content_blocks
        `);
      },
      down: async (db) => {
        await db.sqlite.run('DROP TRIGGER IF EXISTS content_fts_delete');
        await db.sqlite.run('DROP TRIGGER IF EXISTS content_fts_update');
        await db.sqlite.run('DROP TRIGGER IF EXISTS content_fts_insert');
        await db.sqlite.run('DROP TABLE IF EXISTS content_fts');
      }
    });

    // Migration v1.0.3 - Add query performance tracking
    this.addMigration({
      id: 'add_query_performance_tracking',
      version: '1.0.3',
      description: 'Add table for tracking query performance',
      up: async (db) => {
        await db.sqlite.run(`
          CREATE TABLE IF NOT EXISTS query_performance (
            id TEXT PRIMARY KEY,
            query_type TEXT NOT NULL,
            execution_time_ms INTEGER NOT NULL,
            parameters TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        await db.sqlite.run('CREATE INDEX IF NOT EXISTS idx_query_performance_type ON query_performance(query_type)');
        await db.sqlite.run('CREATE INDEX IF NOT EXISTS idx_query_performance_time ON query_performance(execution_time_ms)');
      },
      down: async (db) => {
        await db.sqlite.run('DROP TABLE IF EXISTS query_performance');
      }
    });
  }

  addMigration(migration: MigrationStep): void {
    this.migrations.set(migration.id, migration);
  }

  async getCurrentVersion(): Promise<string> {
    try {
      // Get the latest applied migration version
      const result = await this.dbManager.sqlite.query<{ version: string }>(
        'SELECT version FROM migrations ORDER BY applied_at DESC LIMIT 1'
      );
      
      return result.length > 0 ? result[0]!.version : '1.0.0';
    } catch (error) {
      // If migrations table doesn't exist, we're at base version
      return '1.0.0';
    }
  }

  async getAppliedMigrations(): Promise<string[]> {
    try {
      const result = await this.dbManager.sqlite.query<{ migration_id: string }>(
        'SELECT migration_id FROM migrations ORDER BY applied_at ASC'
      );
      
      return result.map(row => row.migration_id);
    } catch (error) {
      return [];
    }
  }

  async createMigrationsTable(): Promise<void> {
    await this.dbManager.sqlite.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        migration_id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        description TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async migrate(targetVersion?: string): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      appliedMigrations: [],
      errors: []
    };

    try {
      await this.createMigrationsTable();
      
      const appliedMigrations = await this.getAppliedMigrations();
      const allMigrations = Array.from(this.migrations.values())
        .sort((a, b) => a.version.localeCompare(b.version));

      // Find migrations to apply
      const migrationsToApply = allMigrations.filter(migration => {
        if (appliedMigrations.includes(migration.id)) {
          return false;
        }
        
        if (targetVersion && migration.version > targetVersion) {
          return false;
        }
        
        return true;
      });

      if (migrationsToApply.length === 0) {
        result.success = true;
        return result;
      }

      // Apply migrations in transaction
      const transactionId = await this.dbManager.beginTransaction();
      
      try {
        for (const migration of migrationsToApply) {
          console.log(`Applying migration: ${migration.id} (${migration.description})`);
          
          await migration.up(this.dbManager);
          
          // Record migration as applied
          await this.dbManager.sqlite.run(
            'INSERT INTO migrations (migration_id, version, description) VALUES (?, ?, ?)',
            [migration.id, migration.version, migration.description]
          );
          
          result.appliedMigrations.push(migration.id);
        }

        await this.dbManager.commitTransaction(transactionId);
        result.success = true;
        
        console.log(`Applied ${result.appliedMigrations.length} migrations successfully`);

      } catch (error) {
        await this.dbManager.rollbackTransaction(transactionId);
        
        // Attempt to rollback applied migrations
        try {
          await this.rollbackMigrations(result.appliedMigrations);
          result.rollbackPerformed = true;
        } catch (rollbackError) {
          result.errors.push(`Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`);
        }
        
        throw error;
      }

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown migration error');
      result.success = false;
    }

    return result;
  }

  async rollbackMigrations(migrationIds: string[]): Promise<void> {
    // Rollback in reverse order
    const migrationsToRollback = migrationIds.reverse()
      .map(id => this.migrations.get(id))
      .filter((migration): migration is MigrationStep => migration !== undefined);

    const transactionId = await this.dbManager.beginTransaction();
    
    try {
      for (const migration of migrationsToRollback) {
        console.log(`Rolling back migration: ${migration.id}`);
        await migration.down(this.dbManager);
        
        await this.dbManager.sqlite.run(
          'DELETE FROM migrations WHERE migration_id = ?',
          [migration.id]
        );
      }

      await this.dbManager.commitTransaction(transactionId);
      
    } catch (error) {
      await this.dbManager.rollbackTransaction(transactionId);
      throw new DatabaseError('Migration rollback failed', 'ROLLBACK_ERROR', error);
    }
  }

  async createBackup(): Promise<BackupData> {
    try {
      console.log('Creating database backup...');
      
      // Get SQLite backup
      const sqliteBackup = await this.dbManager.backup();
      
      // Get vector database stats
      const vectorStats = await this.dbManager.vector.getTableStats();
      
      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      
      // Get metadata
      const [projects, contentBlocks, characters] = await Promise.all([
        this.dbManager.sqlite.query('SELECT COUNT(*) as count FROM projects'),
        this.dbManager.sqlite.query('SELECT COUNT(*) as count FROM content_blocks'),
        this.dbManager.sqlite.query('SELECT COUNT(*) as count FROM characters')
      ]);

      const backup: BackupData = {
        version: await this.getCurrentVersion(),
        timestamp: new Date(),
        sqlite: sqliteBackup.sqlite,
        vectorCount: vectorStats.count,
        migrations: appliedMigrations,
        metadata: {
          projectCount: projects[0]?.count || 0,
          contentBlockCount: contentBlocks[0]?.count || 0,
          characterCount: characters[0]?.count || 0
        }
      };

      console.log('Backup created successfully', {
        version: backup.version,
        projectCount: backup.metadata.projectCount,
        contentBlockCount: backup.metadata.contentBlockCount,
        vectorCount: backup.vectorCount
      });

      return backup;

    } catch (error) {
      throw new DatabaseError('Backup creation failed', 'BACKUP_ERROR', error);
    }
  }

  async restoreFromBackup(backup: BackupData): Promise<void> {
    try {
      console.log('Restoring database from backup...');
      
      // Validate backup
      if (!backup.sqlite || !backup.version) {
        throw new DatabaseError('Invalid backup data', 'RESTORE_ERROR');
      }

      // Restore SQLite database
      await this.dbManager.restore({ sqlite: backup.sqlite });
      
      // Re-sync vector embeddings after restore
      console.log('Re-syncing vector embeddings...');
      const projects = await this.dbManager.sqlite.query<{ id: string }>('SELECT id FROM projects');
      
      for (const project of projects) {
        await this.dbManager.sync.syncProjectEmbeddings(project.id);
      }

      console.log('Database restored successfully', {
        version: backup.version,
        projectCount: backup.metadata.projectCount,
        restoredAt: new Date().toISOString()
      });

    } catch (error) {
      throw new DatabaseError('Restore failed', 'RESTORE_ERROR', error);
    }
  }

  async validateDatabase(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check SQLite integrity
      const integrityCheck = await this.dbManager.sqlite.query('PRAGMA integrity_check');
      if (integrityCheck[0]?.integrity_check !== 'ok') {
        errors.push('SQLite integrity check failed');
      }

      // Check that all required tables exist
      const requiredTables = ['projects', 'content_blocks', 'characters', 'story_arcs', 'migrations'];
      for (const tableName of requiredTables) {
        try {
          await this.dbManager.sqlite.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
        } catch (error) {
          errors.push(`Required table '${tableName}' is missing`);
        }
      }

      // Check vector database consistency
      const sqliteContentCount = await this.dbManager.sqlite.query('SELECT COUNT(*) as count FROM content_blocks');
      const vectorStats = await this.dbManager.vector.getTableStats();
      
      const contentCount = sqliteContentCount[0]?.count || 0;
      const vectorCount = vectorStats.count;
      
      if (Math.abs(contentCount - vectorCount) > contentCount * 0.1) {
        warnings.push(`Vector database sync inconsistency: ${contentCount} content blocks vs ${vectorCount} vectors`);
      }

      // Check for orphaned data
      const orphanedContent = await this.dbManager.sqlite.query(`
        SELECT COUNT(*) as count FROM content_blocks 
        WHERE project_id NOT IN (SELECT id FROM projects)
      `);
      
      if (orphanedContent[0]?.count > 0) {
        warnings.push(`Found ${orphanedContent[0].count} orphaned content blocks`);
      }

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async optimizeDatabase(): Promise<void> {
    try {
      console.log('Optimizing database...');
      
      // SQLite optimization
      await this.dbManager.sqlite.run('VACUUM');
      await this.dbManager.sqlite.run('ANALYZE');
      
      // Vector database optimization
      await this.dbManager.vector.optimize();
      
      console.log('Database optimization completed');
      
    } catch (error) {
      throw new DatabaseError('Database optimization failed', 'OPTIMIZATION_ERROR', error);
    }
  }
}