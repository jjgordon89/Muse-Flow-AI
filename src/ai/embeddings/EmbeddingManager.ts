import { 
  EmbeddingProvider, 
  EmbeddingServiceConfig,
  EmbeddingJob,
  EmbeddingCache,
  EmbeddingMetrics,
  EmbeddingError,
  EmbeddingGenerationError,
  EmbeddingPerformanceStats
} from '../types/embedding-types';
import { ONNXEmbeddingProvider } from './providers/ONNXEmbeddingProvider';
import { EmbeddingGenerator } from '../../database/managers/SyncManager';

export class EmbeddingManager implements EmbeddingGenerator {
  private providers: Map<string, EmbeddingProvider> = new Map();
  private primaryProvider: EmbeddingProvider | null = null;
  private fallbackProviders: EmbeddingProvider[] = [];
  private config: EmbeddingServiceConfig;
  private cache: EmbeddingCache;
  private metrics: EmbeddingMetrics;
  private jobs: Map<string, EmbeddingJob> = new Map();
  private isInitialized = false;

  constructor(config: Partial<EmbeddingServiceConfig> = {}) {
    this.config = {
      primaryProvider: 'onnx-minilm',
      fallbackProviders: [],
      cacheConfig: {
        maxSize: 10000,
        ttlSeconds: 86400, // 24 hours
        persistToDisk: true
      },
      chunkingConfig: {
        maxTokens: 512,
        overlap: 50,
        separators: ['\n\n', '\n', '. ', '! ', '? '],
        preserveSentences: true,
        minChunkSize: 50
      },
      batchConfig: {
        maxBatchSize: 32,
        batchTimeoutMs: 30000,
        maxConcurrentBatches: 2
      },
      retryConfig: {
        maxRetries: 3,
        backoffMs: 1000,
        exponentialBackoff: true
      },
      ...config
    };

    this.cache = new EmbeddingCacheImpl(this.config.cacheConfig);
    this.metrics = this.initializeMetrics();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing EmbeddingManager...');

      // Initialize default local provider
      await this.initializeDefaultProviders();

      // Set up primary and fallback providers
      await this.configurePrimaryProvider();

      this.isInitialized = true;
      console.log('EmbeddingManager initialized successfully');

    } catch (error) {
      console.error('Failed to initialize EmbeddingManager:', error);
      throw new EmbeddingError(
        'EmbeddingManager initialization failed',
        'INIT_ERROR',
        undefined,
        error
      );
    }
  }

  private async initializeDefaultProviders(): Promise<void> {
    // Initialize ONNX providers for different models
    const onnxProviders = [
      { name: 'onnx-minilm', model: 'all-MiniLM-L6-v2' },
      { name: 'onnx-mpnet', model: 'all-mpnet-base-v2' },
      { name: 'onnx-multilingual', model: 'paraphrase-multilingual-MiniLM-L12-v2' }
    ];

    for (const { name, model } of onnxProviders) {
      try {
        const provider = new ONNXEmbeddingProvider(model);
        if (provider.isAvailable()) {
          this.providers.set(name, provider);
          console.log(`Registered provider: ${name}`);
        }
      } catch (error) {
        console.warn(`Failed to register provider ${name}:`, error);
      }
    }
  }

  private async configurePrimaryProvider(): Promise<void> {
    const primaryProviderName = this.config.primaryProvider;
    const provider = this.providers.get(primaryProviderName);

    if (!provider) {
      throw new EmbeddingError(
        `Primary provider not found: ${primaryProviderName}`,
        'PROVIDER_NOT_FOUND'
      );
    }

    if (!provider.isAvailable()) {
      throw new EmbeddingError(
        `Primary provider not available: ${primaryProviderName}`,
        'PROVIDER_UNAVAILABLE'
      );
    }

    try {
      await provider.initialize?.();
      this.primaryProvider = provider;
    } catch (error) {
      throw new EmbeddingError(
        `Failed to initialize primary provider: ${primaryProviderName}`,
        'PROVIDER_INIT_ERROR',
        primaryProviderName,
        error
      );
    }

    // Initialize fallback providers
    for (const fallbackName of this.config.fallbackProviders) {
      const fallbackProvider = this.providers.get(fallbackName);
      if (fallbackProvider && fallbackProvider.isAvailable()) {
        try {
          await fallbackProvider.initialize?.();
          this.fallbackProviders.push(fallbackProvider);
        } catch (error) {
          console.warn(`Failed to initialize fallback provider ${fallbackName}:`, error);
        }
      }
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (texts.length === 0) {
      return [];
    }

    const startTime = Date.now();

    try {
      // Check cache first
      const cacheResults = this.checkCache(texts);
      const uncachedTexts = texts.filter((_, index) => !cacheResults[index]);
      const uncachedIndices = texts.map((_, index) => index).filter(index => !cacheResults[index]);

      let newEmbeddings: number[][] = [];

      // Generate embeddings for uncached texts
      if (uncachedTexts.length > 0) {
        newEmbeddings = await this.generateWithRetry(uncachedTexts);
        
        // Cache new embeddings
        uncachedTexts.forEach((text, i) => {
          const embedding = newEmbeddings[i];
          if (embedding) {
            this.cache.set(this.getCacheKey(text), embedding);
          }
        });
      }

      // Combine cached and new embeddings
      const results: number[][] = new Array(texts.length);
      let newEmbeddingIndex = 0;

      for (let i = 0; i < texts.length; i++) {
        if (cacheResults[i]) {
          results[i] = cacheResults[i]!;
        } else {
          results[i] = newEmbeddings[newEmbeddingIndex++] || [];
        }
      }

      // Update metrics
      const endTime = Date.now();
      this.updateMetrics(texts.length, endTime - startTime, cacheResults.filter(Boolean).length);

      return results;

    } catch (error) {
      console.error('Failed to generate embeddings:', error);
      throw new EmbeddingGenerationError(
        `Failed to generate embeddings: ${error instanceof Error ? error.message : error}`,
        this.primaryProvider?.name || 'unknown'
      );
    }
  }

  private checkCache(texts: string[]): Array<number[] | null> {
    return texts.map(text => {
      const cacheKey = this.getCacheKey(text);
      return this.cache.has(cacheKey) ? this.cache.get(cacheKey) : null;
    });
  }

  private async generateWithRetry(texts: string[]): Promise<number[][]> {
    let lastError: Error | null = null;
    
    // Try primary provider first
    if (this.primaryProvider) {
      for (let attempt = 0; attempt <= this.config.retryConfig.maxRetries; attempt++) {
        try {
          return await this.generateWithProvider(this.primaryProvider, texts);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (attempt < this.config.retryConfig.maxRetries) {
            const delay = this.calculateBackoff(attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }

    // Try fallback providers
    for (const provider of this.fallbackProviders) {
      try {
        console.log(`Trying fallback provider: ${provider.name}`);
        return await this.generateWithProvider(provider, texts);
      } catch (error) {
        console.warn(`Fallback provider ${provider.name} failed:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError || new EmbeddingGenerationError(
      'All providers failed to generate embeddings',
      'all'
    );
  }

  private async generateWithProvider(provider: EmbeddingProvider, texts: string[]): Promise<number[][]> {
    const batchSize = Math.min(provider.getMaxBatchSize(), this.config.batchConfig.maxBatchSize);
    const results: number[][] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      // Add timeout
      const batchPromise = provider.generateEmbeddings(batch);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Batch timeout')), this.config.batchConfig.batchTimeoutMs);
      });

      const batchResults = await Promise.race([batchPromise, timeoutPromise]);
      results.push(...batchResults);
    }

    return results;
  }

  private calculateBackoff(attempt: number): number {
    const baseDelay = this.config.retryConfig.backoffMs;
    
    if (this.config.retryConfig.exponentialBackoff) {
      return baseDelay * Math.pow(2, attempt);
    }
    
    return baseDelay;
  }

  getDimensions(): number {
    if (!this.primaryProvider) {
      throw new EmbeddingError('No primary provider available', 'NO_PROVIDER');
    }
    return this.primaryProvider.getDimensions();
  }

  // Provider management
  async addProvider(name: string, provider: EmbeddingProvider): Promise<void> {
    if (provider.isAvailable()) {
      await provider.initialize?.();
      this.providers.set(name, provider);
      console.log(`Added provider: ${name}`);
    } else {
      throw new EmbeddingError(`Provider not available: ${name}`, 'PROVIDER_UNAVAILABLE');
    }
  }

  removeProvider(name: string): void {
    const provider = this.providers.get(name);
    if (provider) {
      provider.close?.();
      this.providers.delete(name);
      console.log(`Removed provider: ${name}`);
    }
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys()).filter(name => {
      const provider = this.providers.get(name);
      return provider?.isAvailable() || false;
    });
  }

  async switchPrimaryProvider(providerName: string): Promise<void> {
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new EmbeddingError(`Provider not found: ${providerName}`, 'PROVIDER_NOT_FOUND');
    }

    if (!provider.isAvailable()) {
      throw new EmbeddingError(`Provider not available: ${providerName}`, 'PROVIDER_UNAVAILABLE');
    }

    try {
      await provider.initialize?.();
      this.primaryProvider = provider;
      this.config.primaryProvider = providerName;
      console.log(`Switched to primary provider: ${providerName}`);
    } catch (error) {
      throw new EmbeddingError(
        `Failed to switch to provider: ${providerName}`,
        'PROVIDER_SWITCH_ERROR',
        providerName,
        error
      );
    }
  }

  // Cache management
  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): any {
    return this.cache.getStats();
  }

  // Metrics and monitoring
  getMetrics(): EmbeddingMetrics {
    return { ...this.metrics };
  }

  getPerformanceStats(): EmbeddingPerformanceStats {
    const cacheStats = this.cache.getStats();
    return {
      providers: this.getProviderMetrics(),
      cache: {
        hitRate: cacheStats.hitRate,
        missRate: 1 - cacheStats.hitRate,
        totalHits: cacheStats.hits,
        totalMisses: cacheStats.misses,
        evictions: 0
      },
      global: {
        totalEmbeddingsGenerated: this.metrics.totalGenerated,
        totalTextsProcessed: this.metrics.totalGenerated + this.metrics.totalCached,
        averageEmbeddingTime: this.metrics.averageGenerationTime,
        peakMemoryUsage: this.getPeakMemoryUsage(),
        uptime: Date.now() - this.metrics.lastUpdated.getTime()
      }
    };
  }

  private getProviderMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    for (const [name, provider] of this.providers) {
      metrics[name] = {
        name: provider.name,
        totalRequests: this.metrics.providerUsage[name] || 0,
        successfulRequests: this.metrics.providerUsage[name] || 0,
        failedRequests: 0,
        averageLatency: this.metrics.averageGenerationTime,
        lastUsed: this.metrics.lastUpdated,
        totalTokensProcessed: 0
      };
    }
    
    return metrics;
  }

  private getPeakMemoryUsage(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  // Utility methods
  private getCacheKey(text: string): string {
    // Create a simple hash of the text for caching
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `emb_${Math.abs(hash)}`;
  }

  private updateMetrics(textCount: number, duration: number, cacheHits: number): void {
    const newGenerations = textCount - cacheHits;
    
    this.metrics.totalGenerated += newGenerations;
    this.metrics.totalCached += cacheHits;
    
    // Update average generation time
    if (newGenerations > 0) {
      const currentTotal = this.metrics.averageGenerationTime * (this.metrics.totalGenerated - newGenerations);
      this.metrics.averageGenerationTime = (currentTotal + duration) / this.metrics.totalGenerated;
    }
    
    // Update cache hit rate
    const totalRequests = this.metrics.totalGenerated + this.metrics.totalCached;
    this.metrics.cacheHitRate = totalRequests > 0 ? this.metrics.totalCached / totalRequests : 0;
    
    this.metrics.lastUpdated = new Date();
  }

  private initializeMetrics(): EmbeddingMetrics {
    return {
      totalGenerated: 0,
      totalCached: 0,
      averageGenerationTime: 0,
      cacheHitRate: 0,
      providerUsage: {},
      errorRate: 0,
      lastUpdated: new Date()
    };
  }

  async close(): Promise<void> {
    console.log('Closing EmbeddingManager...');
    
    // Close all providers
    for (const provider of this.providers.values()) {
      try {
        await provider.close?.();
      } catch (error) {
        console.warn('Error closing provider:', error);
      }
    }
    
    this.providers.clear();
    this.primaryProvider = null;
    this.fallbackProviders = [];
    this.isInitialized = false;
  }
}

// Simple in-memory cache implementation
class EmbeddingCacheImpl implements EmbeddingCache {
  private cache = new Map<string, { value: number[]; timestamp: number; ttl?: number }>();
  private stats = { hits: 0, misses: 0 };
  private maxSize: number;
  private defaultTtl: number;

  constructor(config: { maxSize: number; ttlSeconds: number }) {
    this.maxSize = config.maxSize;
    this.defaultTtl = config.ttlSeconds * 1000; // Convert to milliseconds
  }

  get(key: string): number[] | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (entry.ttl && Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value;
  }

  set(key: string, embedding: number[], ttl?: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value: embedding,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): any {
    const total = this.stats.hits + this.stats.misses;
    return {
      hitRate: total > 0 ? this.stats.hits / total : 0,
      missRate: total > 0 ? this.stats.misses / total : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      evictions: 0, // We don't track evictions in this simple implementation
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}