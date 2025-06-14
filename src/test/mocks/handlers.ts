import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock OpenAI API
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [
        {
          message: {
            content: 'This is a mocked AI response for testing purposes.'
          }
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    });
  }),

  // Mock Anthropic API
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      content: [
        {
          text: 'This is a mocked Claude response for testing purposes.'
        }
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 20
      }
    });
  }),

  // Mock Ollama API
  http.post('http://localhost:11434/api/generate', () => {
    return HttpResponse.json({
      response: 'This is a mocked Ollama response for testing purposes.'
    });
  }),
];