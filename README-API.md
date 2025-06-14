# AI Fiction Writer - OpenAI Compatible API

This document describes the OpenAI-compatible API server for the AI Fiction Writer application with support for custom models.

## Overview

The API server provides OpenAI-compatible endpoints that can be used with existing OpenAI client libraries. This allows for easy integration with tools that expect OpenAI's API format while supporting custom model definitions.

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment configuration:
```bash
cp server/.env.example server/.env
```

3. Start the API server:
```bash
npm run dev:server
```

4. Or start both frontend and API server:
```bash
npm run dev:full
```

The API server will run on `http://localhost:3001` by default.

## API Endpoints

### Base URL
```
http://localhost:3001
```

### Authentication

All API endpoints require authentication using Bearer tokens in the Authorization header:

```http
Authorization: Bearer your-api-key
```

**Accepted Token Formats:**
- `sk-...` (OpenAI format - 48 characters)
- `afw-...` (AI Fiction Writer format - 32 characters) 
- `dev-...` (Development format)
- `test-token` (Development only)

### Core Endpoints

#### Chat Completions
```http
POST /v1/chat/completions
```

**Request Body:**
```json
{
  "model": "custom-model-name",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful writing assistant."
    },
    {
      "role": "user", 
      "content": "Help me write a fantasy story opening."
    }
  ],
  "temperature": 0.7,
  "max_tokens": 150
}
```

**Response:**
```json
{
  "id": "chatcmpl-123456789",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "custom-model-name",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "In the realm of Aethermoor, where magic flowed like rivers through the land..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 50,
    "total_tokens": 75
  }
}
```

#### Text Completions
```http
POST /v1/completions
```

**Request Body:**
```json
{
  "model": "custom-model-name",
  "prompt": "Write a compelling character description:",
  "max_tokens": 100,
  "temperature": 0.7
}
```

#### Models Management

##### List All Models
```http
GET /v1/models
```

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4",
      "object": "model",
      "created": 1687882411,
      "owned_by": "ai-fiction-writer"
    },
    {
      "id": "custom-model-name",
      "object": "model",
      "created": 1677610602,
      "owned_by": "user",
      "description": "Custom model for creative writing"
    }
  ]
}
```

##### Get Specific Model
```http
GET /v1/models/{model_name}
```

**Response:**
```json
{
  "id": "custom-model-name",
  "object": "model",
  "created": 1677610602,
  "owned_by": "user",
  "description": "Custom model for creative writing",
  "parameters": {
    "max_tokens": 4096,
    "temperature_range": [0, 2],
    "supports_streaming": false
  }
}
```

##### Add Custom Model
```http
POST /v1/models
```

**Request Body:**
```json
{
  "id": "my-custom-model",
  "name": "My Creative Writing Model",
  "description": "Specialized model for fiction writing",
  "parameters": {
    "max_tokens": 8192,
    "temperature_range": [0, 1.5],
    "supports_streaming": false
  }
}
```

**Response:**
```json
{
  "id": "my-custom-model",
  "object": "model",
  "created": 1677652288,
  "owned_by": "user",
  "name": "My Creative Writing Model",
  "description": "Specialized model for fiction writing",
  "parameters": {
    "max_tokens": 8192,
    "temperature_range": [0, 1.5],
    "supports_streaming": false
  }
}
```

##### Delete Custom Model
```http
DELETE /v1/models/{model_name}
```

**Response:**
```json
{
  "deleted": true,
  "id": "my-custom-model",
  "object": "model"
}
```

## Custom Model Support

### Model Naming Conventions

The API supports flexible model naming to accommodate various providers:

- **OpenAI models**: `gpt-4`, `gpt-3.5-turbo`, `text-davinci-003`
- **Anthropic models**: `claude-3-sonnet`, `claude-3-haiku`
- **Meta models**: `llama-3.1-70b`, `llama-3.1-8b`
- **Mistral models**: `mistral-large`, `mistral-medium`
- **Google models**: `gemini-pro`, `gemini-ultra`
- **Local models**: `ollama/llama3`, `local/my-model`
- **Custom models**: Any alphanumeric name with dashes, underscores, dots, and forward slashes

### Model-Specific Behavior

The API automatically adapts its behavior based on the model name:

#### Prompt Formatting
- **Claude models**: Uses Human/Assistant format
- **LLaMA models**: Uses special tokens (`<|user|>`, `<|assistant|>`)
- **Mistral models**: Uses instruction format with `[INST]` tags
- **Default**: Standard role-based format

#### Response Characteristics
- **GPT-4**: More sophisticated and detailed responses
- **Claude**: Thoughtful and structured responses
- **LLaMA**: Direct and practical responses
- **Mistral**: Creative and flowing responses

#### Parameter Adjustment
- Automatically adjusts `max_tokens` based on model capabilities
- Respects model-specific temperature ranges
- Provides appropriate response timing simulation

### Dynamic Model Creation

When you use a model name that doesn't exist, the API automatically:

1. Creates a dynamic model entry
2. Infers parameters based on naming patterns
3. Assigns appropriate default values
4. Adds it to the models list for future reference

## Client Library Compatibility

### Using Custom Models with OpenAI Libraries

#### Python
```python
import openai

