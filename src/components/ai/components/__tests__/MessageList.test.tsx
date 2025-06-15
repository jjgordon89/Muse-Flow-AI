import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageList } from '../MessageList';
import { Message } from '../../types/ai-types';

const mockMessages: Message[] = [
  {
    id: 'msg1',
    role: 'user',
    content: 'Hello, AI!',
    timestamp: new Date('2023-01-01T10:00:00Z'),
  },
  {
    id: 'msg2',
    role: 'assistant',
    content: 'Hello! How can I help you today?',
    timestamp: new Date('2023-01-01T10:01:00Z'),
    model: 'gpt-4',
    tokens: 25,
  },
  {
    id: 'msg3',
    role: 'assistant',
    content: 'This is an error message',
    timestamp: new Date('2023-01-01T10:02:00Z'),
    isError: true,
  }
];

const streamingState = {
  isStreaming: false,
  currentMessage: '',
  messageId: ''
};

const defaultProps = {
  messages: mockMessages,
  streamingState,
  autoScroll: true,
  onCopyMessage: vi.fn(),
  onSpeakText: vi.fn(),
};

describe('MessageList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders messages correctly', () => {
    render(<MessageList {...defaultProps} />);
    
    expect(screen.getByText('Hello, AI!')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
    expect(screen.getByText('This is an error message')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(<MessageList {...defaultProps} messages={[]} />);
    
    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    expect(screen.getByText('Ask me anything about your writing project')).toBeInTheDocument();
  });

  it('displays user and assistant labels correctly', () => {
    render(<MessageList {...defaultProps} />);
    
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getAllByText('Assistant')).toHaveLength(2);
  });

  it('shows model information when available', () => {
    render(<MessageList {...defaultProps} />);
    
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('shows token count when available', () => {
    render(<MessageList {...defaultProps} />);
    
    expect(screen.getByText('25 tokens')).toBeInTheDocument();
  });

  it('applies error styling for error messages', () => {
    render(<MessageList {...defaultProps} />);
    
    const errorMessage = screen.getByText('This is an error message').closest('div');
    expect(errorMessage).toHaveClass('bg-red-50', 'border-red-200', 'text-red-800');
  });

  it('calls onCopyMessage when copy button is clicked', () => {
    render(<MessageList {...defaultProps} />);
    
    const copyButtons = screen.getAllByTitle('Copy message');
    expect(copyButtons).toHaveLength(1);
    fireEvent.click(copyButtons[0]!);
    
    expect(defaultProps.onCopyMessage).toHaveBeenCalledWith('Hello! How can I help you today?');
  });

  it('calls onSpeakText when speak button is clicked', () => {
    render(<MessageList {...defaultProps} />);
    
    const speakButtons = screen.getAllByTitle('Read aloud');
    expect(speakButtons).toHaveLength(1);
    fireEvent.click(speakButtons[0]!);
    
    expect(defaultProps.onSpeakText).toHaveBeenCalledWith('Hello! How can I help you today?');
  });

  it('shows streaming indicator when message is streaming', () => {
    const streamingProps = {
      ...defaultProps,
      streamingState: {
        isStreaming: true,
        currentMessage: 'This is being streamed...',
        messageId: 'msg2'
      }
    };
    
    render(<MessageList {...streamingProps} />);
    
    expect(screen.getByText('This is being streamed...')).toBeInTheDocument();
    expect(screen.getByText('▋')).toBeInTheDocument();
  });

  it('does not show copy/speak buttons for user messages', () => {
    render(<MessageList {...defaultProps} />);
    
    // User message should not have copy/speak buttons
    const userMessageContainer = screen.getByText('Hello, AI!').closest('div');
    expect(userMessageContainer?.querySelector('[title="Copy message"]')).not.toBeInTheDocument();
    expect(userMessageContainer?.querySelector('[title="Read aloud"]')).not.toBeInTheDocument();
  });

  it('does not show copy/speak buttons for error messages', () => {
    render(<MessageList {...defaultProps} />);
    
    // Error message should not have copy/speak buttons
    const errorMessageContainer = screen.getByText('This is an error message').closest('div');
    expect(errorMessageContainer?.querySelector('[title="Copy message"]')).not.toBeInTheDocument();
    expect(errorMessageContainer?.querySelector('[title="Read aloud"]')).not.toBeInTheDocument();
  });

  it('renders message attachments when present', () => {
    const messagesWithAttachments: Message[] = [
      {
        id: 'msg1',
        role: 'user',
        content: 'Here is a file',
        timestamp: new Date(),
        attachments: [
          {
            id: 'att1',
            name: 'document.pdf',
            type: 'application/pdf',
            size: 1024,
          },
          {
            id: 'att2',
            name: 'image.png',
            type: 'image/png',
            size: 2048,
          }
        ]
      }
    ];

    render(<MessageList {...defaultProps} messages={messagesWithAttachments} />);
    
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('image.png')).toBeInTheDocument();
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('formats timestamps correctly', () => {
    // Mock Date.now to return a fixed time for consistent testing
    const fixedTime = new Date('2023-01-01T10:05:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(fixedTime);
    
    render(<MessageList {...defaultProps} />);
    
    // Messages are 5, 4, and 3 minutes old respectively
    expect(screen.getByText('5m ago')).toBeInTheDocument();
    expect(screen.getByText('4m ago')).toBeInTheDocument();
    expect(screen.getByText('3m ago')).toBeInTheDocument();
    
    vi.restoreAllMocks();
  });
});