import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { 
  SQLiteManagerInterface, 
  SQLiteConnection, 
  DatabaseTransaction,
  SQLiteError,
  DatabaseConfig 
} from '../types/database-types';

export class SQLiteManager implements SQLiteManagerInterface {
  private sql: SqlJsStatic | null = null;
  private db: Database | null = null;
  private connection: SQLiteConnection | null = null;
  private transactions: Map<string, DatabaseTransaction> = new Map();
  private isInitialized = false;
  private config: DatabaseConfig['sqlite'];

  constructor(config: DatabaseConfig['sqlite']) {
    this.config = {
      ...config,
      filename: config.filename || 'muse-flow.db',
      enableWAL: config.enableWAL !== undefined ? config.enableWAL : true,
      cacheSize: config.cacheSize || 10000,
      busyTimeout: config.busyTimeout || 30000
    };
  }

  async initialize(): Promise<void> {
    try {
      // Initialize sql.js with WebAssembly
      this.sql = await initSqlJs({
        locateFile: (file: string) => {
          // Use CDN or local path for WASM files
          return `https://sql.js.org/dist/${file}`;
        }
      });

      // Try to load existing database from storage
      const existingData = await this.loadFromStorage();
      
      if (existingData) {
        this.db = new this.sql.Database(existingData);
      } else {
        this.db = new this.sql.Database();
        await this.initializeSchema();
      }

      // Configure database settings
      await this.configureDatabase();

      // Create connection object
      this.connection = {
        db: this.db,
        isConnected: true,
        connectionId: this.generateConnectionId()
      };

      // Verify database integrity
      await this.verifyIntegrity();

      this.isInitialized = true;
      console.log('SQLite database initialized successfully');

    } catch (error) {
      console.error('Failed to initialize SQLite database:', error);
      throw new SQLiteError('Database initialization failed', error);
    }
  }

  async initializeSchema(): Promise<void> {
    if (!this.db) throw new SQLiteError('Database not initialized');

    try {
      // Load and execute schema
      const schemaResponse = await fetch('/src/database/schemas/sqlite-schema.sql');
      const schema = await schemaResponse.text();
      
      this.db.exec(schema);
      
      // Save to storage after schema creation
      await this.saveToStorage();
      
    } catch (error) {
      throw new SQLiteError('Failed to initialize database schema', error);
    }
  }

