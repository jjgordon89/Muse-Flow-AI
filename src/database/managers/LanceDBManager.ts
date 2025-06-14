import lancedb from '@lancedb/lancedb';
import type { Table, Connection } from '@lancedb/lancedb';
import { 
  LanceDBManagerInterface, 
  LanceDBConnection, 
  VectorEmbedding,
  SemanticSearchOptions,
  SemanticSearchResult,
  DatabaseTransaction,
  LanceDBError,
  DatabaseConfig 
} from '../types/database-types';

export class LanceDBManager implements LanceDBManagerInterface {
  private connection: Connection | null = null;
  private table: Table | null = null;
  private lanceConnection: LanceDBConnection | null = null;
  private transactions: Map<string, DatabaseTransaction> = new Map();
  private isInitialized = false;
  private config: DatabaseConfig['lancedb'];

  constructor(config: DatabaseConfig['lancedb']) {
    this.config = {
      ...config,
      uri: config.uri || './lancedb',
      tableName: config.tableName || 'embeddings',
      dimensions: config.dimensions || 384
    };
  }
  async initialize(): Promise<void> {
    try {
      // Connect to LanceDB
      this.connection = await lancedb.connect(this.config.uri);
      
      // Create or open table
      await this.initializeTable();

      // Create connection object
      this.lanceConnection = {
        db: this.connection,
        table: this.table,
        isConnected: true,
        connectionId: this.generateConnectionId()
      };

      this.isInitialized = true;
      console.log('LanceDB initialized successfully');

    } catch (error) {
      console.error('Failed to initialize LanceDB:', error);
      throw new LanceDBError('Database initialization failed', error);
    }
  }

  private async initializeTable(): Promise<void> {
    if (!this.connection) {
      throw new LanceDBError('Connection not established');
    }

    try {
      // Check if table exists
      const tableNames = await this.connection.tableNames();
      
      if (tableNames.includes(this.config.tableName)) {
        // Open existing table
        this.table = await this.connection.openTable(this.config.tableName);
      } else {
        // Create new table with sample data to establish schema
        const sampleData = [{
          id: 'sample_id',
          project_id: 'sample_project',
          content_type: 'story_content' as const,
          content_id: 'sample_content',
          content_text: 'Sample text for schema initialization',
          embedding_vector: new Array(this.config.dimensions).fill(0),
          metadata: {
            word_count: 5,
            timestamp: new Date().toISOString()
          },
          created_at: new Date().toISOString()
        }];

        this.table = await this.connection.createTable(this.config.tableName, sampleData);
        
        // Remove sample data
        await this.table.delete("id = 'sample_id'");

        // Create indexes for better performance
        await this.createIndexes();
      }

    } catch (error) {
      throw new LanceDBError('Failed to initialize table', error);
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.table) return;

    try {
      // Create vector index for similarity search
      try {
        await this.table.createIndex('embedding_vector');
      } catch (error) {
        console.warn('Failed to create vector index:', error);
      }

      // Create indexes on metadata fields
      await this.createIndex('project_id');
      await this.createIndex('content_type');

    } catch (error) {
      console.warn('Failed to create some indexes:', error);
    }
  }

  async insertEmbeddings(embeddings: VectorEmbedding[]): Promise<void> {
    if (!this.isConnected()) {
      throw new LanceDBError('Database not connected');
    }

    try {
      // Validate embeddings
      this.validateEmbeddings(embeddings);

      // Convert to LanceDB format
      const data = embeddings.map(embedding => ({
        id: embedding.id,
        project_id: embedding.project_id,
        content_type: embedding.content_type,
        content_id: embedding.content_id,
        content_text: embedding.content_text,
        embedding_vector: embedding.embedding_vector,
        metadata: embedding.metadata,
        created_at: embedding.created_at
      }));

      await this.table!.add(data);

    } catch (error) {
      throw new LanceDBError('Failed to insert embeddings', error);
    }
  }
  async search(_query: number[], _options: SemanticSearchOptions): Promise<SemanticSearchResult[]> {
    if (!this.isConnected()) {
      throw new LanceDBError('Database not connected');
    }

    try {      // Validate query vector
      if (_query.length !== this.config.dimensions) {
        throw new LanceDBError(`Query vector must have ${this.config.dimensions} dimensions`);
      }

      // TODO: Update to new LanceDB API - the search method has changed
      console.warn('LanceDB search functionality needs to be updated to match current API');
      
      // Placeholder return for now
      return [];

      // Original code commented out until API is updated:
      /*
      // Build search query
      let searchQuery = this.table!
        .search(query)
        .limit(options.max_results || 50);

      // Apply filters
      if (options.project_id) {
        searchQuery = searchQuery.where(`project_id = '${options.project_id}'`);
      }

      if (options.content_types && options.content_types.length > 0) {
        const contentTypesFilter = options.content_types
          .map(type => `'${type}'`)
          .join(', ');
        searchQuery = searchQuery.where(`content_type IN (${contentTypesFilter})`);
      }

      if (options.metadata_filters) {
        for (const [key, value] of Object.entries(options.metadata_filters)) {
          if (typeof value === 'string') {
            searchQuery = searchQuery.where(`metadata.${key} = '${value}'`);
          } else if (typeof value === 'number') {
            searchQuery = searchQuery.where(`metadata.${key} = ${value}`);
          }
        }
      }

      // Execute search
      const results = await searchQuery.toArray();

      // Process and filter results
      return results
        .filter(result => {
          const score = result._distance ? (1 - result._distance) : 0;
          return score >= (options.similarity_threshold || 0.7);
        })
        .map(result => ({
          id: result.id,
          content_text: result.content_text,
          content_type: result.content_type,
          similarity_score: result._distance ? (1 - result._distance) : 0,
          metadata: result.metadata,
          source_id: result.content_id
        }))
        .sort((a, b) => b.similarity_score - a.similarity_score);
      */

    } catch (error) {
      throw new LanceDBError('Search failed', error);
    }
  }

