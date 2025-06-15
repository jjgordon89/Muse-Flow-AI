import { BaseAIProvider, AIProviderCapabilities, StreamingOptions } from './BaseAIProvider';
import { AIGenerationRequest, AIGenerationResponse, AIModel, ProviderConfig, ProviderStatus } from '../../architecture/interfaces/IServices';

export interface OpenAIConfig extends ProviderConfig {
  apiKey: string;
  organization?: string;
  baseUrl?: string;
}

export class OpenAIProvider extends BaseAIProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly description = 'OpenAI GPT models including GPT-4, GPT-3.5, and more';
  readonly capabilities: AIProviderCapabilities = {
    supportsStreaming: true,
    supportsImages: true,
    supportsVision: true,
    supportsCodeGeneration: true,
    supportsFunctionCalling: true,
    supportsEmbeddings: true,
    maxContextLength: 128000, // GPT-4 Turbo
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']
  };

  private baseUrl: string;
  private apiKey: string;
  private organization?: string | undefined;

  constructor(config: OpenAIConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.organization = config.organization;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    try {
      // Test the connection by fetching models
      await this.getAvailableModels();
      this.isInitialized = true;
      console.log('OpenAI provider initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize OpenAI provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateContent(request: AIGenerationRequest, options?: StreamingOptions): Promise<AIGenerationResponse> {
    this.validateRequest(request);
    await this.checkRateLimit();

    const startTime = Date.now();
    let tokensUsed = 0;
    let cost = 0;

    try {
      const model = this.selectBestModel(request, await this.getAvailableModels());
      const requestBody = this.prepareOpenAIRequest(request, model);

      if (options?.onChunk && this.capabilities.supportsStreaming) {
        return await this.generateStreamingContent(requestBody, request, options);
      } else {
        return await this.generateNonStreamingContent(requestBody, request, model);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime, tokensUsed, cost);
      throw this.handleError(error, 'generateContent');
    }
  }

  private async generateStreamingContent(
    requestBody: any,
    request: AIGenerationRequest,
    options: StreamingOptions
  ): Promise<AIGenerationResponse> {
    let fullContent = '';
    let tokensUsed = 0;
    const startTime = Date.now();

    try {
      await this.makeStreamingRequest(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ ...requestBody, stream: true })
        },
        (chunk: string) => {
          try {
            if (chunk.startsWith('data: ')) {
              const data = chunk.slice(6);
              if (data === '[DONE]') {
                options.onComplete?.(fullContent);
                return;
              }

              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              
              if (content) {
                fullContent += content;
                options.onChunk?.(content);
              }

              if (parsed.usage) {
                tokensUsed = parsed.usage.total_tokens;
              }
            }
          } catch (parseError) {
            console.warn('Failed to parse streaming chunk:', parseError);
          }
        },
        this.config.timeout
      );

      const responseTime = Date.now() - startTime;
      const cost = this.calculateCost(tokensUsed, request.model || this.config.defaultModel || '');
      this.updateMetrics(true, responseTime, tokensUsed, cost);

      return {
        content: this.sanitizeResponse(fullContent),
        type: request.type,
        model: request.model || this.config.defaultModel || '',
        provider: this.id,
        usage: {
          prompt_tokens: 0, // Will be calculated by OpenAI
          completion_tokens: tokensUsed,
          total_tokens: tokensUsed
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime, tokensUsed, 0);
      options.onError?.(error instanceof Error ? error : new Error('Streaming failed'));
      throw error;
    }
  }

  private async generateNonStreamingContent(
    requestBody: any,
    request: AIGenerationRequest,
    model: AIModel
  ): Promise<AIGenerationResponse> {
    const startTime = Date.now();

    const response = await this.makeRequest<any>(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      },
      this.config.timeout
    );

    const responseTime = Date.now() - startTime;
    const tokensUsed = response.usage?.total_tokens || 0;
    const cost = this.calculateCost(tokensUsed, model.id);
    
    this.updateMetrics(true, responseTime, tokensUsed, cost);

    return {
      content: this.sanitizeResponse(response.choices[0]?.message?.content || ''),
      type: request.type,
      model: model.id,
      provider: this.id,
      usage: response.usage,
      metadata: {
        finish_reason: response.choices[0]?.finish_reason,
        response_time: responseTime
      }
    };
  }

  async getAvailableModels(): Promise<AIModel[]> {
    try {
      const response = await this.makeRequest<{ data: any[] }>(
        `${this.baseUrl}/models`,
        {
          method: 'GET',
          headers: this.getHeaders()
        },
        this.config.timeout
      );

      return response.data
        .filter(model => model.id.startsWith('gpt-'))
        .map(model => ({
          id: model.id,
          name: model.id,
          provider: this.id,
          type: 'chat' as const,
          maxTokens: this.getModelMaxTokens(model.id),
          costPer1kTokens: this.getModelCost(model.id),
          capabilities: this.getModelCapabilities(model.id)
        }));
    } catch (error) {
      throw this.handleError(error, 'getAvailableModels');
    }
  }

  override async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.capabilities.supportsEmbeddings) {
      throw new Error('OpenAI provider does not support embeddings');
    }

    try {
      const response = await this.makeRequest<any>(
        `${this.baseUrl}/embeddings`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: texts
          })
        },
        this.config.timeout
      );

      return response.data.map((item: any) => item.embedding);
    } catch (error) {
      throw this.handleError(error, 'generateEmbeddings');
    }
  }

  override async generateImage(prompt: string, options: any = {}): Promise<string> {
    if (!this.capabilities.supportsImages) {
      throw new Error('OpenAI provider does not support image generation');
    }

    try {
      const response = await this.makeRequest<any>(
        `${this.baseUrl}/images/generations`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt,
            size: options.size || '1024x1024',
            quality: options.quality || 'standard',
            n: 1
          })
        },
        this.config.timeout || 60000 // Image generation takes longer
      );

      return response.data[0]?.url || '';
    } catch (error) {
      throw this.handleError(error, 'generateImage');
    }
  }

  override async analyzeImage(imageUrl: string, prompt?: string): Promise<string> {
    if (!this.capabilities.supportsVision) {
      throw new Error('OpenAI provider does not support vision');
    }

    try {
      const response = await this.makeRequest<any>(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            model: 'gpt-4-vision-preview',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: prompt || 'What do you see in this image?'
                  },
                  {
                    type: 'image_url',
                    image_url: { url: imageUrl }
                  }
                ]
              }
            ],
            max_tokens: 1000
          })
        },
        this.config.timeout
      );

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      throw this.handleError(error, 'analyzeImage');
    }
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    const openAIConfig = config as OpenAIConfig;
    
    if (!openAIConfig.apiKey) {
      return false;
    }

    try {
      const testProvider = new OpenAIProvider(openAIConfig);
      await testProvider.getAvailableModels();
      return true;
    } catch {
      return false;
    }
  }

  async getHealthStatus(): Promise<ProviderStatus> {
    const status: ProviderStatus = {
      id: this.id,
      name: this.name,
      status: 'offline',
      responseTime: 0,
      errorRate: this.metrics.errorRate,
      availableModels: []
    };

    try {
      const startTime = Date.now();
      const models = await this.getAvailableModels();
      const responseTime = Date.now() - startTime;

      status.status = responseTime < 5000 ? 'online' : 'degraded';
      status.responseTime = responseTime;
      status.availableModels = models.map(m => m.id);
    } catch (error) {
      status.status = 'offline';
      status.responseTime = -1;
    }

    return status;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    return headers;
  }

  private prepareOpenAIRequest(request: AIGenerationRequest, model: AIModel): any {
    const messages = [
      {
        role: 'user',
        content: request.prompt
      }
    ];

    if (request.context) {
      messages.unshift({
        role: 'system',
        content: request.context
      });
    }

    return {
      model: model.id,
      messages,
      temperature: request.parameters?.['temperature'] || 0.7,
      max_tokens: request.parameters?.['max_tokens'] || 1000,
      top_p: request.parameters?.['top_p'] || 1,
      frequency_penalty: request.parameters?.['frequency_penalty'] || 0,
      presence_penalty: request.parameters?.['presence_penalty'] || 0,
      ...request.parameters
    };
  }

  private getModelMaxTokens(modelId: string): number {
    const tokenLimits: Record<string, number> = {
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384
    };

    return tokenLimits[modelId] || 4096;
  }

  private getModelCost(modelId: string): number {
    // Cost per 1K tokens (approximate, as of 2024)
    const costs: Record<string, number> = {
      'gpt-4-turbo': 0.01,
      'gpt-4': 0.03,
      'gpt-4-32k': 0.06,
      'gpt-3.5-turbo': 0.002,
      'gpt-3.5-turbo-16k': 0.004
    };

    return costs[modelId] || 0.002;
  }

  private getModelCapabilities(modelId: string): string[] {
    const capabilities = ['text_generation', 'conversation'];

    if (modelId.includes('gpt-4')) {
      capabilities.push('advanced_reasoning', 'code_generation');
    }

    if (modelId.includes('vision')) {
      capabilities.push('vision', 'image_analysis');
    }

    return capabilities;
  }

  protected override calculateCost(tokens: number, model: string): number {
    const costPer1k = this.getModelCost(model);
    return (tokens / 1000) * costPer1k;
  }

  protected override estimateTokens(text: string): number {
    // More accurate token estimation for OpenAI models
    // This is a simplified version - could use tiktoken for exact counting
    return Math.ceil(text.length / 3.5);
  }
}