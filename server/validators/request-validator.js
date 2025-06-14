/**
 * Request validation utilities for OpenAI-compatible endpoints with custom model support
 */

/**
 * Validate chat completion request with flexible model validation
 */
export function validateChatCompletionRequest(body) {
  if (!body) {
    return { isValid: false, error: 'Request body is required' };
  }

  const { messages, model, max_tokens, temperature, top_p, frequency_penalty, presence_penalty } = body;

  // Validate messages
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { isValid: false, error: 'Messages array is required and must not be empty' };
  }

  // Validate each message
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    if (!message.role || !message.content) {
      return { isValid: false, error: `Message at index ${i} must have 'role' and 'content' properties` };
    }

    if (!['system', 'user', 'assistant', 'function'].includes(message.role)) {
      return { isValid: false, error: `Invalid role '${message.role}' at message index ${i}` };
    }

    if (typeof message.content !== 'string') {
      return { isValid: false, error: `Message content at index ${i} must be a string` };
    }
  }

  // Flexible model validation - allow any string as model name
  if (model !== undefined && (typeof model !== 'string' || model.trim().length === 0)) {
    return { isValid: false, error: 'Model must be a non-empty string' };
  }

  // Validate optional parameters
  if (max_tokens !== undefined && (typeof max_tokens !== 'number' || max_tokens < 1 || max_tokens > 32768)) {
    return { isValid: false, error: 'max_tokens must be a number between 1 and 32768' };
  }

  if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
    return { isValid: false, error: 'temperature must be a number between 0 and 2' };
  }

  if (top_p !== undefined && (typeof top_p !== 'number' || top_p < 0 || top_p > 1)) {
    return { isValid: false, error: 'top_p must be a number between 0 and 1' };
  }

  if (frequency_penalty !== undefined && (typeof frequency_penalty !== 'number' || frequency_penalty < -2 || frequency_penalty > 2)) {
    return { isValid: false, error: 'frequency_penalty must be a number between -2 and 2' };
  }

  if (presence_penalty !== undefined && (typeof presence_penalty !== 'number' || presence_penalty < -2 || presence_penalty > 2)) {
    return { isValid: false, error: 'presence_penalty must be a number between -2 and 2' };
  }

  return { isValid: true };
}

/**
 * Validate text completion request with flexible model validation
 */
export function validateCompletionRequest(body) {
  if (!body) {
    return { isValid: false, error: 'Request body is required' };
  }

  const { prompt, model, max_tokens, temperature, top_p, n, frequency_penalty, presence_penalty } = body;

  // Validate prompt
  if (!prompt) {
    return { isValid: false, error: 'Prompt is required' };
  }

  if (typeof prompt !== 'string' && !Array.isArray(prompt)) {
    return { isValid: false, error: 'Prompt must be a string or array of strings' };
  }

  if (Array.isArray(prompt)) {
    for (let i = 0; i < prompt.length; i++) {
      if (typeof prompt[i] !== 'string') {
        return { isValid: false, error: `Prompt at index ${i} must be a string` };
      }
    }
  }

  // Flexible model validation - allow any string as model name
  if (model !== undefined && (typeof model !== 'string' || model.trim().length === 0)) {
    return { isValid: false, error: 'Model must be a non-empty string' };
  }

  // Validate optional parameters
  if (max_tokens !== undefined && (typeof max_tokens !== 'number' || max_tokens < 1 || max_tokens > 32768)) {
    return { isValid: false, error: 'max_tokens must be a number between 1 and 32768' };
  }

  if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
    return { isValid: false, error: 'temperature must be a number between 0 and 2' };
  }

  if (top_p !== undefined && (typeof top_p !== 'number' || top_p < 0 || top_p > 1)) {
    return { isValid: false, error: 'top_p must be a number between 0 and 1' };
  }

  if (n !== undefined && (typeof n !== 'number' || n < 1 || n > 10)) {
    return { isValid: false, error: 'n must be a number between 1 and 10' };
  }

  if (frequency_penalty !== undefined && (typeof frequency_penalty !== 'number' || frequency_penalty < -2 || frequency_penalty > 2)) {
    return { isValid: false, error: 'frequency_penalty must be a number between -2 and 2' };
  }

  if (presence_penalty !== undefined && (typeof presence_penalty !== 'number' || presence_penalty < -2 || presence_penalty > 2)) {
    return { isValid: false, error: 'presence_penalty must be a number between -2 and 2' };
  }

  return { isValid: true };
}

/**
 * Validate custom model creation request
 */
