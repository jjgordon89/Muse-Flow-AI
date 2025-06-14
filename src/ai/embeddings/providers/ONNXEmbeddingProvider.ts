import { 
  EmbeddingProvider, 
  ONNXModelConfig, 
  BUILTIN_MODELS,
  EmbeddingError,
  ModelLoadError,
  EmbeddingGenerationError 
} from '../../types/embedding-types';

// Dynamic imports for ONNX Runtime
let ort: any = null;
let AutoTokenizer: any = null;

export class ONNXEmbeddingProvider implements EmbeddingProvider {
  public readonly name: string;
  public readonly type = 'local' as const;
  
  private model: any = null;
  private tokenizer: any = null;
  private session: any = null;
  private config: ONNXModelConfig;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(modelName: string = 'all-MiniLM-L6-v2') {
    this.name = `ONNX-${modelName}`;
    
    const config = BUILTIN_MODELS[modelName];
    if (!config) {
      throw new EmbeddingError(
        `Unknown model: ${modelName}. Available models: ${Object.keys(BUILTIN_MODELS).join(', ')}`,
        'INVALID_MODEL',
        this.name
      );
    }
    
    this.config = config;
  }

  isAvailable(): boolean {
    // Check if browser supports WebAssembly and has necessary APIs
    if (typeof window === 'undefined') return false;
    if (!window.WebAssembly) return false;
    if (!window.indexedDB) return false;
    
    return true;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      console.log(`Initializing ONNX model: ${this.config.modelName}`);

      // Dynamically import ONNX Runtime and Transformers
      await this.loadDependencies();

      // Set up ONNX Runtime for WebAssembly
      if (ort.env) {
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.0/dist/';
        ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 4, 4);
      }

      // Load tokenizer
      console.log('Loading tokenizer...');
      this.tokenizer = await this.loadTokenizer();

      // Load ONNX model
      console.log('Loading ONNX model...');
      this.session = await this.loadModel();

