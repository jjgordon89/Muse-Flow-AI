import express from 'express';
import { validateChatCompletionRequest } from '../validators/request-validator.js';
import { AIService } from '../services/ai-service.js';

const router = express.Router();

/**
 * POST /v1/chat/completions
 * OpenAI-compatible chat completions endpoint
 */
router.post('/completions', async (req, res, next) => {
  try {
    // Validate request
    const validation = validateChatCompletionRequest(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: {
          message: validation.error,
          type: 'invalid_request_error',
          code: 'invalid_request'
        }
      });
    }

    const {
      model = 'gpt-3.5-turbo',
      messages,
      temperature = 0.7,
      max_tokens = 150,
      top_p = 1,
      frequency_penalty = 0,
      presence_penalty = 0,
      stop = null,
      stream = false,
      user
    } = req.body;

    // Check if streaming is requested (not implemented yet)
    if (stream) {
      return res.status(400).json({
        error: {
          message: 'Streaming is not currently supported',
          type: 'invalid_request_error',
          code: 'unsupported_feature'
        }
      });
    }

    // Generate completion using AI service
    const aiService = new AIService();
    const completion = await aiService.generateChatCompletion({
      model,
      messages,
      temperature,
      max_tokens,
      top_p,
      frequency_penalty,
      presence_penalty,
      stop,
      user: user || req.userId
    });

    // Format response in OpenAI format
    const response = {
      id: `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: completion.content
          },
          finish_reason: completion.finish_reason || 'stop'
        }
      ],
      usage: {
        prompt_tokens: completion.usage?.prompt_tokens || 0,
        completion_tokens: completion.usage?.completion_tokens || 0,
        total_tokens: completion.usage?.total_tokens || 0
      }
    };

    res.json(response);

  } catch (error) {
    next(error);
  }
});

export { router as chatCompletionsRouter };