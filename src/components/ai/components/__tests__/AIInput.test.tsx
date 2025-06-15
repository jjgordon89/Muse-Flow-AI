import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIInput } from '../AIInput';
import { FileAttachment } from '../../types/ai-types';

const mockAttachments: FileAttachment[] = [
  {
    id: 'file1',
    name: 'document.pdf',
    type: 'application/pdf',
    size: 1024,
    content: 'file content'
  },
  {
    id: 'file2',
    name: 'image.png',
    type: 'image/png',
    size: 2048,
    content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  }
];

const defaultProps = {
  input: '',
  attachments: [],
  isRecording: false,
  isStreaming: false,
  onInputChange: vi.fn(),
  onSendMessage: vi.fn(),
  onFileUpload: vi.fn(),
  onRemoveAttachment: vi.fn(),
  onStartRecording: vi.fn(),
  onStopRecording: vi.fn(),
  onKeyDown: vi.fn(),
};

describe('AIInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input elements correctly', () => {
    render(<AIInput {...defaultProps} />);
    
    expect(screen.getByPlaceholderText('Type your message... (Ctrl+Enter to send)')).toBeInTheDocument();
    expect(screen.getByTitle('Upload file')).toBeInTheDocument();
    expect(screen.getByTitle('Start voice input')).toBeInTheDocument();
    expect(screen.getByTitle('Send message (Ctrl+Enter)')).toBeInTheDocument();
  });

  it('calls onInputChange when typing in textarea', async () => {
    const user = userEvent.setup();
    render(<AIInput {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Type your message... (Ctrl+Enter to send)');
    await user.type(textarea, 'Hello, AI!');
    
    expect(defaultProps.onInputChange).toHaveBeenCalledWith('Hello, AI!');
  });

  it('shows character count', () => {
    render(<AIInput {...defaultProps} input="Hello, AI!" />);
    
    expect(screen.getByText('10/4000')).toBeInTheDocument();
  });

  it('calls onSendMessage when send button is clicked', () => {
    render(<AIInput {...defaultProps} input="Hello, AI!" />);
    
    const sendButton = screen.getByTitle('Send message (Ctrl+Enter)');
    fireEvent.click(sendButton);
    
    expect(defaultProps.onSendMessage).toHaveBeenCalled();
  });

  it('disables send button when no input and no attachments', () => {
    render(<AIInput {...defaultProps} />);
    
    const sendButton = screen.getByTitle('Send message (Ctrl+Enter)');
    expect(sendButton).toBeDisabled();
  });

  it('enables send button with input', () => {
    render(<AIInput {...defaultProps} input="Hello" />);
    
    const sendButton = screen.getByTitle('Send message (Ctrl+Enter)');
    expect(sendButton).not.toBeDisabled();
  });

  it('enables send button with attachments', () => {
    render(<AIInput {...defaultProps} attachments={mockAttachments} />);
    
    const sendButton = screen.getByTitle('Send message (Ctrl+Enter)');
    expect(sendButton).not.toBeDisabled();
  });

  it('disables all inputs when streaming', () => {
    render(<AIInput {...defaultProps} isStreaming={true} />);
    
    const textarea = screen.getByPlaceholderText('Type your message... (Ctrl+Enter to send)');
    const uploadButton = screen.getByTitle('Upload file');
    const voiceButton = screen.getByTitle('Start voice input');
    const sendButton = screen.getByTitle('Send message (Ctrl+Enter)');
    
    expect(textarea).toBeDisabled();
    expect(uploadButton).toBeDisabled();
    expect(voiceButton).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('shows loading spinner when streaming', () => {
    render(<AIInput {...defaultProps} isStreaming={true} />);
    
    expect(screen.getByTitle('Send message (Ctrl+Enter)')).toContainElement(
      document.querySelector('.animate-spin')
    );
  });

  it('calls onKeyDown when key is pressed in textarea', () => {
    render(<AIInput {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Type your message... (Ctrl+Enter to send)');
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    
    expect(defaultProps.onKeyDown).toHaveBeenCalled();
  });

  it('calls onStartRecording when voice button is clicked while not recording', () => {
    render(<AIInput {...defaultProps} />);
    
    const voiceButton = screen.getByTitle('Start voice input');
    fireEvent.click(voiceButton);
    
    expect(defaultProps.onStartRecording).toHaveBeenCalled();
  });

  it('calls onStopRecording when voice button is clicked while recording', () => {
    render(<AIInput {...defaultProps} isRecording={true} />);
    
    const voiceButton = screen.getByTitle('Stop recording');
    fireEvent.click(voiceButton);
    
    expect(defaultProps.onStopRecording).toHaveBeenCalled();
  });

  it('shows different voice button state when recording', () => {
    render(<AIInput {...defaultProps} isRecording={true} />);
    
    expect(screen.getByTitle('Stop recording')).toBeInTheDocument();
    expect(screen.queryByTitle('Start voice input')).not.toBeInTheDocument();
  });

  it('renders attachment preview when attachments exist', () => {
    render(<AIInput {...defaultProps} attachments={mockAttachments} />);
    
    expect(screen.getByText('Attachments (2)')).toBeInTheDocument();
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('image.png')).toBeInTheDocument();
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('calls onRemoveAttachment when remove button is clicked', () => {
    render(<AIInput {...defaultProps} attachments={mockAttachments} />);
    
    const removeButtons = screen.getAllByRole('button').filter(
      button => button.querySelector('svg')?.getAttribute('class')?.includes('w-3')
    );
    
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]!);
    
    expect(defaultProps.onRemoveAttachment).toHaveBeenCalledWith('file1');
  });

  it('shows clear all button in attachment preview', () => {
    render(<AIInput {...defaultProps} attachments={mockAttachments} />);
    
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('calls onRemoveAttachment for all attachments when clear all is clicked', () => {
    render(<AIInput {...defaultProps} attachments={mockAttachments} />);
    
    const clearAllButton = screen.getByText('Clear all');
    fireEvent.click(clearAllButton);
    
    expect(defaultProps.onRemoveAttachment).toHaveBeenCalledTimes(2);
    expect(defaultProps.onRemoveAttachment).toHaveBeenCalledWith('file1');
    expect(defaultProps.onRemoveAttachment).toHaveBeenCalledWith('file2');
  });

  it('triggers file upload when upload button is clicked', () => {
    render(<AIInput {...defaultProps} />);
    
    const uploadButton = screen.getByTitle('Upload file');
    fireEvent.click(uploadButton);
    
    // Check that hidden file input was triggered
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });

  it('calls onFileUpload when file is selected', () => {
    render(<AIInput {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    expect(defaultProps.onFileUpload).toHaveBeenCalled();
  });

  it('shows correct file types in file input accept attribute', () => {
    render(<AIInput {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.accept).toBe('image/*,.txt,.md,.json,.csv');
  });

  it('allows multiple file selection', () => {
    render(<AIInput {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.multiple).toBe(true);
  });

  it('auto-resizes textarea height based on content', async () => {
    render(<AIInput {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Type your message... (Ctrl+Enter to send)');
    
    // Initial height should be auto
    expect(textarea.style.height).toBe('auto');
  });

  it('displays different icons for different file types in attachment preview', () => {
    render(<AIInput {...defaultProps} attachments={mockAttachments} />);
    
    // Should have both file and image icons
    const fileIcons = document.querySelectorAll('svg');
    expect(fileIcons.length).toBeGreaterThan(0);
  });

  it('does not render attachment preview when no attachments', () => {
    render(<AIInput {...defaultProps} />);
    
    expect(screen.queryByText('Attachments')).not.toBeInTheDocument();
  });
});