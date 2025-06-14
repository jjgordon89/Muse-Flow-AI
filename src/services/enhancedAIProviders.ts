/**
 * Enhanced AI Providers service with improved security and error handling
 */

import { enhancedSecureStorage } from './enhancedSecureStorage';
import { ErrorSanitizer } from '../utils/errorSanitization';
import { InputSanitizer, FormValidator, RateLimiter } from '../utils/validation';

export interface AIProvider {
  id: string;
  name: string;
  type: 'cloud' | 'local';
  baseUrl: string;
  requiresApiKey: boolean;
  models: string[];
  description: string;
}

export interface SecureAISettings {
  providers: Record<string, {
    endpoint?: string;
    selectedModel?: string;
    isEnabled: boolean;
  }>;
  defaultProvider: string;
  temperature: number;
  maxTokens: number;
}

export interface AIRequest {
  prompt: string;
  type: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
    description: 'Industry-leading models from OpenAI including GPT-4 and GPT-3.5'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    type: 'cloud',
    baseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
    description: 'Claude models known for safety and helpfulness'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'cloud',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    models: [
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'meta-llama/llama-3.1-405b-instruct',
      'google/gemini-pro-1.5',
      'mistralai/mistral-large'
    ],
    description: 'Access to multiple AI models through a single API'
  },
  {
    id: 'huggingface',
    name: 'HuggingFace',
    type: 'cloud',
    baseUrl: 'https://api-inference.huggingface.co/models',
    requiresApiKey: true,
    models: [
      'microsoft/DialoGPT-large',
      'facebook/blenderbot-400M-distill',
      'microsoft/DialoGPT-medium'
    ],
    description: 'Open-source models from the HuggingFace community'
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    type: 'local',
    baseUrl: 'http://localhost:11434',
    requiresApiKey: false,
    models: ['llama3.1', 'llama3.1:70b', 'codellama', 'mistral', 'neural-chat'],
    description: 'Run models locally with Ollama'
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (Local)',
    type: 'local',
    baseUrl: 'http://localhost:1234/v1',
    requiresApiKey: false,
    models: ['local-model'],
    description: 'Run models locally with LM Studio'
  }
];