# Configure the client
openai.api_base = "http://localhost:3001/v1"
openai.api_key = "test-token"

# Use any custom model name
response = openai.ChatCompletion.create(
    model="llama-3.1-70b",  # Custom model
    messages=[
        {"role": "user", "content": "Write a short story opening."}
    ]
)

# Add a custom model
import requests

requests.post("http://localhost:3001/v1/models", 
    headers={"Authorization": "Bearer test-token"},
    json={
        "id": "my-writing-assistant",
        "name": "Creative Writing Assistant",
        "description": "Optimized for fiction writing",
        "parameters": {
            "max_tokens": 8192,
            "temperature_range": [0, 1.5]
        }
    }
)
```

#### Node.js
```javascript
import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: 'test-token',
  basePath: 'http://localhost:3001/v1',
});

const openai = new OpenAIApi(configuration);

// Use custom model
const response = await openai.createChatCompletion({
  model: 'claude-3-sonnet',  // Custom model
  messages: [
    { role: 'user', content: 'Help me develop a character.' }
  ],
});

// Add custom model
await fetch('http://localhost:3001/v1/models', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer test-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id: 'novelist-gpt',
    name: 'Novelist GPT',
    description: 'Specialized for novel writing'
  })
});
```

### cURL Examples

#### Using Custom Model
```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "my-custom-model",
    "messages": [
      {
        "role": "user",
        "content": "Generate a plot outline for a mystery novel."
      }
    ],
    "max_tokens": 200
  }'
```

#### Adding Custom Model
```bash
curl -X POST http://localhost:3001/v1/models \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "story-writer-pro",
    "name": "Story Writer Pro",
    "description": "Advanced model for creative storytelling",
    "parameters": {
      "max_tokens": 16384,
      "temperature_range": [0, 2],
      "supports_streaming": true
    }
  }'
```

#### Listing Models
```bash
curl -X GET http://localhost:3001/v1/models \
  -H "Authorization: Bearer test-token"
```

## Model Parameters

### Supported Parameters

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `max_tokens` | number | 1-32768 | Maximum tokens in response |
| `temperature_range` | array | [0, 10] | Min/max temperature values |
| `supports_streaming` | boolean | - | Whether model supports streaming |
| `provider` | string | - | Model provider (auto-detected) |

### Auto-Detection Rules

The API automatically detects model parameters based on naming patterns:

- **GPT models** (`gpt-*`): OpenAI parameters, streaming support
- **Claude models** (`claude-*`): Anthropic parameters, lower temperature range
- **LLaMA models** (`llama-*`): Meta parameters, larger context for 70B+ models
- **Mistral models** (`mistral-*`): Mistral AI parameters
- **Gemini models** (`gemini-*`): Google parameters
- **Local models** (`ollama/*`, `local/*`): Conservative parameters, no streaming

## Error Handling

### Custom Model Errors

```json
{
  "error": {
    "message": "Model 'protected-model' cannot be deleted",
    "type": "invalid_request_error",
    "code": "model_protected",
    "request_id": "req_123456789"
  }
}
```

### Model Validation Errors

```json
{
  "error": {
    "message": "Model ID can only contain letters, numbers, dashes, underscores, dots, and forward slashes",
    "type": "invalid_request_error",
    "code": "invalid_model_name"
  }
}
```

## Rate Limiting

- **Default Limit:** 100 requests per 15 minutes per IP
- **Model Creation:** Limited to 10 custom models per hour
- **Headers:** Rate limit information included in responses

## Best Practices

### Model Naming
- Use descriptive names that indicate the model's purpose
- Follow provider conventions when applicable
- Use forward slashes for namespacing (e.g., `team/writing-model`)

### Parameter Setting
- Set realistic `max_tokens` based on your needs
- Use appropriate temperature ranges for your model type
- Enable streaming only if your model actually supports it

### Model Management
- Regularly clean up unused custom models
- Use meaningful descriptions for custom models
- Test model behavior before production use

## Production Deployment

For production use with custom models:

1. **Security**: Implement proper API key management
2. **Persistence**: Add database storage for custom models
3. **Validation**: Enhanced model parameter validation
4. **Monitoring**: Track model usage and performance
5. **Scaling**: Consider model-specific rate limits

## Contributing

Contributions to custom model support are welcome! Please:

1. Follow existing naming conventions
2. Add tests for new model types
3. Update documentation for new features
4. Consider backward compatibility

## License

This project is licensed under the MIT License.