  async deleteEmbedding(id: string): Promise<void> {
    if (!this.isConnected()) {
      throw new LanceDBError('Database not connected');
    }

    try {
      await this.table!.delete(`id = '${id}'`);
    } catch (error) {
      throw new LanceDBError('Failed to delete embedding', error);
    }
  }

  async updateEmbedding(id: string, updates: Partial<VectorEmbedding>): Promise<void> {
    if (!this.isConnected()) {
      throw new LanceDBError('Database not connected');
    }

    try {
      // LanceDB doesn't support direct updates, so we need to delete and re-insert
      const existing = await this.getEmbedding(id);
      if (!existing) {
        throw new LanceDBError('Embedding not found');
      }

      // Delete existing
      await this.deleteEmbedding(id);

      // Insert updated version
      const updated = { ...existing, ...updates };
      await this.insertEmbeddings([updated]);

    } catch (error) {
      throw new LanceDBError('Failed to update embedding', error);
    }
  }
  async getEmbedding(_id: string): Promise<VectorEmbedding | null> {
    if (!this.isConnected()) {
      throw new LanceDBError('Database not connected');
    }

    try {
      // TODO: Update to new LanceDB API
      console.warn('LanceDB getEmbedding functionality needs to be updated to match current API');
      
      // Placeholder return for now
      return null;

      // Original code commented out:
      /*
      const results = await this.table!
        .search([0]) // Dummy vector for filter-only query
        .where(\`id = '\${id}'\`)
        .limit(1)
        .toArray();

      if (results.length === 0) {
        return null;
      }

      const result = results[0];
      return {
        id: result.id,
        project_id: result.project_id,
        content_type: result.content_type,
        content_id: result.content_id,
        content_text: result.content_text,
        embedding_vector: result.embedding_vector,
        metadata: result.metadata,
        created_at: result.created_at
      };
      */

    } catch (error) {
      throw new LanceDBError('Failed to get embedding', error);
    }
  }

  async createIndex(column: string): Promise<void> {
    if (!this.table) {
      throw new LanceDBError('Table not initialized');
    }

    try {
      await this.table.createIndex(column);
    } catch (error) {
      console.warn(`Failed to create index on ${column}:`, error);
    }
  }
  async optimize(): Promise<void> {
    if (!this.table) {
      throw new LanceDBError('Table not initialized');
    }

    try {
      // TODO: Update to new LanceDB API - optimize method may have changed
      console.warn('LanceDB optimize functionality needs to be updated to match current API');
      
      // Placeholder - optimization skipped for now
      // await this.table.optimize();
    } catch (error) {
      throw new LanceDBError('Failed to optimize table', error);
    }
  }

  async beginTransaction(): Promise<string> {
    // LanceDB doesn't support transactions in the traditional sense
    // We'll simulate them by tracking operations
    const transactionId = this.generateTransactionId();
    
    const transaction: DatabaseTransaction = {
      id: transactionId,
      type: 'lancedb',
      startTime: new Date(),
      operations: [],
      status: 'pending'
    };
    
    this.transactions.set(transactionId, transaction);
    return transactionId;
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new LanceDBError('Transaction not found');
    }

