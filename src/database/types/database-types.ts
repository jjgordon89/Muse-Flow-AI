export interface DatabaseConfig {
  sqlite: {
    filename: string;
    enableWAL: boolean;
    cacheSize: number;
    busyTimeout: number;
  };
  lancedb: {
    uri: string;
    tableName: string;
    dimensions: number;
  };
  embedding: {
    provider: 'local' | 'openai' | 'anthropic';
    model: string;
    batchSize: number;
    cacheSize: number;
  };
}

export interface SQLiteConnection {
  db: any; // sql.js Database instance
  isConnected: boolean;
  connectionId: string;
}

export interface LanceDBConnection {
  db: any; // LanceDB instance
  table: any; // LanceDB table
  isConnected: boolean;
  connectionId: string;
}

export interface DatabaseTransaction {
  id: string;
  type: 'sqlite' | 'lancedb' | 'cross-db';
  startTime: Date;
  operations: DatabaseOperation[];
  status: 'pending' | 'committed' | 'rolled_back';
}

export interface DatabaseOperation {
  id: string;
  type: 'insert' | 'update' | 'delete' | 'select';
  table: string;
  data?: any;
  conditions?: Record<string, any>;
  timestamp: Date;
}

// Core project entities
export interface ProjectRecord {
  id: string;
  title: string;
  description?: string;
  genre?: string;
  target_word_count: number;
  current_word_count: number;
  created_at: string;
  updated_at: string;
  metadata?: string; // JSON blob
}

export interface CharacterRecord {
  id: string;
  project_id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  age?: number;
  description?: string;
  backstory?: string;
  traits?: string; // JSON array
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CharacterRelationshipRecord {
  id: string;
  character_id: string;
  related_character_id: string;
  relationship_type: string;
  description?: string;
  created_at: string;
}

export interface StoryArcRecord {
  id: string;
  project_id: string;
  title: string;
  type: 'main' | 'subplot' | 'character';
  description?: string;
  status: 'planning' | 'active' | 'completed';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StoryActRecord {
  id: string;
  story_arc_id: string;
  title: string;
  description?: string;
  order_index: number;
  created_at: string;
}

export interface SceneRecord {
  id: string;
  story_act_id: string;
  title: string;
  description?: string;
  location?: string;
  notes?: string;
  order_index: number;
  created_at: string;
}

export interface ContentBlockRecord {
  id: string;
  project_id: string;
  content_type: string;
  content_id?: string;
  content_text: string;
  word_count: number;
  created_at: string;
  updated_at: string;
}

// Vector database types
export interface VectorEmbedding {
  id: string;
  project_id: string;
  content_type: 'story_content' | 'character_description' | 'scene_description' | 'plot_element';
  content_id: string;
  content_text: string;
  embedding_vector: number[];
  metadata: {
    word_count: number;
    section_type?: string;
    character_names?: string[];
    themes?: string[];
    timestamp: string;
  };
  created_at: string;
}

export interface SemanticSearchOptions {
  query: string;
  content_types?: string[];
  project_id?: string;
  similarity_threshold?: number;
  max_results?: number;
  metadata_filters?: Record<string, any>;
}

export interface SemanticSearchResult {
  id: string;
  content_text: string;
  content_type: string;
  similarity_score: number;
  metadata: Record<string, any>;
  source_id: string;
}

export interface EmbeddingBatch {
  id: string;
  texts: string[];
  content_ids: string[];
  content_type: string;
  project_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
  completed_at?: Date;
  error?: string;
}

// Database manager interfaces
export interface DatabaseManagerInterface {
  initialize(): Promise<void>;
  isConnected(): boolean;
  close(): Promise<void>;
  beginTransaction(): Promise<string>;
  commitTransaction(transactionId: string): Promise<void>;
  rollbackTransaction(transactionId: string): Promise<void>;
  getConnectionInfo(): { sqlite: boolean; lancedb: boolean };
}

export interface SQLiteManagerInterface extends DatabaseManagerInterface {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  run(sql: string, params?: any[]): Promise<{ lastInsertRowid: number; changes: number }>;
  prepare(sql: string): Promise<any>;
  executeScript(script: string): Promise<void>;
  backup(): Promise<Uint8Array>;
  restore(data: Uint8Array): Promise<void>;
  getStats?(): Promise<{ size: number; pageCount: number; pageSize: number }>;
}

export interface LanceDBManagerInterface extends DatabaseManagerInterface {
  insertEmbeddings(embeddings: VectorEmbedding[]): Promise<void>;
  search(query: number[], options: SemanticSearchOptions): Promise<SemanticSearchResult[]>;
  deleteEmbedding(id: string): Promise<void>;
  updateEmbedding(id: string, updates: Partial<VectorEmbedding>): Promise<void>;
  getEmbedding(id: string): Promise<VectorEmbedding | null>;
  createIndex(column: string): Promise<void>;
  optimize(): Promise<void>;
  getEmbeddingsByProject(projectId: string): Promise<VectorEmbedding[]>;
  deleteEmbeddingsByProject(projectId: string): Promise<void>;
  getTableStats(): Promise<{ count: number; size: number }>;
}

export interface SyncManagerInterface {
  syncContentToVector(contentId: string, contentType: string): Promise<void>;
  syncProjectEmbeddings(projectId: string): Promise<void>;
  validateDataIntegrity(): Promise<{ isValid: boolean; errors?: string[] }>;
  repairInconsistencies(): Promise<void>;
  getLastSyncTime(): Promise<Date | null>;
  deleteContentEmbedding(contentId: string, contentType: string): Promise<void>;
  deleteProjectEmbeddings(projectId: string): Promise<void>;
  getSyncStats(): Promise<{
    lastSync: Date | null;
    inProgress: boolean;
    totalEmbeddings: number;
  }>;
}

// Error types
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class SQLiteError extends DatabaseError {
  constructor(message: string, details?: any) {
    super(message, 'SQLITE_ERROR', details);
    this.name = 'SQLiteError';
  }
}

export class LanceDBError extends DatabaseError {
  constructor(message: string, details?: any) {
    super(message, 'LANCEDB_ERROR', details);
    this.name = 'LanceDBError';
  }
}

export class SyncError extends DatabaseError {
  constructor(message: string, details?: any) {
    super(message, 'SYNC_ERROR', details);
    this.name = 'SyncError';
  }
}

// Migration types
export interface MigrationScript {
  version: number;
  name: string;
  up: string;
  down: string;
  checksum: string;
}

export interface MigrationStatus {
  currentVersion: number;
  availableVersions: number[];
  pendingMigrations: MigrationScript[];
  appliedMigrations: AppliedMigration[];
}

export interface AppliedMigration {
  version: number;
  name: string;
  appliedAt: Date;
  checksum: string;
}

// Cache types
export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: Date;
  ttl?: number;
  accessCount: number;
  lastAccessed: Date;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  size: number;
  maxSize: number;
  evictions: number;
}