export function validateCustomModelRequest(body) {
  if (!body) {
    return { isValid: false, error: 'Request body is required' };
  }

  const { id, name, description, parameters } = body;

  // Validate model ID
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return { isValid: false, error: 'Model ID is required and must be a non-empty string' };
  }

  // Model ID should be alphanumeric with dashes, underscores, and dots
  if (!/^[a-zA-Z0-9\-_.\/]+$/.test(id)) {
    return { isValid: false, error: 'Model ID can only contain letters, numbers, dashes, underscores, dots, and forward slashes' };
  }

  // Validate optional fields
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return { isValid: false, error: 'Model name must be a non-empty string if provided' };
  }

  if (description !== undefined && typeof description !== 'string') {
    return { isValid: false, error: 'Model description must be a string if provided' };
  }

  if (parameters !== undefined && typeof parameters !== 'object') {
    return { isValid: false, error: 'Model parameters must be an object if provided' };
  }

  // Validate parameters if provided
  if (parameters) {
    const { max_tokens, temperature_range, supports_streaming } = parameters;

    if (max_tokens !== undefined && (typeof max_tokens !== 'number' || max_tokens < 1 || max_tokens > 1000000)) {
      return { isValid: false, error: 'max_tokens parameter must be a number between 1 and 1000000' };
    }

    if (temperature_range !== undefined) {
      if (!Array.isArray(temperature_range) || temperature_range.length !== 2) {
        return { isValid: false, error: 'temperature_range must be an array of two numbers [min, max]' };
      }
      
      const [min, max] = temperature_range;
      if (typeof min !== 'number' || typeof max !== 'number' || min < 0 || max > 10 || min >= max) {
        return { isValid: false, error: 'temperature_range must be [min, max] where 0 <= min < max <= 10' };
      }
    }

    if (supports_streaming !== undefined && typeof supports_streaming !== 'boolean') {
      return { isValid: false, error: 'supports_streaming must be a boolean if provided' };
    }
  }

  return { isValid: true };
}

/**
 * Validate model name format for various providers
 */
export function validateModelName(modelName) {
  if (!modelName || typeof modelName !== 'string') {
    return { isValid: false, error: 'Model name must be a string' };
  }

  const trimmed = modelName.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Model name cannot be empty' };
  }

  if (trimmed.length > 100) {
    return { isValid: false, error: 'Model name cannot exceed 100 characters' };
  }

  // Allow flexible model naming to support various providers
  // Examples: gpt-4, claude-3-sonnet, llama-3.1-70b, custom/my-model, etc.
  if (!/^[a-zA-Z0-9\-_.\/]+$/.test(trimmed)) {
    return { isValid: false, error: 'Model name can only contain letters, numbers, dashes, underscores, dots, and forward slashes' };
  }

  return { isValid: true, modelName: trimmed };
}

/**
 * Get suggested model parameters based on model name patterns
 */
export function getSuggestedModelParameters(modelName) {
  const name = modelName.toLowerCase();
  
  // OpenAI models
  if (name.includes('gpt-4')) {
    return {
      max_tokens: 8192,
      temperature_range: [0, 2],
      supports_streaming: true,
      provider: 'openai'
    };
  } else if (name.includes('gpt-3.5')) {
    return {
      max_tokens: 4096,
      temperature_range: [0, 2],
      supports_streaming: true,
      provider: 'openai'
    };
  }
  
  // Anthropic models
  else if (name.includes('claude')) {
    return {
      max_tokens: 8192,
      temperature_range: [0, 1],
      supports_streaming: true,
      provider: 'anthropic'
    };
  }
  
  // Meta models
  else if (name.includes('llama')) {
    return {
      max_tokens: 4096,
      temperature_range: [0, 2],
      supports_streaming: false,
      provider: 'meta'
    };
  }
  
  // Mistral models
  else if (name.includes('mistral')) {
    return {
      max_tokens: 8192,
      temperature_range: [0, 1.5],
      supports_streaming: true,
      provider: 'mistralai'
    };
  }
  
  // Google models
  else if (name.includes('gemini')) {
    return {
      max_tokens: 8192,
      temperature_range: [0, 2],
      supports_streaming: true,
      provider: 'google'
    };
  }
  
  // Local/Ollama models
  else if (name.includes('ollama') || name.includes('local')) {
    return {
      max_tokens: 2048,
      temperature_range: [0, 2],
      supports_streaming: false,
      provider: 'local'
    };
  }
  
  // Default parameters for unknown models
  return {
    max_tokens: 4096,
    temperature_range: [0, 2],
    supports_streaming: false,
    provider: 'custom'
  };
}