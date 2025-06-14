import express from 'express';
import { validateCompletionRequest } from '../validators/request-validator.js';
import { AIService } from '../services/ai-service.js';

const router = express.Router();

/**
 * POST /v1/completions
 * OpenAI-compatible text completions endpoint
 */
router.post('/completions', async (req, res, next) => {
  try {
    // Validate request
    const validation = validateCompletionRequest(req.body);
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
      model = 'text-davinci-003',
      prompt,
      max_tokens = 150,
      temperature = 0.7,
      top_p = 1,
      n = 1,
      stream = false,
      logprobs = null,
      echo = false,
      stop = null,
      presence_penalty = 0,
      frequency_penalty = 0,
      best_of = 1,
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

    // Check if multiple completions requested
    if (n > 1) {
      return res.status(400).json({
        error: {
          message: 'Multiple completions (n > 1) not currently supported',
          type: 'invalid_request_error',
          code: 'unsupported_feature'
        }
      });
    }

    // Generate completion using AI service
    const aiService = new AIService();
    const completion = await aiService.generateCompletion({
      model,
      prompt,
      max_tokens,
      temperature,
      top_p,
      stop,
      presence_penalty,
      frequency_penalty,
      user: user || req.userId
    });

    // Format response in OpenAI format
    const response = {
      id: `cmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      object: 'text_completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          text: completion.content,
          index: 0,
          logprobs: null,
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

export { router as completionsRouter };