import { AIGenerationRequest, AIGenerationResponse, AIModel, ProviderConfig, ProviderStatus } from '../../architecture/interfaces/IServices';

export interface AIProviderCapabilities {
  supportsStreaming: boolean;
  supportsImages: boolean;
  supportsVision: boolean;
  supportsCodeGeneration: boolean;
  supportsFunctionCalling: boolean;
  supportsEmbeddings: boolean;
  maxContextLength: number;
  supportedLanguages: string[];
}

export interface AIProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  totalCost: number;
  lastRequestTime?: Date;
  errorRate: number;
}

export interface StreamingOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export abstract class BaseAIProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly capabilities: AIProviderCapabilities;
  
  protected config: ProviderConfig;
  protected metrics: AIProviderMetrics;
  protected isInitialized = false;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      errorRate: 0
    };
  }

  // Abstract methods that must be implemented by providers
  abstract initialize(): Promise<void>;
  abstract generateContent(request: AIGenerationRequest, options?: StreamingOptions): Promise<AIGenerationResponse>;
  abstract getAvailableModels(): Promise<AIModel[]>;
  abstract validateConfig(config: ProviderConfig): Promise<boolean>;
  abstract getHealthStatus(): Promise<ProviderStatus>;

  // Optional methods with default implementations
  async generateEmbeddings?(texts: string[]): Promise<number[][]>;
  async generateImage?(prompt: string, options?: any): Promise<string>;
  async analyzeImage?(imageUrl: string, prompt?: string): Promise<string>;

  // Configuration management
  updateConfig(newConfig: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  // Metrics and monitoring
  getMetrics(): AIProviderMetrics {
    return { ...this.metrics };
  }

  protected updateMetrics(success: boolean, responseTime: number, tokensUsed?: number, cost?: number): void {
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = new Date();
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average response time
    const totalResponseTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime;
    this.metrics.averageResponseTime = totalResponseTime / this.metrics.totalRequests;

    if (tokensUsed) {
      this.metrics.totalTokensUsed += tokensUsed;
    }

    if (cost) {
      this.metrics.totalCost += cost;
    }

    // Calculate error rate
    this.metrics.errorRate = (this.metrics.failedRequests / this.metrics.totalRequests) * 100;
  }

  protected resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      errorRate: 0
    };
  }

  // Utility methods
  protected async makeRequest<T>(
    url: string, 
    options: RequestInit, 
    timeout?: number
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : undefined;

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...this.config.customHeaders,
          ...options.headers
        }
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      throw error;
    }
  }

  protected async makeStreamingRequest(
    url: string,
    options: RequestInit,
    onChunk: (chunk: string) => void,
    timeout?: number
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : undefined;

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...this.config.customHeaders,
          ...options.headers
        }
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              onChunk(line);
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          onChunk(buffer);
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      throw error;
    }
  }

  protected calculateCost(tokens: number, _model: string): number {
    // Default cost calculation - providers should override this
    return tokens * 0.0001; // $0.0001 per token as default
  }

  protected validateRequest(request: AIGenerationRequest): void {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty');
    }

    if (request.prompt.length > this.capabilities.maxContextLength) {
      throw new Error(`Prompt exceeds maximum context length of ${this.capabilities.maxContextLength}`);
    }
  }

  protected sanitizeResponse(response: string): string {
    // Remove any potential harmful content or formatting issues
    return response.trim();
  }

  // State management
  isReady(): boolean {
    return this.isInitialized;
  }

  async destroy(): Promise<void> {
    this.isInitialized = false;
    // Providers can override this for cleanup
  }

  // Error handling
  protected handleError(error: unknown, context: string): Error {
    if (error instanceof Error) {
      return new Error(`${this.name} - ${context}: ${error.message}`);
    }
    
    return new Error(`${this.name} - ${context}: Unknown error occurred`);
  }

  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
      }
    }

    throw lastError!;
  }

  // Rate limiting
  protected async checkRateLimit(): Promise<void> {
    // Default implementation - providers can override
    // This would typically check against provider-specific rate limits
  }

  // Token estimation
  protected estimateTokens(text: string): number {
    // Simple estimation - providers should override with more accurate calculations
    return Math.ceil(text.length / 4);
  }

  // Model selection
  protected selectBestModel(request: AIGenerationRequest, availableModels: AIModel[]): AIModel {
    // Default model selection logic
    const requestedModel = availableModels.find(model => model.id === request.model);
    if (requestedModel) {
      return requestedModel;
    }

    // Fallback to default model or first available
    const defaultModel = availableModels.find(model => model.id === this.config.defaultModel);
    if (defaultModel) {
      return defaultModel;
    }

    if (availableModels.length > 0) {
      return availableModels[0]!;
    }

    throw new Error('No suitable model available');
  }

  // Request preparation
  protected prepareRequest(request: AIGenerationRequest): any {
    // Base request preparation - providers should override
    return {
      prompt: request.prompt,
      model: request.model || this.config.defaultModel,
      ...request.parameters
    };
  }

  // Response processing
  protected processResponse(response: any, request: AIGenerationRequest): AIGenerationResponse {
    // Base response processing - providers should override
    return {
      content: response.content || response.text || '',
      type: request.type,
      model: request.model || this.config.defaultModel || '',
      provider: this.id,
      usage: response.usage,
      metadata: response.metadata
    };
  }
}