    try {
      // In LanceDB, operations are immediately committed
      // We just need to mark the transaction as completed
      transaction.status = 'committed';
      this.transactions.delete(transactionId);
      
    } catch (error) {
      transaction.status = 'rolled_back';
      throw new LanceDBError('Failed to commit transaction', error);
    }
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new LanceDBError('Transaction not found');
    }

    try {
      // For LanceDB, we can't really rollback operations
      // This is a limitation of the append-only nature
      console.warn('LanceDB rollback requested but not fully supported');
      transaction.status = 'rolled_back';
      this.transactions.delete(transactionId);
      
    } catch (error) {
      throw new LanceDBError('Failed to rollback transaction', error);
    }
  }

  isConnected(): boolean {
    return this.isInitialized && 
           this.lanceConnection?.isConnected === true && 
           this.connection !== null && 
           this.table !== null;
  }

  getConnectionInfo(): { sqlite: boolean; lancedb: boolean } {
    return { sqlite: false, lancedb: this.isConnected() };
  }

  async close(): Promise<void> {
    try {
      // Mark all pending transactions as rolled back
      for (const [transactionId] of this.transactions) {
        try {
          await this.rollbackTransaction(transactionId);
        } catch (error) {
          console.warn(`Failed to rollback transaction ${transactionId}:`, error);
        }
      }

      // Close connections
      this.table = null;
      this.connection = null;
      this.lanceConnection = null;
      this.isInitialized = false;
      this.transactions.clear();

    } catch (error) {
      console.error('Error closing LanceDB:', error);
      throw new LanceDBError('Failed to close database', error);
    }
  }

  // Utility methods
  private validateEmbeddings(embeddings: VectorEmbedding[]): void {
    for (const embedding of embeddings) {
      if (!embedding.id || !embedding.project_id || !embedding.content_text) {
        throw new LanceDBError('Invalid embedding: missing required fields');
      }

      if (!Array.isArray(embedding.embedding_vector)) {
        throw new LanceDBError('Invalid embedding: embedding_vector must be an array');
      }

      if (embedding.embedding_vector.length !== this.config.dimensions) {
        throw new LanceDBError(
          `Invalid embedding: vector must have ${this.config.dimensions} dimensions`
        );
      }

      // Validate vector values are numbers
      if (!embedding.embedding_vector.every(val => typeof val === 'number' && !isNaN(val))) {
        throw new LanceDBError('Invalid embedding: vector contains non-numeric values');
      }
    }
  }

  private generateConnectionId(): string {
    return `lancedb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTransactionId(): string {
    return `lance_txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  // Additional utility methods for vector operations
  async getEmbeddingsByProject(_projectId: string): Promise<VectorEmbedding[]> {
    if (!this.isConnected()) {
      throw new LanceDBError('Database not connected');
    }

    try {
      // TODO: Update to new LanceDB API
      console.warn('LanceDB getEmbeddingsByProject functionality needs to be updated to match current API');
      
      // Placeholder return for now
      return [];

      // Original code commented out:
      /*
      const results = await this.table!
        .search([0]) // Dummy vector for filter-only query
        .where(\`project_id = '\${projectId}'\`)
        .toArray();

      return results.map((result: any) => ({
        id: result.id,
        project_id: result.project_id,
        content_type: result.content_type,
        content_id: result.content_id,
        content_text: result.content_text,
        embedding_vector: result.embedding_vector,
        metadata: result.metadata,
        created_at: result.created_at
      }));
      */

    } catch (error) {
      throw new LanceDBError('Failed to get embeddings by project', error);
    }
  }

  async deleteEmbeddingsByProject(projectId: string): Promise<void> {
    if (!this.isConnected()) {
      throw new LanceDBError('Database not connected');
    }

    try {
      await this.table!.delete(`project_id = '${projectId}'`);
    } catch (error) {
      throw new LanceDBError('Failed to delete project embeddings', error);
    }
  }

  async getTableStats(): Promise<{ count: number; size: number }> {
    if (!this.table) {
      throw new LanceDBError('Table not initialized');
    }

    try {
      const stats = await this.table.countRows();
      return {
        count: stats,
        size: 0 // LanceDB doesn't provide size info easily
      };
    } catch (error) {
      throw new LanceDBError('Failed to get table stats', error);
    }
  }

  async findSimilarContent(
    contentId: string, 
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<SemanticSearchResult[]> {
    // Get the embedding for the given content
    const sourceEmbedding = await this.getEmbedding(contentId);
    if (!sourceEmbedding) {
      throw new LanceDBError('Source content not found');
    }

    // Search for similar content
    return this.search(sourceEmbedding.embedding_vector, {
      query: '', // Not used in this context
      max_results: limit + 1, // +1 to account for the source itself
      similarity_threshold: threshold,
      project_id: sourceEmbedding.project_id
    }).then(results => 
      // Filter out the source content itself
      results.filter(result => result.id !== contentId)
    );
  }
}