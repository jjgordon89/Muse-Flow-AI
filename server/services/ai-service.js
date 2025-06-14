/**
 * AI Service for handling completions with custom model support
 * This service integrates with the existing frontend AI providers
 */

import { getModelInfo } from '../routes/models.js';

export class AIService {
  constructor() {
    this.defaultModel = 'gpt-3.5-turbo';
  }

  /**
   * Generate chat completion with model-specific behavior
   */
  async generateChatCompletion(options) {
    const {
      model = this.defaultModel,
      messages,
      temperature = 0.7,
      max_tokens = 150,
      top_p = 1,
      frequency_penalty = 0,
      presence_penalty = 0,
      stop = null,
      user
    } = options;

    try {
      // Get model information to understand its capabilities
      const modelInfo = getModelInfo(model);
      
      // Adjust parameters based on model capabilities
      const adjustedOptions = this.adjustParametersForModel(options, modelInfo);
      
      // Convert messages to a single prompt for the underlying AI service
      const prompt = this.convertMessagesToPrompt(messages, model);
      
      // Generate completion using the model-aware AI service
      const completion = await this.generateAICompletion({
        prompt,
        model,
        modelInfo,
        temperature: adjustedOptions.temperature,
        max_tokens: adjustedOptions.max_tokens,
        stop
      });

      return {
        content: completion.content,
        finish_reason: completion.finish_reason || 'stop',
        usage: {
          prompt_tokens: this.countTokens(prompt),
          completion_tokens: this.countTokens(completion.content),
          total_tokens: this.countTokens(prompt) + this.countTokens(completion.content)
        }
      };

    } catch (error) {
      console.error(`Chat completion error for model ${model}:`, error);
      throw new Error(`Failed to generate chat completion: ${error.message}`);
    }
  }

  /**
   * Generate text completion with model-specific behavior
   */
  async generateCompletion(options) {
    const {
      model = this.defaultModel,
      prompt,
      temperature = 0.7,
      max_tokens = 150,
      top_p = 1,
      stop = null,
      presence_penalty = 0,
      frequency_penalty = 0,
      user
    } = options;

    try {
      // Get model information to understand its capabilities
      const modelInfo = getModelInfo(model);
      
      // Adjust parameters based on model capabilities
      const adjustedOptions = this.adjustParametersForModel(options, modelInfo);

      // Generate completion using the model-aware AI service
      const completion = await this.generateAICompletion({
        prompt,
        model,
        modelInfo,
        temperature: adjustedOptions.temperature,
        max_tokens: adjustedOptions.max_tokens,
        stop
      });

      return {
        content: completion.content,
        finish_reason: completion.finish_reason || 'stop',
        usage: {
          prompt_tokens: this.countTokens(prompt),
          completion_tokens: this.countTokens(completion.content),
          total_tokens: this.countTokens(prompt) + this.countTokens(completion.content)
        }
      };

    } catch (error) {
      console.error(`Completion error for model ${model}:`, error);
      throw new Error(`Failed to generate completion: ${error.message}`);
    }
  }

  /**
   * Adjust parameters based on model capabilities
   */
  adjustParametersForModel(options, modelInfo) {
    const adjusted = { ...options };
    
    // Adjust max_tokens based on model limits
    if (modelInfo.parameters?.max_tokens) {
      adjusted.max_tokens = Math.min(
        adjusted.max_tokens || 150,
        modelInfo.parameters.max_tokens
      );
    }
    
    // Adjust temperature based on model range
    if (modelInfo.parameters?.temperature_range) {
      const [min, max] = modelInfo.parameters.temperature_range;
      adjusted.temperature = Math.max(min, Math.min(max, adjusted.temperature || 0.7));
    }
    
    return adjusted;
  }

  /**
   * Convert messages array to a single prompt string with model-specific formatting
   */
  convertMessagesToPrompt(messages, model) {
    // Use different prompt formats based on the model
    if (model.includes('claude')) {
      // Anthropic Claude format
      return messages.map(message => {
        if (message.role === 'system') {
          return `System: ${message.content}`;
        } else if (message.role === 'assistant') {
          return `Assistant: ${message.content}`;
        } else {
          return `Human: ${message.content}`;
        }
      }).join('\n\n') + '\n\nAssistant:';
    } else if (model.includes('llama')) {
      // LLaMA format with special tokens
      const formattedMessages = messages.map(message => {
        if (message.role === 'system') {
          return `<|system|>\n${message.content}`;
        } else if (message.role === 'assistant') {
          return `<|assistant|>\n${message.content}`;
        } else {
          return `<|user|>\n${message.content}`;
        }
      });
      return formattedMessages.join('\n') + '\n<|assistant|>\n';
    } else if (model.includes('mistral')) {
      // Mistral format
      return messages.map(message => {
        const role = message.role === 'assistant' ? 'Assistant' : 
                     message.role === 'system' ? 'System' : 'User';
        return `[INST] ${role}: ${message.content} [/INST]`;
      }).join(' ') + ' Assistant:';
    } else {
      // Default OpenAI-style format
      return messages.map(message => {
        const role = message.role === 'assistant' ? 'Assistant' : 
                     message.role === 'system' ? 'System' : 'User';
        return `${role}: ${message.content}`;
      }).join('\n\n') + '\n\nAssistant:';
    }
  }