export class EnhancedSecureAIService {
  private settings: SecureAISettings;
  private rateLimiter: RateLimiter;
  private isInitialized = false;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(settings: SecureAISettings) {
    this.settings = settings;
    this.rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
  }

  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await enhancedSecureStorage.initialize();
      this.isInitialized = true;
    }
  }

  async generateContent(request: AIRequest): Promise<AIResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Enhanced input validation and sanitization
    const sanitizedRequest = this.validateAndSanitizeRequest(request);
    
    const provider = AI_PROVIDERS.find(p => p.id === this.settings.defaultProvider);
    if (!provider) {
      throw new Error('No provider configured');
    }

    const providerSettings = this.settings.providers[provider.id];
    if (!providerSettings?.isEnabled) {
      throw new Error(`Provider ${provider.name} is not enabled`);
    }

    // Enhanced rate limiting
    if (!this.rateLimiter.isAllowed(provider.id)) {
      const remaining = this.rateLimiter.getRemainingAttempts(provider.id);
      throw new Error(`Rate limit exceeded. ${remaining} requests remaining. Please wait before making another request.`);
    }

    // Track request metrics
    this.requestCount++;
    this.lastRequestTime = Date.now();

    // Get API key securely
    let apiKey: string | null = null;
    if (provider.requiresApiKey) {
      apiKey = await enhancedSecureStorage.getSecure(`apikey-${provider.id}`);
      if (!apiKey) {
        throw new Error(`API key required for ${provider.name}. Please configure it in settings.`);
      }
    }

    try {
      const response = await this.callProvider(provider, providerSettings, sanitizedRequest, apiKey);
      
      // Sanitize response content
      return {
        ...response,
        content: InputSanitizer.sanitizeUserInput(response.content, true)
      };
    } catch (error) {
      const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
        component: 'EnhancedSecureAIService',
        action: 'generateContent',
        metadata: { provider: provider.id, model: sanitizedRequest.model }
      });
      
      throw new Error(sanitizedError.message);
    }
  }

  async setApiKey(providerId: string, apiKey: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Enhanced API key validation
    const sanitizedKey = this.validateApiKey(providerId, apiKey);
    
    // Store encrypted
    await enhancedSecureStorage.setSecure(`apikey-${providerId}`, sanitizedKey);
  }

  async getApiKey(providerId: string): Promise<string | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await enhancedSecureStorage.getSecure(`apikey-${providerId}`);
  }

  async removeApiKey(providerId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    enhancedSecureStorage.removeSecure(`apikey-${providerId}`);
  }

  getServiceMetrics(): {
    requestCount: number;
    lastRequestTime: number;
    sessionInfo: any;
    rateLimitStatus: Record<string, number>;
  } {
    const rateLimitStatus: Record<string, number> = {};
    AI_PROVIDERS.forEach(provider => {
      rateLimitStatus[provider.id] = this.rateLimiter.getRemainingAttempts(provider.id);
    });

    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      sessionInfo: enhancedSecureStorage.getSessionInfo(),
      rateLimitStatus
    };
  }

  private validateAndSanitizeRequest(request: AIRequest): AIRequest {
    // Validate required fields
    if (!request.prompt || typeof request.prompt !== 'string') {
      throw new Error('Valid prompt is required');
    }

    // Sanitize and validate prompt
    const sanitizedPrompt = InputSanitizer.sanitizeUserInput(request.prompt);
    if (!sanitizedPrompt || sanitizedPrompt.length < 1) {
      throw new Error('Invalid prompt provided');
    }

    if (sanitizedPrompt.length > 50000) { // Increased limit but still reasonable
      throw new Error('Prompt too long (maximum 50,000 characters)');
    }

    // Validate and sanitize other fields
    const sanitizedType = InputSanitizer.sanitizeText(request.type || 'general');
    const temperature = Math.max(0, Math.min(2, request.temperature ?? this.settings.temperature));
    const maxTokens = Math.max(1, Math.min(8000, request.maxTokens ?? this.settings.maxTokens));

    return {
      prompt: sanitizedPrompt,
      type: sanitizedType,
      model: request.model,
      temperature,
      maxTokens
    };
  }

  private validateApiKey(providerId: string, apiKey: string): string {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('API key must be a non-empty string');
    }

    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    if (!provider) {
      throw new Error('Invalid provider ID');
    }

    // Provider-specific API key validation
    switch (providerId) {
      case 'openai':
        if (!apiKey.startsWith('sk-') || apiKey.length < 40) {
          throw new Error('Invalid OpenAI API key format');
        }
        break;
      case 'anthropic':
        if (!apiKey.startsWith('sk-ant-') || apiKey.length < 40) {
          throw new Error('Invalid Anthropic API key format');
        }
        break;
      case 'openrouter':
        if (!apiKey.startsWith('sk-or-') || apiKey.length < 40) {
          throw new Error('Invalid OpenRouter API key format');
        }
        break;
      case 'huggingface':
        if (!apiKey.startsWith('hf_') || apiKey.length < 20) {
          throw new Error('Invalid HuggingFace API key format');
        }
        break;
    }

    // General sanitization
    const sanitizedKey = InputSanitizer.sanitizeApiKey(apiKey);
    if (!sanitizedKey) {
      throw new Error('Invalid API key format after sanitization');
    }

    return sanitizedKey;
  }

  private async callProvider(
    provider: AIProvider,
    settings: any,
    request: AIRequest,
    apiKey: string | null
  ): Promise<AIResponse> {
    switch (provider.id) {
      case 'openai':
      case 'openrouter':
        return await this.callOpenAICompatible(provider, settings, request, apiKey!);
      
      case 'anthropic':
        return await this.callAnthropic(provider, settings, request, apiKey!);
      
      case 'huggingface':
        return await this.callHuggingFace(provider, settings, request, apiKey!);
      
      case 'ollama':
      case 'lmstudio':
        return await this.callLocalProvider(provider, settings, request);
      
      default:
        throw new Error(`Unsupported provider: ${provider.id}`);
    }
  }

  private async callOpenAICompatible(
    provider: AIProvider,
    settings: any,
    request: AIRequest,
    apiKey: string
  ): Promise<AIResponse> {
    const endpoint = settings.endpoint || provider.baseUrl;
    
    // Enhanced URL validation
    if (!InputSanitizer.validateUrl(endpoint)) {
      throw new Error('Invalid endpoint URL');
    }

    const url = `${endpoint}/chat/completions`;
    
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(provider.id === 'openrouter' && {
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AI Fiction Writer'
        })
      },
      body: JSON.stringify({
        model: request.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant specialized in creative writing and fiction. Provide detailed, creative, and engaging responses that help writers develop their stories.'
          },
          {
            role: 'user',
            content: request.prompt
          }
        ],
        temperature: request.temperature,
        max_tokens: request.maxTokens
      })
    };

    // Enhanced timeout and abort handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any = {};
        
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from API');
      }

      const content = data.choices[0].message.content || 'No response generated';
      
      return {
        content,
        provider: provider.name,
        model: request.model || 'unknown',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        } : undefined
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async callAnthropic(
    provider: AIProvider,
    settings: any,
    request: AIRequest,
    apiKey: string
  ): Promise<AIResponse> {
    const endpoint = settings.endpoint || provider.baseUrl;
    
    if (!InputSanitizer.validateUrl(endpoint)) {
      throw new Error('Invalid endpoint URL');
    }

    const url = `${endpoint}/messages`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          messages: [
            {
              role: 'user',
              content: request.prompt
            }
          ]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any = {};
        
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.content || !data.content[0]) {
        throw new Error('Invalid response format from Anthropic API');
      }

      const content = data.content[0].text || 'No response generated';
      
      return {
        content,
        provider: provider.name,
        model: request.model || 'unknown',
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens || 0,
          completionTokens: data.usage.output_tokens || 0,
          totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
        } : undefined
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async callHuggingFace(
    provider: AIProvider,
    settings: any,
    request: AIRequest,
    apiKey: string
  ): Promise<AIResponse> {
    const url = `${provider.baseUrl}/${request.model}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // Longer timeout for HF

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: request.prompt,
          parameters: {
            temperature: request.temperature,
            max_new_tokens: request.maxTokens,
            return_full_text: false
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any = {};
        
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      let content: string;
      if (Array.isArray(data) && data[0]) {
        content = data[0].generated_text || 'No response generated';
      } else if (data.generated_text) {
        content = data.generated_text;
      } else {
        throw new Error('Invalid response format from HuggingFace API');
      }
      
      return {
        content,
        provider: provider.name,
        model: request.model || 'unknown'
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async callLocalProvider(
    provider: AIProvider,
    settings: any,
    request: AIRequest
  ): Promise<AIResponse> {
    const baseUrl = settings.endpoint || provider.baseUrl;
    
    if (!InputSanitizer.validateUrl(baseUrl)) {
      throw new Error('Invalid endpoint URL');
    }

    let url: string;
    let body: any;

    if (provider.id === 'ollama') {
      url = `${baseUrl}/api/generate`;
      body = {
        model: request.model,
        prompt: request.prompt,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens
        }
      };
    } else {
      url = `${baseUrl}/chat/completions`;
      body = {
        model: request.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant specialized in creative writing and fiction.'
          },
          {
            role: 'user',
            content: request.prompt
          }
        ],
        temperature: request.temperature,
        max_tokens: request.maxTokens
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // Longer timeout for local

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any = {};
        
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      let content: string;
      if (provider.id === 'ollama') {
        content = data.response || 'No response generated';
      } else {
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error('Invalid response format from local provider');
        }
        content = data.choices[0].message.content || 'No response generated';
      }
      
      return {
        content,
        provider: provider.name,
        model: request.model || 'unknown',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        } : undefined
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  updateSettings(newSettings: Partial<SecureAISettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  getSettings(): SecureAISettings {
    return { ...this.settings };
  }
}

export function createDefaultSecureAISettings(): SecureAISettings {
  return {
    providers: {
      openai: { isEnabled: false },
      anthropic: { isEnabled: false },
      openrouter: { isEnabled: false },
      huggingface: { isEnabled: false },
      ollama: { isEnabled: false },
      lmstudio: { isEnabled: false }
    },
    defaultProvider: 'openai',
    temperature: 0.7,
    maxTokens: 1500
  };
}