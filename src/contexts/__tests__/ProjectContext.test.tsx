import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ProjectProvider, useProject } from '../ProjectContext';
import { Project } from '../../types';

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProjectProvider>{children}</ProjectProvider>
);

describe('ProjectContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should provide default project state', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    expect(result.current.state.currentProject.title).toBe('Untitled Novel');
    expect(result.current.state.currentProject.characters).toEqual([]);
    expect(result.current.state.currentProject.storyArcs).toEqual([]);
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.isSaving).toBe(false);
  });

  it('should update project', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    act(() => {
      result.current.actions.updateProject({ title: 'New Title' });
    });

    expect(result.current.state.currentProject.title).toBe('New Title');
    expect(result.current.state.isDirty).toBe(true);
  });

  it('should add character', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    const newCharacter = {
      name: 'Test Character',
      role: 'protagonist' as const,
      description: 'A test character',
      backstory: 'Test backstory',
      traits: ['brave'],
      relationships: [],
      notes: 'Test notes',
    };

    act(() => {
      result.current.actions.addCharacter(newCharacter);
    });

    expect(result.current.state.currentProject.characters).toHaveLength(1);
    expect(result.current.state.currentProject.characters[0]?.name).toBe('Test Character');
    expect(result.current.state.isDirty).toBe(true);
  });

  it('should update character', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    // First add a character
    act(() => {
      result.current.actions.addCharacter({
        name: 'Test Character',
        role: 'protagonist',
        description: 'A test character',
        backstory: 'Test backstory',
        traits: ['brave'],
        relationships: [],
        notes: 'Test notes',
      });
    });

    const characterId = result.current.state.currentProject.characters[0]?.id;

    act(() => {
      result.current.actions.updateCharacter(characterId!, { name: 'Updated Character' });
    });

    expect(result.current.state.currentProject.characters[0]?.name).toBe('Updated Character');
  });

  it('should delete character', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    // First add a character
    act(() => {
      result.current.actions.addCharacter({
        name: 'Test Character',
        role: 'protagonist',
        description: 'A test character',
        backstory: 'Test backstory',
        traits: ['brave'],
        relationships: [],
        notes: 'Test notes',
      });
    });

    const characterId = result.current.state.currentProject.characters[0]?.id;

    act(() => {
      result.current.actions.deleteCharacter(characterId!);
    });

    expect(result.current.state.currentProject.characters).toHaveLength(0);
  });

  it('should handle saving project', async () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    await act(async () => {
      await result.current.actions.saveProject();
    });

    expect(result.current.state.isSaving).toBe(false);
    expect(result.current.state.isDirty).toBe(false);
    expect(result.current.state.lastSaved).toBeTruthy();
  });

  it('should create new project', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    act(() => {
      result.current.actions.updateProject({ title: 'Modified' });
    });

    expect(result.current.state.isDirty).toBe(true);

    act(() => {
      result.current.actions.createNewProject();
    });

    expect(result.current.state.currentProject.title).toBe('Untitled Novel');
    expect(result.current.state.isDirty).toBe(false);
    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useProject());
    }).toThrow('useProject must be used within a ProjectProvider');
  });
});