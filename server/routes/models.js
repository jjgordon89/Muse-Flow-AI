import express from 'express';

const router = express.Router();

// Base models that are always available
const BASE_MODELS = [
  {
    id: 'gpt-4',
    object: 'model',
    created: 1687882411,
    owned_by: 'ai-fiction-writer',
    permission: [],
    root: 'gpt-4',
    parent: null
  },
  {
    id: 'gpt-4-turbo',
    object: 'model',
    created: 1687882411,
    owned_by: 'ai-fiction-writer',
    permission: [],
    root: 'gpt-4-turbo',
    parent: null
  },
  {
    id: 'gpt-3.5-turbo',
    object: 'model',
    created: 1677610602,
    owned_by: 'ai-fiction-writer',
    permission: [],
    root: 'gpt-3.5-turbo',
    parent: null
  },
  {
    id: 'text-davinci-003',
    object: 'model',
    created: 1669599635,
    owned_by: 'ai-fiction-writer',
    permission: [],
    root: 'text-davinci-003',
    parent: null
  },
  {
    id: 'claude-3-sonnet',
    object: 'model',
    created: 1687882411,
    owned_by: 'ai-fiction-writer',
    permission: [],
    root: 'claude-3-sonnet',
    parent: null
  },
  {
    id: 'claude-3-haiku',
    object: 'model',
    created: 1687882411,
    owned_by: 'ai-fiction-writer',
    permission: [],
    root: 'claude-3-haiku',
    parent: null
  },
  {
    id: 'llama-3.1-70b',
    object: 'model',
    created: 1687882411,
    owned_by: 'ai-fiction-writer',
    permission: [],
    root: 'llama-3.1-70b',
    parent: null
  },
  {
    id: 'llama-3.1-8b',
    object: 'model',
    created: 1687882411,
    owned_by: 'ai-fiction-writer',
    permission: [],
    root: 'llama-3.1-8b',
    parent: null
  },
  {
    id: 'mistral-large',
    object: 'model',
    created: 1687882411,
    owned_by: 'ai-fiction-writer',
    permission: [],
    root: 'mistral-large',
    parent: null
  },
  {
    id: 'gemini-pro',
    object: 'model',
    created: 1687882411,
    owned_by: 'ai-fiction-writer',
    permission: [],
    root: 'gemini-pro',
    parent: null
  }
];

// Store for custom models added by users
const customModels = new Map();

/**
 * GET /v1/models
 * OpenAI-compatible models endpoint with support for custom models
 */
router.get('/models', async (req, res, next) => {
  try {
    // Combine base models with custom models
    const allModels = [
      ...BASE_MODELS,
      ...Array.from(customModels.values())
    ];

    const response = {
      object: 'list',
      data: allModels
    };

    res.json(response);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/models/{model}
 * Get specific model information (supports custom models)
 */
router.get('/models/:model', async (req, res, next) => {
  try {
    const { model } = req.params;
    
    // Check if it's a base model
    let modelInfo = BASE_MODELS.find(m => m.id === model);
    
    // Check if it's a custom model
    if (!modelInfo && customModels.has(model)) {
      modelInfo = customModels.get(model);
    }
    
    // If model doesn't exist, create a dynamic entry
    if (!modelInfo) {
      modelInfo = createDynamicModel(model);
      // Optionally store it as a custom model for future reference
      customModels.set(model, modelInfo);
    }

    res.json(modelInfo);

  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/models
 * Add a custom model (extension to OpenAI API)
 */
router.post('/models', async (req, res, next) => {
  try {
    const { id, name, description, parameters = {} } = req.body;
    
    if (!id) {
      return res.status(400).json({
        error: {
          message: 'Model ID is required',
          type: 'invalid_request_error',
          code: 'missing_parameter'
        }
      });
    }

    // Check if model already exists
    if (BASE_MODELS.find(m => m.id === id) || customModels.has(id)) {
      return res.status(409).json({
        error: {
          message: `Model '${id}' already exists`,
          type: 'invalid_request_error',
          code: 'model_exists'
        }
      });
    }

    const customModel = {
      id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'user',
      permission: [],
      root: id,
      parent: null,
      name: name || id,
      description: description || `Custom model: ${id}`,
      parameters: {
        max_tokens: parameters.max_tokens || 4096,
        temperature_range: parameters.temperature_range || [0, 2],
        supports_streaming: parameters.supports_streaming || false,
        ...parameters
      }
    };

    customModels.set(id, customModel);

    res.status(201).json(customModel);

  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /v1/models/{model}
 * Remove a custom model (extension to OpenAI API)
 */
router.delete('/models/:model', async (req, res, next) => {
  try {
    const { model } = req.params;
    
    // Prevent deletion of base models
    if (BASE_MODELS.find(m => m.id === model)) {
      return res.status(403).json({
        error: {
          message: `Cannot delete base model '${model}'`,
          type: 'invalid_request_error',
          code: 'model_protected'
        }
      });
    }

    if (!customModels.has(model)) {
      return res.status(404).json({
        error: {
          message: `Model '${model}' not found`,
          type: 'invalid_request_error',
          code: 'model_not_found'
        }
      });
    }

    customModels.delete(model);

    res.json({
      deleted: true,
      id: model,
      object: 'model'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Create a dynamic model entry for unknown models
 */
function createDynamicModel(modelId) {
  // Determine model type and parameters based on name patterns
  let parameters = {
    max_tokens: 4096,
    temperature_range: [0, 2],
    supports_streaming: false
  };

  let ownedBy = 'custom';
  let description = `Custom model: ${modelId}`;

  // OpenAI models
  if (modelId.startsWith('gpt-')) {
    ownedBy = 'openai';
    description = `OpenAI GPT model: ${modelId}`;
    parameters.max_tokens = modelId.includes('gpt-4') ? 8192 : 4096;
  }
  // Anthropic models
  else if (modelId.includes('claude')) {
    ownedBy = 'anthropic';
    description = `Anthropic Claude model: ${modelId}`;
    parameters.max_tokens = 8192;
  }
  // Meta models
  else if (modelId.includes('llama')) {
    ownedBy = 'meta';
    description = `Meta LLaMA model: ${modelId}`;
    parameters.max_tokens = 4096;
  }
  // Mistral models
  else if (modelId.includes('mistral')) {
    ownedBy = 'mistralai';
    description = `Mistral AI model: ${modelId}`;
    parameters.max_tokens = 8192;
  }
  // Google models
  else if (modelId.includes('gemini')) {
    ownedBy = 'google';
    description = `Google Gemini model: ${modelId}`;
    parameters.max_tokens = 8192;
  }
  // Ollama models (local)
  else if (modelId.includes('ollama') || modelId.includes('local')) {
    ownedBy = 'local';
    description = `Local model: ${modelId}`;
    parameters.max_tokens = 2048;
  }

  return {
    id: modelId,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: ownedBy,
    permission: [],
    root: modelId,
    parent: null,
    description,
    parameters
  };
}

/**
 * Get all available models (including custom ones)
 */
export function getAllModels() {
  return [
    ...BASE_MODELS,
    ...Array.from(customModels.values())
  ];
}

/**
 * Check if a model exists (base or custom)
 */
export function modelExists(modelId) {
  return BASE_MODELS.some(m => m.id === modelId) || customModels.has(modelId);
}

/**
 * Get model information
 */
export function getModelInfo(modelId) {
  let model = BASE_MODELS.find(m => m.id === modelId);
  if (!model && customModels.has(modelId)) {
    model = customModels.get(modelId);
  }
  if (!model) {
    model = createDynamicModel(modelId);
  }
  return model;
}

export { router as modelsRouter };