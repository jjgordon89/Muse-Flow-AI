/**
 * AI Assistant Integration Verification Test Suite
 * Tests all integration points for the AI Assistant component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AIPanel } from '../../components/sidebar/AIPanel';
import { AIService, AIRequest, AIResponse, AISettings } from '../../services/aiProviders';

// Mock the AIService by extending it properly
class MockAIService extends AIService {
  private mockSettings: AISettings;

  constructor() {
    const settings: AISettings = {
      providers: {
        openai: { isEnabled: true, selectedModel: 'gpt-4', apiKey: 'test-key' }
      },
      defaultProvider: 'openai',
      temperature: 0.7,
      maxTokens: 1500
    };
    super(settings);
    this.mockSettings = settings;
  }

  override async generateContent(request: AIRequest): Promise<AIResponse> {
    // Use request parameter to make it realistic
    const mockResponse: AIResponse = {
      content: request.prompt ? `Generated AI content for: ${request.prompt}` : 'Generated AI content',
      provider: 'openai',
      model: 'gpt-4',
      usage: {
        promptTokens: 50,
        completionTokens: 100,
        totalTokens: 150
      }
    };
    return mockResponse;
  }

  override getSettings(): AISettings {
    return { ...this.mockSettings };
  }

  override updateSettings(newSettings: Partial<AISettings>): void {
    this.mockSettings = { ...this.mockSettings, ...newSettings };
  }
}

describe('AI Assistant Integration Tests', () => {
  let mockAIService: MockAIService;
  let generateContentSpy: MockInstance<[AIRequest], Promise<AIResponse>>;
  let getSettingsSpy: MockInstance<[], AISettings>;

  beforeEach(() => {
    // Create fresh mock service for each test
    mockAIService = new MockAIService();
    // Set up spies that don't interfere with the implementation
    generateContentSpy = vi.spyOn(mockAIService, 'generateContent');
    getSettingsSpy = vi.spyOn(mockAIService, 'getSettings');
  });

  afterEach(() => {
    // Only clear call history, don't reset implementations
    vi.clearAllMocks();
  });
  describe('Mock Service Verification', () => {
    it('should have working mock service', () => {
      const settings = mockAIService.getSettings();
      expect(settings).toBeDefined();
      expect(settings.defaultProvider).toBe('openai');
      expect(settings.providers['openai']?.isEnabled).toBe(true);
    });
  });
  describe('Component Rendering', () => {
    it('should render AI panel successfully', async () => {
      const mockOnShowSettings = vi.fn();
      
      render(
        React.createElement(AIPanel, {
          aiService: mockAIService,
          onShowSettings: mockOnShowSettings
        })
      );

      // Look for panel container
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(screen.getByText('Custom Prompt')).toBeInTheDocument();
      expect(screen.getByText('Quick Prompts')).toBeInTheDocument();
    });
  });
  describe('AI Service Integration', () => {
    it('should generate content successfully', async () => {
      const mockOnShowSettings = vi.fn();
      
      render(
        React.createElement(AIPanel, {
          aiService: mockAIService,
          onShowSettings: mockOnShowSettings
        })
      );

      // Find textarea and generate button
      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i);
      const generateButton = screen.getByText('Generate');

      // Enter text and click generate
      fireEvent.change(textarea, { target: { value: 'Test prompt' } });
      fireEvent.click(generateButton);

      // Wait for generation to complete
      await waitFor(() => {
        expect(generateContentSpy).toHaveBeenCalled();
      });
    });    it('should handle AI service errors gracefully', async () => {
      // Create a spy that will reject for this specific test
      const tempGenerateContentSpy = vi.spyOn(mockAIService, 'generateContent').mockRejectedValue(new Error('API Error'));
      
      const mockOnShowSettings = vi.fn();
      
      render(
        React.createElement(AIPanel, {
          aiService: mockAIService,
          onShowSettings: mockOnShowSettings
        })
      );

      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i);
      const generateButton = screen.getByText('Generate');

      fireEvent.change(textarea, { target: { value: 'Test prompt' } });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generation Failed')).toBeInTheDocument();
        expect(screen.getByText('API Error')).toBeInTheDocument();
      });

      // Restore the spy
      tempGenerateContentSpy.mockRestore();
    });
  });
  describe('Settings Integration', () => {
    it('should handle settings button click', async () => {
      const mockOnShowSettings = vi.fn();
      
      render(
        React.createElement(AIPanel, {
          aiService: mockAIService,
          onShowSettings: mockOnShowSettings
        })
      );

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);

      expect(mockOnShowSettings).toHaveBeenCalled();
    });

    it('should load AI settings on mount', async () => {
      const mockOnShowSettings = vi.fn();
      
      render(
        React.createElement(AIPanel, {
          aiService: mockAIService,
          onShowSettings: mockOnShowSettings
        })
      );

      // Settings should be loaded on component mount
      expect(getSettingsSpy).toHaveBeenCalled();
    });
  });
  describe('Quick Prompts Integration', () => {
    it('should handle quick prompt selection', async () => {
      const mockOnShowSettings = vi.fn();
      
      render(
        React.createElement(AIPanel, {
          aiService: mockAIService,
          onShowSettings: mockOnShowSettings
        })
      );

      // Find and click a quick prompt button
      const quickPromptButton = screen.getByText(/Create a complex backstory for my character/i);
      fireEvent.click(quickPromptButton);

      // Should trigger AI generation
      await waitFor(() => {
        expect(generateContentSpy).toHaveBeenCalled();
      });
    });
  });
  describe('Error Handling', () => {    it('should display service initialization errors', async () => {
      const errorService = new MockAIService();
      const errorSpy = vi.spyOn(errorService, 'generateContent').mockRejectedValue(new Error('Service not initialized'));
      
      const mockOnShowSettings = vi.fn();
      
      render(
        React.createElement(AIPanel, {
          aiService: errorService,
          onShowSettings: mockOnShowSettings
        })
      );

      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i);
      const generateButton = screen.getByText('Generate');

      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generation Failed')).toBeInTheDocument();
        expect(screen.getByText('Service not initialized')).toBeInTheDocument();
      });

      errorSpy.mockRestore();
    });    it('should handle network connectivity issues', async () => {
      const tempSpy = vi.spyOn(mockAIService, 'generateContent').mockRejectedValue(new Error('Network error'));
      const mockOnShowSettings = vi.fn();
      
      render(
        React.createElement(AIPanel, {
          aiService: mockAIService,
          onShowSettings: mockOnShowSettings
        })
      );

      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i);
      const generateButton = screen.getByText('Generate');

      fireEvent.change(textarea, { target: { value: 'Test prompt' } });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generation Failed')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      tempSpy.mockRestore();
    });
  });
  describe('Performance Monitoring', () => {
    it('should track generation timing', async () => {
      const mockOnShowSettings = vi.fn();
      
      render(
        React.createElement(AIPanel, {
          aiService: mockAIService,
          onShowSettings: mockOnShowSettings
        })
      );

      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i);
      const generateButton = screen.getByText('Generate');

      const startTime = Date.now();
      
      fireEvent.change(textarea, { target: { value: 'Performance test' } });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(generateContentSpy).toHaveBeenCalled();
      });

      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThan(0);
    });    it('should handle concurrent requests properly', async () => {
      const mockOnShowSettings = vi.fn();
      
      render(
        React.createElement(AIPanel, {
          aiService: mockAIService,
          onShowSettings: mockOnShowSettings
        })
      );

      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i);
      const generateButton = screen.getByText('Generate');

      // Simulate multiple rapid clicks
      fireEvent.change(textarea, { target: { value: 'Concurrent test' } });
      fireEvent.click(generateButton);
      fireEvent.click(generateButton);
      fireEvent.click(generateButton);

      await waitFor(() => {
        // Should only process one request at a time
        expect(generateContentSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
  describe('End-to-End Integration Flow', () => {
    it('should handle complete AI generation workflow', async () => {
      const mockOnShowSettings = vi.fn();
      
      render(
        React.createElement(AIPanel, {
          aiService: mockAIService,
          onShowSettings: mockOnShowSettings
        })
      );

      // Step 1: Enter prompt
      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i);
      fireEvent.change(textarea, { target: { value: 'Write a short story about a robot' } });

      // Step 2: Generate content
      const generateButton = screen.getByText('Generate');
      fireEvent.click(generateButton);

      // Step 3: Wait for completion and verify result
      await waitFor(() => {
        expect(screen.getByText('Generated Content')).toBeInTheDocument();
      });

      // Step 4: Verify service was called correctly
      expect(generateContentSpy).toHaveBeenCalledWith({
        prompt: 'Write a short story about a robot',
        type: 'custom',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1500
      });
    });

    it('should maintain generation history', async () => {
      const mockOnShowSettings = vi.fn();
      
      render(
        React.createElement(AIPanel, {
          aiService: mockAIService,
          onShowSettings: mockOnShowSettings
        })
      );

      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i);
      const generateButton = screen.getByText('Generate');

      // Generate first content
      fireEvent.change(textarea, { target: { value: 'First prompt' } });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generated Content')).toBeInTheDocument();
      });

      // Generate second content
      fireEvent.change(textarea, { target: { value: 'Second prompt' } });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(generateContentSpy).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle copy to clipboard functionality', async () => {
      // Mock clipboard API
      const writeTextMock = vi.fn();
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        writable: true
      });

      const mockOnShowSettings = vi.fn();
      
      render(
        React.createElement(AIPanel, {
          aiService: mockAIService,
          onShowSettings: mockOnShowSettings
        })
      );

      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i);
      const generateButton = screen.getByText('Generate');

      // Generate content first
      fireEvent.change(textarea, { target: { value: 'Copy test' } });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generated Content')).toBeInTheDocument();
      });

      // Find and click copy button
      const copyButton = screen.getByText('Copy');
      fireEvent.click(copyButton);

      expect(writeTextMock).toHaveBeenCalled();
    });
  });
});