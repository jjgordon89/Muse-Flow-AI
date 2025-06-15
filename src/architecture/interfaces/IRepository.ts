/**
 * Generic Repository Interface
 * Provides a contract for data access operations
 */
export interface IRepository<T, K = string> {
  findById(id: K): Promise<T | null>;
  findAll(filters?: Record<string, any>): Promise<T[]>;
  create(entity: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>;
  update(id: K, updates: Partial<T>): Promise<T>;
  delete(id: K): Promise<void>;
  exists(id: K): Promise<boolean>;
  count(filters?: Record<string, any>): Promise<number>;
}

/**
 * Repository with batch operations
 */
export interface IBatchRepository<T, K = string> extends IRepository<T, K> {
  createMany(entities: Omit<T, 'id' | 'created_at' | 'updated_at'>[]): Promise<T[]>;
  updateMany(updates: { id: K; data: Partial<T> }[]): Promise<T[]>;
  deleteMany(ids: K[]): Promise<void>;
}

/**
 * Repository with search capabilities
 */
export interface ISearchableRepository<T, K = string> extends IRepository<T, K> {
  search(query: string, options?: SearchOptions): Promise<SearchResult<T>[]>;
  searchByField(field: keyof T, value: any): Promise<T[]>;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  highlights?: Record<string, string[]>;
}