  private async configureDatabase(): Promise<void> {
    if (!this.db) return;

    try {
      // Enable WAL mode for better concurrency
      if (this.config.enableWAL) {
        this.db.exec('PRAGMA journal_mode = WAL;');
      }

      // Set cache size
      this.db.exec(`PRAGMA cache_size = ${this.config.cacheSize};`);

      // Set busy timeout
      this.db.exec(`PRAGMA busy_timeout = ${this.config.busyTimeout};`);

      // Enable foreign key constraints
      this.db.exec('PRAGMA foreign_keys = ON;');

      // Optimize for speed
      this.db.exec('PRAGMA synchronous = NORMAL;');
      this.db.exec('PRAGMA temp_store = MEMORY;');
      this.db.exec('PRAGMA mmap_size = 268435456;'); // 256MB

    } catch (error) {
      console.warn('Failed to configure database settings:', error);
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.isConnected()) {
      throw new SQLiteError('Database not connected');
    }

    try {
      const startTime = performance.now();
      const stmt = this.db!.prepare(sql);
      const results: T[] = [];

      if (params) {
        stmt.bind(params);
      }

      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(row as T);
      }

      stmt.free();

      const executionTime = performance.now() - startTime;
      await this.logQueryPerformance(sql, executionTime, params);

      return results;

    } catch (error) {
      throw new SQLiteError(`Query execution failed: ${sql}`, error);
    }
  }

  async run(sql: string, params?: any[]): Promise<{ lastInsertRowid: number; changes: number }> {
    if (!this.isConnected()) {
      throw new SQLiteError('Database not connected');
    }

    try {
      const startTime = performance.now();
      
      if (params) {
        const stmt = this.db!.prepare(sql);
        stmt.run(params);
        stmt.free();
      } else {
        this.db!.run(sql);
      }

      const executionTime = performance.now() - startTime;
      await this.logQueryPerformance(sql, executionTime, params);

      // Get last insert rowid and changes count
      const lastInsertRowid = this.db!.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] as number || 0;
      const changes = this.db!.getRowsModified();

      // Auto-save to storage after modifications
      await this.saveToStorage();

      return { lastInsertRowid, changes };

    } catch (error) {
      throw new SQLiteError(`Run execution failed: ${sql}`, error);
    }
  }

  async prepare(sql: string): Promise<any> {
    if (!this.isConnected()) {
      throw new SQLiteError('Database not connected');
    }

    try {
      return this.db!.prepare(sql);
    } catch (error) {
      throw new SQLiteError(`Failed to prepare statement: ${sql}`, error);
    }
  }

  async executeScript(script: string): Promise<void> {
    if (!this.isConnected()) {
      throw new SQLiteError('Database not connected');
    }

    try {
      this.db!.exec(script);
      await this.saveToStorage();
    } catch (error) {
      throw new SQLiteError('Script execution failed', error);
    }
  }

  async beginTransaction(): Promise<string> {
    const transactionId = this.generateTransactionId();
    
    try {
      await this.run('BEGIN TRANSACTION');
      
      const transaction: DatabaseTransaction = {
        id: transactionId,
        type: 'sqlite',
        startTime: new Date(),
        operations: [],
        status: 'pending'
      };
      
      this.transactions.set(transactionId, transaction);
      return transactionId;
      
    } catch (error) {
      throw new SQLiteError('Failed to begin transaction', error);
    }
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new SQLiteError('Transaction not found');
    }

    try {
      await this.run('COMMIT');
      transaction.status = 'committed';
      this.transactions.delete(transactionId);
      
    } catch (error) {
      transaction.status = 'rolled_back';
      throw new SQLiteError('Failed to commit transaction', error);
    }
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new SQLiteError('Transaction not found');
    }

    try {
      await this.run('ROLLBACK');
      transaction.status = 'rolled_back';
      this.transactions.delete(transactionId);
      
    } catch (error) {
      throw new SQLiteError('Failed to rollback transaction', error);
    }
  }

  async backup(): Promise<Uint8Array> {
    if (!this.db) {
      throw new SQLiteError('Database not initialized');
    }

    try {
      return this.db.export();
    } catch (error) {
      throw new SQLiteError('Backup failed', error);
    }
  }

  async restore(data: Uint8Array): Promise<void> {
    try {
      if (!this.sql) {
        throw new SQLiteError('SQL.js not initialized');
      }

      // Close current database
      if (this.db) {
        this.db.close();
      }

      // Create new database from backup data
      this.db = new this.sql.Database(data);
      
      // Update connection
      if (this.connection) {
        this.connection.db = this.db;
        this.connection.isConnected = true;
      }

      // Configure database
      await this.configureDatabase();
      
      // Save to storage
      await this.saveToStorage();

    } catch (error) {
      throw new SQLiteError('Restore failed', error);
    }
  }

  isConnected(): boolean {
    return this.isInitialized && this.connection?.isConnected === true && this.db !== null;
  }

  getConnectionInfo(): { sqlite: boolean; lancedb: boolean } {
    return { sqlite: this.isConnected(), lancedb: false };
  }

  async close(): Promise<void> {
    try {
      // Rollback any pending transactions
      for (const [transactionId] of this.transactions) {
        try {
          await this.rollbackTransaction(transactionId);
        } catch (error) {
          console.warn(`Failed to rollback transaction ${transactionId}:`, error);
        }
      }

      // Save final state
      if (this.db && this.isConnected()) {
        await this.saveToStorage();
        this.db.close();
      }

      // Reset state
      this.db = null;
      this.connection = null;
      this.isInitialized = false;
      this.transactions.clear();

    } catch (error) {
      console.error('Error closing database:', error);
      throw new SQLiteError('Failed to close database', error);
    }
  }

  // Storage operations using IndexedDB
  private async loadFromStorage(): Promise<Uint8Array | null> {
    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('MuseFlowDB', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('sqlite')) {
            db.createObjectStore('sqlite');
          }
        };
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['sqlite'], 'readonly');
          const store = transaction.objectStore('sqlite');
          const getRequest = store.get(this.config.filename);
          
          getRequest.onsuccess = () => {
            resolve(getRequest.result || null);
          };
          
          getRequest.onerror = () => reject(getRequest.error);
        };
      });
    } catch (error) {
      console.warn('Failed to load database from storage:', error);
      return null;
    }
  }

  private async saveToStorage(): Promise<void> {
    if (!this.db) return;

    try {
      const data = this.db.export();
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('MuseFlowDB', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('sqlite')) {
            db.createObjectStore('sqlite');
          }
        };
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['sqlite'], 'readwrite');
          const store = transaction.objectStore('sqlite');
          const putRequest = store.put(data, this.config.filename);
          
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        };
      });
    } catch (error) {
      console.warn('Failed to save database to storage:', error);
    }
  }

  private async verifyIntegrity(): Promise<void> {
    try {
      const result = await this.query('PRAGMA integrity_check');
      if (result[0]?.integrity_check !== 'ok') {
        console.warn('Database integrity check failed:', result);
      }
    } catch (error) {
      console.warn('Failed to verify database integrity:', error);
    }
  }

  private async logQueryPerformance(sql: string, executionTime: number, params?: any[]): Promise<void> {
    // Only log slow queries in development
    if (process.env['NODE_ENV'] === 'development' && executionTime > 100) {
      console.warn(`Slow query detected (${executionTime.toFixed(2)}ms):`, {
        sql: sql.substring(0, 100),
        params: params?.slice(0, 5) // Limit logged params
      });
    }

    // Store performance data for analysis (async, don't wait)
    try {
      const queryType = sql.trim().split(' ')[0]?.toUpperCase() || 'UNKNOWN';
      await this.run(
        'INSERT INTO query_performance (id, query_type, execution_time_ms, parameters) VALUES (?, ?, ?, ?)',
        [
          this.generateId(),
          queryType,
          Math.round(executionTime),
          JSON.stringify(params?.slice(0, 5) || null)
        ]
      );
    } catch (error) {
      // Ignore performance logging errors
    }
  }

  private generateConnectionId(): string {
    return `sqlite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Utility methods for database operations
  async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
      );
      return result.length > 0;
    } catch (error) {
      return false;
    }
  }

  async getTableInfo(tableName: string): Promise<any[]> {
    return this.query(`PRAGMA table_info(${tableName})`);
  }

  async vacuum(): Promise<void> {
    await this.run('VACUUM');
  }

  async analyze(): Promise<void> {
    await this.run('ANALYZE');
  }

  async getStats(): Promise<{ size: number; pageCount: number; pageSize: number }> {
    const pageSizeResult = await this.query('PRAGMA page_size');
    const pageCountResult = await this.query('PRAGMA page_count');
    
    const pageSize = pageSizeResult[0]?.page_size || 0;
    const pageCount = pageCountResult[0]?.page_count || 0;
    
    return {
      size: pageSize * pageCount,
      pageCount,
      pageSize
    };
  }
}