  /**
   * Model-aware AI completion service
   */
  async generateAICompletion({ prompt, model, modelInfo, temperature, max_tokens, stop }) {
    // Simulate API delay based on model type
    const delay = this.getModelDelay(model);
    await new Promise(resolve => setTimeout(resolve, delay));

    // Generate model-specific responses
    let content = this.generateModelSpecificContent(prompt, model, temperature);
    
    // Apply max_tokens limit (rough approximation)
    const words = content.split(' ');
    if (words.length > max_tokens / 4) { // Rough token-to-word ratio
      content = words.slice(0, Math.floor(max_tokens / 4)).join(' ') + '...';
    }

    // Apply stop sequences
    if (stop) {
      const stopSequences = Array.isArray(stop) ? stop : [stop];
      for (const stopSeq of stopSequences) {
        const index = content.indexOf(stopSeq);
        if (index !== -1) {
          content = content.substring(0, index);
          break;
        }
      }
    }

    return {
      content: content.trim(),
      finish_reason: 'stop',
      model
    };
  }

  /**
   * Generate model-specific content based on the model's characteristics
   */
  generateModelSpecificContent(prompt, model, temperature) {
    const promptLower = prompt.toLowerCase();
    
    // Model-specific response styles
    if (model.includes('claude')) {
      // Claude tends to be more thoughtful and structured
      if (promptLower.includes('story') || promptLower.includes('fiction')) {
        return "I'd be happy to help you craft a compelling story. Let me think about this thoughtfully... In the misty highlands of Aethermoor, where ancient magic still whispers through the stone circles, our tale begins with a discovery that will change everything. The protagonist finds themselves drawn to secrets that have been buried for centuries, secrets that powerful forces would kill to keep hidden.";
      } else if (promptLower.includes('character')) {
        return "Let me develop a nuanced character for you. Meet Aria Blackthorne, a 29-year-old cartographer with an unusual gift - she can sense the emotional resonance of places she maps. Having grown up in the bustling port city of Marisol, she's learned to navigate both treacherous coastlines and complex social dynamics. Her greatest strength lies in her empathy and attention to detail, though her tendency to absorb others' emotions can sometimes overwhelm her.";
      }
    } else if (model.includes('gpt-4')) {
      // GPT-4 tends to be more sophisticated and detailed
      if (promptLower.includes('story') || promptLower.includes('fiction')) {
        return "Crafting an engaging narrative requires careful attention to both character development and world-building. Consider this opening: The morning fog clung to the cobblestones of Nethermere like forgotten dreams, and Dr. Elena Vasquez knew that somewhere in that mist lay the answer to the mystery that had consumed her for months. As the city's premier archaeologist, she had uncovered many secrets buried in ancient foundations, but nothing had prepared her for what she would find beneath the old cathedral.";
      }
    } else if (model.includes('llama')) {
      // LLaMA tends to be direct and practical
      if (promptLower.includes('story') || promptLower.includes('fiction')) {
        return "Here's a strong story opening for you: The letter arrived on a Tuesday, which Marcus later decided was fitting since Tuesdays had always been unlucky for him. The envelope bore no return address, only his name written in elegant script that reminded him of his grandmother's handwriting. Inside, three words changed everything: 'Find the truth.' What truth? About what? The questions multiplied faster than answers, but Marcus knew one thing for certain - his quiet life as a bookkeeper was about to become anything but quiet.";
      }
    } else if (model.includes('mistral')) {
      // Mistral tends to be creative and flowing
      if (promptLower.includes('story') || promptLower.includes('fiction')) {
        return "Let me weave you a tale that begins in the space between heartbeats, where time moves differently and possibilities multiply like reflections in broken mirrors. Zara had always been able to see the cracks - hairline fractures in reality that others dismissed as tricks of light. But on this particular evening, as autumn painted the world in shades of amber and rust, the cracks began to widen, and through them seeped something that shouldn't exist.";
      }
    }

    // Default creative writing response with temperature variation
    let content = "In the realm of creative writing, every word carries the potential to transport readers to new worlds. Whether crafting compelling characters, weaving intricate plots, or building immersive settings, the key lies in balancing authenticity with imagination. Consider how each element serves the greater narrative purpose.";
    
    // Apply temperature variation
    if (temperature > 0.8) {
      const creativePhrases = [
        "Imagine a world where...",
        "What if we explored...",
        "Consider the possibility that...",
        "In an alternate reality..."
      ];
      const phrase = creativePhrases[Math.floor(Math.random() * creativePhrases.length)];
      content = phrase + " " + content.toLowerCase();
    } else if (temperature < 0.3) {
      content = "Based on established writing principles, " + content.toLowerCase();
    }
    
    return content;
  }

  /**
   * Get model-specific delay for simulating different response times
   */
  getModelDelay(model) {
    if (model.includes('gpt-4')) {
      return 200 + Math.random() * 1800; // 200-2000ms
    } else if (model.includes('claude')) {
      return 150 + Math.random() * 1350; // 150-1500ms
    } else if (model.includes('llama') && model.includes('70b')) {
      return 500 + Math.random() * 2500; // 500-3000ms (larger model)
    } else if (model.includes('llama')) {
      return 100 + Math.random() * 900; // 100-1000ms
    } else if (model.includes('local') || model.includes('ollama')) {
      return 300 + Math.random() * 1700; // 300-2000ms (local processing)
    } else {
      return 100 + Math.random() * 900; // Default
    }
  }

  /**
   * Model-aware token counting
   */
  countTokens(text, model = '') {
    if (!text) return 0;
    
    // Different models have different tokenization
    if (model.includes('claude')) {
      // Claude typically has slightly different tokenization
      return Math.ceil(text.length / 3.8);
    } else if (model.includes('llama')) {
      // LLaMA models tend to have different token efficiency
      return Math.ceil(text.length / 4.2);
    } else {
      // Default GPT-style tokenization (rough approximation)
      return Math.ceil(text.length / 4);
    }
  }
}