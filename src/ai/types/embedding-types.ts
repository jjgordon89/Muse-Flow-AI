export interface EmbeddingProvider {
  name: string;
  type: 'local' | 'api';
  isAvailable(): boolean;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
  getMaxBatchSize(): number;
  initialize?(): Promise<void>;
  close?(): Promise<void>;
}

export interface EmbeddingModel {
  name: string;
  dimensions: number;
  maxTokens: number;
  size: number; // Model size in MB
  url?: string; // URL for downloading model
  localPath?: string; // Local path for cached model
}

export interface ONNXModelConfig {
  modelName: string;
  modelUrl: string;
  tokenizerUrl: string;
  dimensions: number;
  maxLength: number;
  mean_pooling: boolean;
  normalize: boolean;
}

export interface EmbeddingJob {
  id: string;
  texts: string[];
  contentIds: string[];
  contentType: string;
  projectId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  results?: number[][];
}

export interface EmbeddingCache {
  get(key: string): number[] | null;
  set(key: string, embedding: number[], ttl?: number): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  size(): number;
  getStats(): {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    maxSize: number;
  };
}

export interface TextChunk {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  tokens: number;
  metadata?: Record<string, any>;
}

export interface ChunkingOptions {
  maxTokens: number;
  overlap: number;
  separators: string[];
  preserveSentences: boolean;
  minChunkSize: number;
}

export interface EmbeddingMetrics {
  totalGenerated: number;
  totalCached: number;
  averageGenerationTime: number;
  cacheHitRate: number;
  providerUsage: Record<string, number>;
  errorRate: number;
  lastUpdated: Date;
}

export interface EmbeddingServiceConfig {
  primaryProvider: string;
  fallbackProviders: string[];
  cacheConfig: {
    maxSize: number;
    ttlSeconds: number;
    persistToDisk: boolean;
  };
  chunkingConfig: ChunkingOptions;
  batchConfig: {
    maxBatchSize: number;
    batchTimeoutMs: number;
    maxConcurrentBatches: number;
  };
  retryConfig: {
    maxRetries: number;
    backoffMs: number;
    exponentialBackoff: boolean;
  };
}

export class EmbeddingError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

export class ModelLoadError extends EmbeddingError {
  constructor(message: string, modelName: string, details?: any) {
    super(message, 'MODEL_LOAD_ERROR', modelName, details);
    this.name = 'ModelLoadError';
  }
}

export class EmbeddingGenerationError extends EmbeddingError {
  constructor(message: string, provider: string, details?: any) {
    super(message, 'GENERATION_ERROR', provider, details);
    this.name = 'EmbeddingGenerationError';
  }
}

// Built-in model configurations
export const BUILTIN_MODELS: Record<string, ONNXModelConfig> = {
  'all-MiniLM-L6-v2': {
    modelName: 'all-MiniLM-L6-v2',
    modelUrl: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx',
    tokenizerUrl: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json',
    dimensions: 384,
    maxLength: 256,
    mean_pooling: true,
    normalize: true
  },
  'all-mpnet-base-v2': {
    modelName: 'all-mpnet-base-v2',
    modelUrl: 'https://huggingface.co/Xenova/all-mpnet-base-v2/resolve/main/onnx/model.onnx',
    tokenizerUrl: 'https://huggingface.co/Xenova/all-mpnet-base-v2/resolve/main/tokenizer.json',
    dimensions: 768,
    maxLength: 384,
    mean_pooling: true,
    normalize: true
  },
  'paraphrase-multilingual-MiniLM-L12-v2': {
    modelName: 'paraphrase-multilingual-MiniLM-L12-v2',
    modelUrl: 'https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2/resolve/main/onnx/model.onnx',
    tokenizerUrl: 'https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2/resolve/main/tokenizer.json',
    dimensions: 384,
    maxLength: 128,
    mean_pooling: true,
    normalize: true
  }
};

// API Provider configurations
export interface APIProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  dimensions: number;
  maxBatchSize: number;
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export const API_PROVIDERS: Record<string, Omit<APIProviderConfig, 'apiKey'>> = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    maxBatchSize: 100,
    rateLimit: {
      requestsPerMinute: 3000,
      tokensPerMinute: 1000000
    }
  },
  'openai-large': {
    name: 'OpenAI Large',
    baseUrl: 'https://api.openai.com/v1',
    model: 'text-embedding-3-large',
    dimensions: 3072,
    maxBatchSize: 100,
    rateLimit: {
      requestsPerMinute: 3000,
      tokensPerMinute: 1000000
    }
  },
  cohere: {
    name: 'Cohere',
    baseUrl: 'https://api.cohere.ai/v1',
    model: 'embed-english-v3.0',
    dimensions: 1024,
    maxBatchSize: 96,
    rateLimit: {
      requestsPerMinute: 10000,
      tokensPerMinute: 1000000
    }
  }
};

// Utility types for embedding operations
export type EmbeddingVector = number[];
export type EmbeddingMatrix = number[][];

export interface SimilarityResult {
  index: number;
  score: number;
  content?: any;
}

export interface ClusterResult {
  clusterId: number;
  centroid: EmbeddingVector;
  members: number[];
  similarity: number;
}

// Performance monitoring types
export interface ProviderMetrics {
  name: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  lastUsed: Date;
  totalTokensProcessed: number;
  totalCost?: number;
}

export interface EmbeddingPerformanceStats {
  providers: Record<string, ProviderMetrics>;
  cache: {
    hitRate: number;
    missRate: number;
    totalHits: number;
    totalMisses: number;
    evictions: number;
  };
  global: {
    totalEmbeddingsGenerated: number;
    totalTextsProcessed: number;
    averageEmbeddingTime: number;
    peakMemoryUsage: number;
    uptime: number;
  };
}