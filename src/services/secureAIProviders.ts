/**
 * Secure AI Providers service with encrypted API key storage
 */

import { secureStorage } from './secureStorage';
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

export class SecureAIService {
  private settings: SecureAISettings;
  private rateLimiter: RateLimiter;
  private isInitialized = false;

  constructor(settings: SecureAISettings) {
    this.settings = settings;
    this.rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
  }

  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await secureStorage.initialize();
      this.isInitialized = true;
    }
  }

  async generateContent(request: AIRequest): Promise<AIResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Validate and sanitize input
    const sanitizedPrompt = InputSanitizer.sanitizeUserInput(request.prompt);
    if (!sanitizedPrompt || sanitizedPrompt.length < 1) {
      throw new Error('Invalid prompt provided');
    }

    if (sanitizedPrompt.length > 10000) {
      throw new Error('Prompt too long (maximum 10,000 characters)');
    }

    const provider = AI_PROVIDERS.find(p => p.id === this.settings.defaultProvider);
    if (!provider) {
      throw new Error('No provider configured');
    }

    const providerSettings = this.settings.providers[provider.id];
    if (!providerSettings?.isEnabled) {
      throw new Error(`Provider ${provider.name} is not enabled`);
    }

    // Rate limiting
    if (!this.rateLimiter.isAllowed(provider.id)) {
      throw new Error('Rate limit exceeded. Please wait before making another request.');
    }

    // Get API key securely
    let apiKey: string | null = null;
    if (provider.requiresApiKey) {
      apiKey = await secureStorage.getSecure(`apikey-${provider.id}`);
      if (!apiKey) {
        throw new Error(`API key required for ${provider.name}`);
      }
    }

    const model = request.model || providerSettings.selectedModel || provider.models[0];
    const temperature = Math.max(0, Math.min(2, request.temperature ?? this.settings.temperature));
    const maxTokens = Math.max(1, Math.min(4000, request.maxTokens ?? this.settings.maxTokens));

    const secureRequest: AIRequest = {
      prompt: sanitizedPrompt,
      type: InputSanitizer.sanitizeText(request.type),
      model,
      temperature,
      maxTokens
    };

    try {
      switch (provider.id) {
        case 'openai':
        case 'openrouter':
          return await this.callOpenAICompatible(provider, providerSettings, secureRequest, apiKey!);
        
        case 'anthropic':
          return await this.callAnthropic(provider, providerSettings, secureRequest, apiKey!);
        
        case 'huggingface':
          return await this.callHuggingFace(provider, providerSettings, secureRequest, apiKey!);
        
        case 'ollama':
        case 'lmstudio':
          return await this.callLocalProvider(provider, providerSettings, secureRequest);
        
        default:
          throw new Error(`Unsupported provider: ${provider.id}`);
      }
    } catch (error) {
      console.error(`AI generation failed for ${provider.name}:`, error);
      throw this.handleAPIError(error, provider);
    }
  }

  async setApiKey(providerId: string, apiKey: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Validate API key format
    const sanitizedKey = InputSanitizer.sanitizeApiKey(apiKey);
    if (!sanitizedKey) {
      throw new Error('Invalid API key format');
    }

    const validation = FormValidator.validateField(sanitizedKey, FormValidator.rules.apiKey);
    if (validation) {
      throw new Error(validation);
    }

    // Store encrypted
    await secureStorage.setSecure(`apikey-${providerId}`, sanitizedKey);
  }

  async getApiKey(providerId: string): Promise<string | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await secureStorage.getSecure(`apikey-${providerId}`);
  }

  async removeApiKey(providerId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    secureStorage.removeSecure(`apikey-${providerId}`);
  }

  private async callOpenAICompatible(
    provider: AIProvider,
    settings: any,
    request: AIRequest,
    apiKey: string
  ): Promise<AIResponse> {
    const endpoint = settings.endpoint || provider.baseUrl;
    
    // Validate endpoint URL
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      const content = data.choices[0]?.message?.content || 'No response generated';
      
      return {
        content: InputSanitizer.sanitizeUserInput(content, true),
        provider: provider.name,
        model: request.model || 'unknown',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
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
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      const content = data.content[0]?.text || 'No response generated';
      
      return {
        content: InputSanitizer.sanitizeUserInput(content, true),
        provider: provider.name,
        model: request.model || 'unknown',
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
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
    const timeoutId = setTimeout(() => controller.abort(), 60000); // Longer timeout for HF

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      const content = data[0]?.generated_text || data.generated_text || 'No response generated';
      
      return {
        content: InputSanitizer.sanitizeUserInput(content, true),
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
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      let content: string;
      if (provider.id === 'ollama') {
        content = data.response || 'No response generated';
      } else {
        content = data.choices[0]?.message?.content || 'No response generated';
      }
      
      return {
        content: InputSanitizer.sanitizeUserInput(content, true),
        provider: provider.name,
        model: request.model || 'unknown',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private handleAPIError(error: any, provider: AIProvider): Error {
    if (error.name === 'AbortError') {
      return new Error(`Request timeout for ${provider.name}. Please try again.`);
    }
    
    if (error.message?.includes('401') || error.message?.includes('403')) {
      return new Error(`Authentication failed for ${provider.name}. Please check your API key.`);
    }
    
    if (error.message?.includes('429')) {
      return new Error(`Rate limit exceeded for ${provider.name}. Please try again later.`);
    }
    
    if (error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503')) {
      return new Error(`${provider.name} service is temporarily unavailable. Please try again later.`);
    }
    
    if (error.name === 'TypeError' && error.message?.includes('fetch')) {
      return new Error(`Unable to connect to ${provider.name}. Please check your internet connection${provider.type === 'local' ? ' and ensure the local service is running' : ''}.`);
    }
    
    return new Error(error.message || `An unexpected error occurred with ${provider.name}`);
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