      this.isInitialized = true;
      console.log(`ONNX model ${this.config.modelName} initialized successfully`);

    } catch (error) {
      console.error('Failed to initialize ONNX provider:', error);
      throw new ModelLoadError(
        `Failed to initialize ONNX model: ${error instanceof Error ? error.message : error}`,
        this.config.modelName,
        error
      );
    }
  }

  private async loadDependencies(): Promise<void> {
    try {
      // Load ONNX Runtime
      if (!ort) {
        ort = await import('onnxruntime-web');
      }

      // Load Transformers.js for tokenization
      if (!AutoTokenizer) {
        const transformers = await import('@huggingface/transformers');
        AutoTokenizer = transformers.AutoTokenizer;
      }

    } catch (error) {
      throw new ModelLoadError(
        'Failed to load required dependencies',
        this.config.modelName,
        error
      );
    }
  }

  private async loadTokenizer(): Promise<any> {
    try {
      // Try to load from cache first
      const cachedTokenizer = await this.loadFromCache(`tokenizer_${this.config.modelName}`);
      if (cachedTokenizer) {
        return AutoTokenizer.from_pretrained(this.config.modelName, {
          cache_dir: './models',
          local_files_only: true
        });
      }

      // Load from Hugging Face Hub
      return await AutoTokenizer.from_pretrained(this.config.modelName, {
        cache_dir: './models'
      });

    } catch (error) {
      throw new ModelLoadError(
        'Failed to load tokenizer',
        this.config.modelName,
        error
      );
    }
  }

  private async loadModel(): Promise<any> {
    try {
      // Try to load from cache first
      const cachedModel = await this.loadFromCache(`model_${this.config.modelName}`);
      if (cachedModel) {
        return await ort.InferenceSession.create(cachedModel);
      }

      // Download model from URL
      console.log(`Downloading model from: ${this.config.modelUrl}`);
      const response = await fetch(this.config.modelUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const modelBuffer = await response.arrayBuffer();
      
      // Cache the model
      await this.saveToCache(`model_${this.config.modelName}`, modelBuffer);

      // Create inference session
      return await ort.InferenceSession.create(modelBuffer);

    } catch (error) {
      throw new ModelLoadError(
        'Failed to load ONNX model',
        this.config.modelName,
        error
      );
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (texts.length === 0) {
      return [];
    }

    try {
      // Process texts in batches to avoid memory issues
      const batchSize = Math.min(this.getMaxBatchSize(), 32);
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchEmbeddings = await this.processBatch(batch);
        results.push(...batchEmbeddings);
      }

      return results;

    } catch (error) {
      throw new EmbeddingGenerationError(
        `Failed to generate embeddings: ${error instanceof Error ? error.message : error}`,
        this.name,
        error
      );
    }
  }

  private async processBatch(texts: string[]): Promise<number[][]> {
    try {
      // Tokenize texts
      const tokenized = await this.tokenizer(texts, {
        padding: true,
        truncation: true,
        max_length: this.config.maxLength,
        return_tensors: 'pt'
      });

      // Prepare inputs for ONNX model
      const inputs = {
        input_ids: new ort.Tensor('int64', tokenized.input_ids.data, tokenized.input_ids.dims),
        attention_mask: new ort.Tensor('int64', tokenized.attention_mask.data, tokenized.attention_mask.dims)
      };

      // Run inference
      const outputs = await this.session.run(inputs);

      // Extract embeddings from model output
      const embeddings = this.extractEmbeddings(outputs, tokenized.attention_mask);

      return embeddings;

    } catch (error) {
      throw new EmbeddingGenerationError(
        `Batch processing failed: ${error instanceof Error ? error.message : error}`,
        this.name,
        error
      );
    }
  }

  private extractEmbeddings(outputs: any, attentionMask: any): number[][] {
    try {
      // Get the last hidden state
      const lastHiddenState = outputs.last_hidden_state || outputs.hidden_states;
      
      if (!lastHiddenState) {
        throw new Error('Model output does not contain expected embeddings');
      }

      const embeddings: number[][] = [];
      const [batchSize, seqLength, hiddenSize] = lastHiddenState.dims;

      for (let b = 0; b < batchSize; b++) {
        let embedding: number[];

        if (this.config.mean_pooling) {
          // Apply mean pooling with attention mask
          embedding = this.meanPooling(lastHiddenState.data, attentionMask.data, b, seqLength, hiddenSize);
        } else {
          // Use CLS token (first token)
          const startIdx = b * seqLength * hiddenSize;
          embedding = Array.from(lastHiddenState.data.slice(startIdx, startIdx + hiddenSize));
        }

        // Normalize if required
        if (this.config.normalize) {
          embedding = this.normalizeVector(embedding);
        }

        embeddings.push(embedding);
      }

      return embeddings;

    } catch (error) {
      throw new EmbeddingGenerationError(
        `Failed to extract embeddings: ${error instanceof Error ? error.message : error}`,
        this.name,
        error
      );
    }
  }

  private meanPooling(hiddenStates: Float32Array, attentionMask: BigInt64Array, batchIndex: number, seqLength: number, hiddenSize: number): number[] {
    const embedding = new Array(hiddenSize).fill(0);
    let validTokens = 0;

    for (let s = 0; s < seqLength; s++) {
      const maskValue = Number(attentionMask[batchIndex * seqLength + s]);
      if (maskValue > 0) {
        validTokens++;
        const tokenStartIdx = (batchIndex * seqLength + s) * hiddenSize;
        
        for (let h = 0; h < hiddenSize; h++) {
          embedding[h] += hiddenStates[tokenStartIdx + h];
        }
      }
    }

    // Average the embeddings
    if (validTokens > 0) {
      for (let h = 0; h < hiddenSize; h++) {
        embedding[h] /= validTokens;
      }
    }

    return embedding;
  }

  private normalizeVector(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? vector.map(val => val / norm) : vector;
  }

  getDimensions(): number {
    return this.config.dimensions;
  }

  getMaxBatchSize(): number {
    // Conservative batch size for browser environment
    return 16;
  }

  async close(): Promise<void> {
    try {
      if (this.session) {
        await this.session.release();
        this.session = null;
      }
      
      this.tokenizer = null;
      this.model = null;
      this.isInitialized = false;
      this.initializationPromise = null;

    } catch (error) {
      console.warn('Error closing ONNX provider:', error);
    }
  }

  // Caching methods using IndexedDB
  private async loadFromCache(key: string): Promise<ArrayBuffer | null> {
    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('MuseFlowModels', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('models')) {
            db.createObjectStore('models');
          }
        };
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['models'], 'readonly');
          const store = transaction.objectStore('models');
          const getRequest = store.get(key);
          
          getRequest.onsuccess = () => {
            resolve(getRequest.result || null);
          };
          
          getRequest.onerror = () => reject(getRequest.error);
        };
      });
    } catch (error) {
      console.warn('Failed to load from cache:', error);
      return null;
    }
  }

  private async saveToCache(key: string, data: ArrayBuffer): Promise<void> {
    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('MuseFlowModels', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('models')) {
            db.createObjectStore('models');
          }
        };
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['models'], 'readwrite');
          const store = transaction.objectStore('models');
          const putRequest = store.put(data, key);
          
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        };
      });
    } catch (error) {
      console.warn('Failed to save to cache:', error);
    }
  }

  // Utility methods
  getModelInfo(): {
    name: string;
    dimensions: number;
    maxLength: number;
    size: string;
    isLoaded: boolean;
  } {
    return {
      name: this.config.modelName,
      dimensions: this.config.dimensions,
      maxLength: this.config.maxLength,
      size: this.estimateModelSize(),
      isLoaded: this.isInitialized
    };
  }

  private estimateModelSize(): string {
    // Rough estimates for common models
    const sizeMap: Record<string, string> = {
      'all-MiniLM-L6-v2': '22 MB',
      'all-mpnet-base-v2': '420 MB',
      'paraphrase-multilingual-MiniLM-L12-v2': '118 MB'
    };
    
    return sizeMap[this.config.modelName] || 'Unknown';
  }

  async checkModelAvailability(): Promise<boolean> {
    try {
      const response = await fetch(this.config.modelUrl, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getDownloadProgress(): Promise<{ downloaded: number; total: number } | null> {
    // This would need to be implemented with a custom fetch wrapper
    // that tracks progress during model download
    return null;
  }
}