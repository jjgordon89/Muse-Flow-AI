import { useCallback } from 'react';
import { useDatabase as useDatabaseContext } from '../contexts/DatabaseContext';
import { 
  ProjectRecord, 
  CharacterRecord, 
  SemanticSearchOptions,
  SemanticSearchResult 
} from '../database/types/database-types';

export function useDatabase() {
  return useDatabaseContext();
}

// Specific hooks for common operations
export function useProjects() {
  const { actions } = useDatabase();
  
  return {
    createProject: actions.createProject,
    getProjects: actions.getProjects,
    getProject: actions.getProject,
    updateProject: actions.updateProject,
    deleteProject: actions.deleteProject
  };
}

export function useCharacters(projectId?: string) {
  const { actions } = useDatabase();
  
  const getCharacters = useCallback(async () => {
    if (!projectId) return [];
    return await actions.getCharacters(projectId);
  }, [actions.getCharacters, projectId]);

  const createCharacter = useCallback(async (characterData: Omit<CharacterRecord, 'id' | 'project_id' | 'created_at' | 'updated_at'>) => {
    if (!projectId) throw new Error('Project ID required');
    return await actions.createCharacter(projectId, characterData);
  }, [actions.createCharacter, projectId]);

  return {
    getCharacters,
    createCharacter,
    updateCharacter: actions.updateCharacter,
    deleteCharacter: actions.deleteCharacter
  };
}

export function useContent(projectId?: string) {
  const { actions } = useDatabase();
  
  const addContent = useCallback(async (contentType: string, text: string, contentId?: string) => {
    if (!projectId) throw new Error('Project ID required');
    return await actions.addContent(projectId, contentType, text, contentId);
  }, [actions.addContent, projectId]);

  return {
    addContent,
    updateContent: actions.updateContent,
    deleteContent: actions.deleteContent
  };
}

export function useSemanticSearch() {
  const { actions } = useDatabase();
  
  const search = useCallback(async (query: string, options?: Partial<SemanticSearchOptions>): Promise<SemanticSearchResult[]> => {
    return await actions.semanticSearch({
      query,
      similarity_threshold: 0.7,
      max_results: 20,
      ...options
    });
  }, [actions.semanticSearch]);

  return {
    search,
    findSimilarContent: actions.findSimilarContent
  };
}

export function useDatabaseManagement() {
  const { actions } = useDatabase();
  
  return {
    backup: actions.backup,
    restore: actions.restore,
    getStats: actions.getStats,
    clearCache: actions.clearCache,
    syncProject: actions.syncProject,
    validateIntegrity: actions.validateIntegrity
  };
}