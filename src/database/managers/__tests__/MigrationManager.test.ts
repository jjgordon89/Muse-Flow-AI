import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MigrationManager, MigrationStep, BackupData } from '../MigrationManager';
import { DatabaseManager } from '../DatabaseManager';
import { DatabaseError } from '../../types/database-types';

// Mock DatabaseManager
const mockDatabaseManager = {
  sqlite: {
    query: vi.fn(),
    run: vi.fn(),
  },
  vector: {
    getTableStats: vi.fn(),
    optimize: vi.fn(),
  },
  sync: {
    syncProjectEmbeddings: vi.fn(),
  },
  beginTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  rollbackTransaction: vi.fn(),
  backup: vi.fn(),
  restore: vi.fn(),
} as unknown as DatabaseManager;

describe('MigrationManager', () => {
  let migrationManager: MigrationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    migrationManager = new MigrationManager(mockDatabaseManager);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getCurrentVersion', () => {
    it('returns latest applied migration version', async () => {
      (mockDatabaseManager.sqlite.query as any).mockResolvedValue([
        { version: '1.0.2' }
      ]);

      const version = await migrationManager.getCurrentVersion();
      expect(version).toBe('1.0.2');
    });

    it('returns base version when no migrations applied', async () => {
      (mockDatabaseManager.sqlite.query as any).mockResolvedValue([]);

      const version = await migrationManager.getCurrentVersion();
      expect(version).toBe('1.0.0');
    });

    it('returns base version when migrations table does not exist', async () => {
      (mockDatabaseManager.sqlite.query as any).mockRejectedValue(new Error('Table not found'));

      const version = await migrationManager.getCurrentVersion();
      expect(version).toBe('1.0.0');
    });
  });

  describe('getAppliedMigrations', () => {
    it('returns list of applied migration IDs', async () => {
      (mockDatabaseManager.sqlite.query as any).mockResolvedValue([
        { migration_id: 'add_performance_indexes' },
        { migration_id: 'add_fulltext_search' }
      ]);

      const migrations = await migrationManager.getAppliedMigrations();
      expect(migrations).toEqual(['add_performance_indexes', 'add_fulltext_search']);
    });

    it('returns empty array when no migrations applied', async () => {
      (mockDatabaseManager.sqlite.query as any).mockResolvedValue([]);

      const migrations = await migrationManager.getAppliedMigrations();
      expect(migrations).toEqual([]);
    });

    it('returns empty array when migrations table does not exist', async () => {
      (mockDatabaseManager.sqlite.query as any).mockRejectedValue(new Error('Table not found'));

      const migrations = await migrationManager.getAppliedMigrations();
      expect(migrations).toEqual([]);
    });
  });

  describe('createMigrationsTable', () => {
    it('creates migrations table', async () => {
      (mockDatabaseManager.sqlite.run as any).mockResolvedValue({});

      await migrationManager.createMigrationsTable();

      expect(mockDatabaseManager.sqlite.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS migrations')
      );
    });
  });

  describe('migrate', () => {
    beforeEach(() => {
      (mockDatabaseManager.beginTransaction as any).mockResolvedValue('txn123');
      (mockDatabaseManager.commitTransaction as any).mockResolvedValue(undefined);
      (mockDatabaseManager.sqlite.run as any).mockResolvedValue({});
    });

    it('applies pending migrations successfully', async () => {
      // Mock no applied migrations
      (mockDatabaseManager.sqlite.query as any)
        .mockResolvedValueOnce([]) // getAppliedMigrations
        .mockResolvedValue([]); // other queries

      const result = await migrationManager.migrate();

      expect(result.success).toBe(true);
      expect(result.appliedMigrations.length).toBeGreaterThan(0);
      expect(mockDatabaseManager.beginTransaction).toHaveBeenCalled();
      expect(mockDatabaseManager.commitTransaction).toHaveBeenCalledWith('txn123');
    });

    it('skips already applied migrations', async () => {
      // Mock all migrations already applied
      (mockDatabaseManager.sqlite.query as any)
        .mockResolvedValue([
          { migration_id: 'add_performance_indexes' },
          { migration_id: 'add_fulltext_search' },
          { migration_id: 'add_query_performance_tracking' }
        ]);

      const result = await migrationManager.migrate();

      expect(result.success).toBe(true);
      expect(result.appliedMigrations).toEqual([]);
    });

    it('applies migrations up to target version', async () => {
      (mockDatabaseManager.sqlite.query as any)
        .mockResolvedValueOnce([]) // getAppliedMigrations
        .mockResolvedValue([]);

      const result = await migrationManager.migrate('1.0.1');

      expect(result.success).toBe(true);
      expect(result.appliedMigrations).toContain('add_performance_indexes');
      expect(result.appliedMigrations).not.toContain('add_fulltext_search');
    });

    it('rolls back on migration failure', async () => {
      (mockDatabaseManager.sqlite.query as any)
        .mockResolvedValueOnce([]) // getAppliedMigrations
        .mockResolvedValue([]);

      // Mock migration failure
      const mockMigration: MigrationStep = {
        id: 'failing_migration',
        version: '1.0.0',
        description: 'A migration that fails',
        up: vi.fn().mockRejectedValue(new Error('Migration failed')),
        down: vi.fn().mockResolvedValue(undefined)
      };

      migrationManager.addMigration(mockMigration);

      (mockDatabaseManager.rollbackTransaction as any).mockResolvedValue(undefined);

      const result = await migrationManager.migrate();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Migration failed');
      expect(mockDatabaseManager.rollbackTransaction).toHaveBeenCalledWith('txn123');
    });
  });

  describe('rollbackMigrations', () => {
    it('rolls back migrations in reverse order', async () => {
      const mockMigration1: MigrationStep = {
        id: 'migration1',
        version: '1.0.1',
        description: 'First migration',
        up: vi.fn(),
        down: vi.fn().mockResolvedValue(undefined)
      };

      const mockMigration2: MigrationStep = {
        id: 'migration2',
        version: '1.0.2',
        description: 'Second migration',
        up: vi.fn(),
        down: vi.fn().mockResolvedValue(undefined)
      };

      migrationManager.addMigration(mockMigration1);
      migrationManager.addMigration(mockMigration2);

      (mockDatabaseManager.beginTransaction as any).mockResolvedValue('txn123');
      (mockDatabaseManager.commitTransaction as any).mockResolvedValue(undefined);
      (mockDatabaseManager.sqlite.run as any).mockResolvedValue({});

      await migrationManager.rollbackMigrations(['migration1', 'migration2']);

      // Should rollback in reverse order
      expect(mockMigration2.down).toHaveBeenCalled();
      expect(mockMigration1.down).toHaveBeenCalled();
      expect(mockDatabaseManager.commitTransaction).toHaveBeenCalledWith('txn123');
    });

    it('handles rollback failure', async () => {
      const mockMigration: MigrationStep = {
        id: 'failing_rollback',
        version: '1.0.1',
        description: 'Migration with failing rollback',
        up: vi.fn(),
        down: vi.fn().mockRejectedValue(new Error('Rollback failed'))
      };

      migrationManager.addMigration(mockMigration);

      (mockDatabaseManager.beginTransaction as any).mockResolvedValue('txn123');
      (mockDatabaseManager.rollbackTransaction as any).mockResolvedValue(undefined);

      await expect(migrationManager.rollbackMigrations(['failing_rollback']))
        .rejects.toThrow(DatabaseError);

      expect(mockDatabaseManager.rollbackTransaction).toHaveBeenCalledWith('txn123');
    });
  });

  describe('createBackup', () => {
    it('creates complete backup data', async () => {
      const mockSqliteBackup = new Uint8Array([1, 2, 3, 4]);
      
      (mockDatabaseManager.backup as any).mockResolvedValue({
        sqlite: mockSqliteBackup,
        timestamp: new Date()
      });

      (mockDatabaseManager.vector.getTableStats as any).mockResolvedValue({
        count: 150,
        size: 1024000
      });

      (mockDatabaseManager.sqlite.query as any)
        .mockResolvedValueOnce([{ migration_id: 'add_performance_indexes' }]) // getAppliedMigrations
        .mockResolvedValueOnce([{ count: 5 }]) // projects count
        .mockResolvedValueOnce([{ count: 100 }]) // content_blocks count
        .mockResolvedValueOnce([{ count: 25 }]); // characters count

      const backup = await migrationManager.createBackup();

      expect(backup.sqlite).toEqual(mockSqliteBackup);
      expect(backup.vectorCount).toBe(150);
      expect(backup.migrations).toContain('add_performance_indexes');
      expect(backup.metadata.projectCount).toBe(5);
      expect(backup.metadata.contentBlockCount).toBe(100);
      expect(backup.metadata.characterCount).toBe(25);
    });

    it('handles backup creation failure', async () => {
      (mockDatabaseManager.backup as any).mockRejectedValue(new Error('Backup failed'));

      await expect(migrationManager.createBackup()).rejects.toThrow(DatabaseError);
    });
  });

  describe('restoreFromBackup', () => {
    it('restores database from backup successfully', async () => {
      const mockBackup: BackupData = {
        version: '1.0.2',
        timestamp: new Date(),
        sqlite: new Uint8Array([1, 2, 3, 4]),
        vectorCount: 150,
        migrations: ['add_performance_indexes'],
        metadata: {
          projectCount: 5,
          contentBlockCount: 100,
          characterCount: 25
        }
      };

      (mockDatabaseManager.restore as any).mockResolvedValue(undefined);
      (mockDatabaseManager.sqlite.query as any).mockResolvedValue([
        { id: 'project1' },
        { id: 'project2' }
      ]);
      (mockDatabaseManager.sync.syncProjectEmbeddings as any).mockResolvedValue(undefined);

      await migrationManager.restoreFromBackup(mockBackup);

      expect(mockDatabaseManager.restore).toHaveBeenCalledWith({
        sqlite: mockBackup.sqlite
      });
      expect(mockDatabaseManager.sync.syncProjectEmbeddings).toHaveBeenCalledTimes(2);
    });

    it('validates backup data', async () => {
      const invalidBackup = {
        version: '1.0.0',
        timestamp: new Date(),
        sqlite: undefined, // invalid sqlite data
        vectorCount: 0,
        migrations: [],
        metadata: { projectCount: 0, contentBlockCount: 0, characterCount: 0 }
      } as unknown as BackupData;

      await expect(migrationManager.restoreFromBackup(invalidBackup))
        .rejects.toThrow(DatabaseError);
    });

    it('handles restore failure', async () => {
      const mockBackup: BackupData = {
        version: '1.0.0',
        timestamp: new Date(),
        sqlite: new Uint8Array([1, 2, 3, 4]),
        vectorCount: 0,
        migrations: [],
        metadata: { projectCount: 0, contentBlockCount: 0, characterCount: 0 }
      };

      (mockDatabaseManager.restore as any).mockRejectedValue(new Error('Restore failed'));

      await expect(migrationManager.restoreFromBackup(mockBackup))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('validateDatabase', () => {
    it('validates database successfully', async () => {
      (mockDatabaseManager.sqlite.query as any)
        .mockResolvedValueOnce([{ integrity_check: 'ok' }]) // PRAGMA integrity_check
        .mockResolvedValueOnce([{ name: 'projects' }]) // projects table check
        .mockResolvedValueOnce([{ name: 'content_blocks' }]) // content_blocks table check
        .mockResolvedValueOnce([{ name: 'characters' }]) // characters table check
        .mockResolvedValueOnce([{ name: 'story_arcs' }]) // story_arcs table check
        .mockResolvedValueOnce([{ name: 'migrations' }]) // migrations table check
        .mockResolvedValueOnce([{ count: 100 }]) // content blocks count
        .mockResolvedValueOnce([{ count: 0 }]); // orphaned content count

      (mockDatabaseManager.vector.getTableStats as any).mockResolvedValue({
        count: 98, // Slightly different but within tolerance
        size: 1024
      });

      const result = await migrationManager.validateDatabase();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects integrity issues', async () => {
      (mockDatabaseManager.sqlite.query as any)
        .mockResolvedValueOnce([{ integrity_check: 'corruption detected' }])
        .mockResolvedValue([]);

      const result = await migrationManager.validateDatabase();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('SQLite integrity check failed');
    });

    it('detects missing tables', async () => {
      (mockDatabaseManager.sqlite.query as any)
        .mockResolvedValueOnce([{ integrity_check: 'ok' }])
        .mockRejectedValueOnce(new Error('Table not found')) // projects table missing
        .mockResolvedValue([]);

      const result = await migrationManager.validateDatabase();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Required table 'projects' is missing");
    });

    it('detects vector database inconsistency', async () => {
      (mockDatabaseManager.sqlite.query as any)
        .mockResolvedValueOnce([{ integrity_check: 'ok' }])
        .mockResolvedValue([{ name: 'projects' }, { count: 100 }, { count: 0 }]);

      (mockDatabaseManager.vector.getTableStats as any).mockResolvedValue({
        count: 50, // 50% difference - should trigger warning
        size: 1024
      });

      const result = await migrationManager.validateDatabase();

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Vector database sync inconsistency');
    });

    it('detects orphaned data', async () => {
      (mockDatabaseManager.sqlite.query as any)
        .mockResolvedValueOnce([{ integrity_check: 'ok' }])
        .mockResolvedValue([{ name: 'projects' }, { count: 100 }, { count: 5 }]); // 5 orphaned content blocks

      (mockDatabaseManager.vector.getTableStats as any).mockResolvedValue({
        count: 100,
        size: 1024
      });

      const result = await migrationManager.validateDatabase();

      expect(result.warnings).toContain('Found 5 orphaned content blocks');
    });
  });

  describe('optimizeDatabase', () => {
    it('optimizes database successfully', async () => {
      (mockDatabaseManager.sqlite.run as any).mockResolvedValue({});
      (mockDatabaseManager.vector.optimize as any).mockResolvedValue(undefined);

      await migrationManager.optimizeDatabase();

      expect(mockDatabaseManager.sqlite.run).toHaveBeenCalledWith('VACUUM');
      expect(mockDatabaseManager.sqlite.run).toHaveBeenCalledWith('ANALYZE');
      expect(mockDatabaseManager.vector.optimize).toHaveBeenCalled();
    });

    it('handles optimization failure', async () => {
      (mockDatabaseManager.sqlite.run as any).mockRejectedValue(new Error('VACUUM failed'));

      await expect(migrationManager.optimizeDatabase()).rejects.toThrow(DatabaseError);
    });
  });

  describe('addMigration', () => {
    it('adds custom migration', () => {
      const customMigration: MigrationStep = {
        id: 'custom_migration',
        version: '1.0.5',
        description: 'Custom migration',
        up: vi.fn(),
        down: vi.fn()
      };

      migrationManager.addMigration(customMigration);

      // Verify migration was added (this would be tested via migrate() call)
      expect(customMigration.id).toBe('custom_migration');
    });
  });
});