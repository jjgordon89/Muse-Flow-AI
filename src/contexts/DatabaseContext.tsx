import React, { createContext, useReducer, useCallback, useEffect } from 'react';
import { DatabaseManager } from '../database/managers/DatabaseManager';
import { EmbeddingManager } from '../ai/embeddings/EmbeddingManager';
import { 
  DatabaseConfig, 
  ProjectRecord, 
  CharacterRecord, 
  SemanticSearchOptions,
  SemanticSearchResult,
  DatabaseError 
} from '../database/types/database-types';
import { useAsyncErrorHandler } from '../hooks/useAsyncErrorHandler';

interface DatabaseState {
  isInitialized: boolean;
  isInitializing: boolean;
  connectionStatus: {
    sqlite: boolean;
    lancedb: boolean;
  };
  lastError: string | null;
  stats: {
    sqlite: { size: number; pageCount: number; pageSize: number };
    vector: { count: number; size: number };
    sync: { lastSync: Date | null; inProgress: boolean; totalEmbeddings: number };
  } | null;
}

type DatabaseAction =
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; payload: { sqlite: boolean; lancedb: boolean } }
  | { type: 'INIT_ERROR'; payload: string }
  | { type: 'UPDATE_CONNECTION_STATUS'; payload: { sqlite: boolean; lancedb: boolean } }
  | { type: 'UPDATE_STATS'; payload: DatabaseState['stats'] }
  | { type: 'CLEAR_ERROR' };

interface DatabaseContextValue {
  state: DatabaseState;
  actions: {
    // Core database operations
    createProject: (projectData: {
      title: string;
      description?: string;
      genre?: string;
      targetWordCount?: number;
    }) => Promise<string>;
    
    getProjects: () => Promise<ProjectRecord[]>;
    getProject: (id: string) => Promise<ProjectRecord | null>;
    updateProject: (id: string, updates: Partial<ProjectRecord>) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    
    // Character operations
    createCharacter: (projectId: string, characterData: Omit<CharacterRecord, 'id' | 'project_id' | 'created_at' | 'updated_at'>) => Promise<string>;
    getCharacters: (projectId: string) => Promise<CharacterRecord[]>;
    updateCharacter: (id: string, updates: Partial<CharacterRecord>) => Promise<void>;
    deleteCharacter: (id: string) => Promise<void>;
    
    // Content operations
    addContent: (projectId: string, contentType: string, text: string, contentId?: string) => Promise<string>;
    updateContent: (contentBlockId: string, newText: string) => Promise<void>;
    deleteContent: (contentBlockId: string) => Promise<void>;
    
    // AI-powered search and recommendations
    semanticSearch: (options: SemanticSearchOptions) => Promise<SemanticSearchResult[]>;
    findSimilarContent: (contentId: string, limit?: number) => Promise<SemanticSearchResult[]>;
    
    // Database management
    backup: () => Promise<{ sqlite: Uint8Array; timestamp: Date }>;
    restore: (backupData: { sqlite: Uint8Array }) => Promise<void>;
    getStats: () => Promise<void>;
    clearCache: () => void;
    
    // Sync operations
    syncProject: (projectId: string) => Promise<void>;
    validateIntegrity: () => Promise<{ isValid: boolean; errors?: string[] }>;
    
    // Error handling
    clearError: () => void;
  };
}

export const DatabaseContext = createContext<DatabaseContextValue | undefined>(undefined);

const initialState: DatabaseState = {
  isInitialized: false,
  isInitializing: false,
  connectionStatus: {
    sqlite: false,
    lancedb: false
  },
  lastError: null,
  stats: null
};

function databaseReducer(state: DatabaseState, action: DatabaseAction): DatabaseState {
  switch (action.type) {
    case 'INIT_START':
      return {
        ...state,
        isInitializing: true,
        lastError: null
      };

    case 'INIT_SUCCESS':
      return {
        ...state,
        isInitialized: true,
        isInitializing: false,
        connectionStatus: action.payload,
        lastError: null
      };

    case 'INIT_ERROR':
      return {
        ...state,
        isInitialized: false,
        isInitializing: false,
        lastError: action.payload
      };

    case 'UPDATE_CONNECTION_STATUS':
      return {
        ...state,
        connectionStatus: action.payload
      };

    case 'UPDATE_STATS':
      return {
        ...state,
        stats: action.payload
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        lastError: null
      };

    default:
      return state;
  }
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(databaseReducer, initialState);
  const { reportError, wrapAsync } = useAsyncErrorHandler({ component: 'DatabaseProvider' });
  
  // Database manager instances
  const [databaseManager, setDatabaseManager] = React.useState<DatabaseManager | null>(null);
  const [embeddingManager, setEmbeddingManager] = React.useState<EmbeddingManager | null>(null);

  // Initialize database system
  useEffect(() => {
    const initializeDatabase = async () => {
      dispatch({ type: 'INIT_START' });

      try {
        console.log('Initializing database system...');

        // Create embedding manager
        const embeddingMgr = new EmbeddingManager({
          primaryProvider: 'onnx-minilm',
          fallbackProviders: [],
          cacheConfig: {
            maxSize: 5000,
            ttlSeconds: 86400,
            persistToDisk: true
          }
        });

        await embeddingMgr.initialize();
        setEmbeddingManager(embeddingMgr);

        // Create database configuration
        const config: DatabaseConfig = {
          sqlite: {
            filename: 'muse-flow.db',
            enableWAL: true,
            cacheSize: 10000,
            busyTimeout: 30000
          },
          lancedb: {
            uri: './lancedb',
            tableName: 'embeddings',
            dimensions: embeddingMgr.getDimensions()
          },
          embedding: {
            provider: 'local',
            model: 'all-MiniLM-L6-v2',
            batchSize: 32,
            cacheSize: 5000
          }
        };

        // Create and initialize database manager
        const dbManager = new DatabaseManager(config, embeddingMgr);
        await dbManager.initialize();
        setDatabaseManager(dbManager);

        // Get initial connection status
        const connectionInfo = dbManager.getConnectionInfo();
        dispatch({ 
          type: 'INIT_SUCCESS', 
          payload: connectionInfo 
        });

        // Get initial stats
        try {
          const stats = await dbManager.getStats();
          dispatch({ type: 'UPDATE_STATS', payload: stats });
        } catch (error) {
          console.warn('Failed to get initial stats:', error);
        }

        console.log('Database system initialized successfully');

      } catch (error) {
        console.error('Database initialization failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
        dispatch({ type: 'INIT_ERROR', payload: errorMessage });
        reportError(error, { component: 'database-initialization' });
      }
    };

    // Only initialize once
    if (!state.isInitialized && !state.isInitializing) {
      initializeDatabase();
    }

    // Cleanup on unmount
    return () => {
      if (databaseManager) {
        databaseManager.close().catch(console.error);
      }
      if (embeddingManager) {
        embeddingManager.close().catch(console.error);
      }
    };
  }, []); // Empty dependency array - only run once

  // Periodic status checks
  useEffect(() => {
    if (!databaseManager || !state.isInitialized) return;

    const statusInterval = setInterval(() => {
      const connectionInfo = databaseManager.getConnectionInfo();
      dispatch({ type: 'UPDATE_CONNECTION_STATUS', payload: connectionInfo });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(statusInterval);
  }, [databaseManager, state.isInitialized]);

  // Actions
  const actions = {
    // Project operations
    createProject: useCallback(async (projectData: {
      title: string;
      description?: string;
      genre?: string;
      targetWordCount?: number;
    }) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        return await databaseManager.createProject(projectData);
      }, { action: 'create-project' });
    }, [databaseManager, wrapAsync]),

    getProjects: useCallback(async () => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        return await databaseManager.sqlite.query<ProjectRecord>('SELECT * FROM projects ORDER BY updated_at DESC');
      }, { action: 'get-projects' });
    }, [databaseManager, wrapAsync]),

    getProject: useCallback(async (id: string) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        const projects = await databaseManager.sqlite.query<ProjectRecord>('SELECT * FROM projects WHERE id = ?', [id]);
        return projects.length > 0 ? projects[0]! : null;
      }, { action: 'get-project' });
    }, [databaseManager, wrapAsync]),

    updateProject: useCallback(async (id: string, updates: Partial<ProjectRecord>) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), new Date().toISOString(), id];
        
        await databaseManager.sqlite.run(
          `UPDATE projects SET ${setClauses}, updated_at = ? WHERE id = ?`,
          values
        );
      }, { action: 'update-project' });
    }, [databaseManager, wrapAsync]),

    deleteProject: useCallback(async (id: string) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        await databaseManager.deleteProjectWithEmbeddings(id);
      }, { action: 'delete-project' });
    }, [databaseManager, wrapAsync]),

    // Character operations
    createCharacter: useCallback(async (projectId: string, characterData: Omit<CharacterRecord, 'id' | 'project_id' | 'created_at' | 'updated_at'>) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        const characterId = `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        await databaseManager.sqlite.run(
          `INSERT INTO characters (id, project_id, name, role, age, description, backstory, traits, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            characterId,
            projectId,
            characterData.name,
            characterData.role,
            characterData.age,
            characterData.description,
            characterData.backstory,
            JSON.stringify(characterData.traits || []),
            characterData.notes,
            now,
            now
          ]
        );

        // Create embedding for character
        const characterText = `${characterData.name}. ${characterData.description || ''} ${characterData.backstory || ''}`.trim();
        if (characterText.length > 10) {
          await databaseManager.sync.syncContentToVector(characterId, 'character');
        }

        return characterId;
      }, { action: 'create-character' });
    }, [databaseManager, wrapAsync]),

    getCharacters: useCallback(async (projectId: string) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        return await databaseManager.sqlite.query<CharacterRecord>(
          'SELECT * FROM characters WHERE project_id = ? ORDER BY name',
          [projectId]
        );
      }, { action: 'get-characters' });
    }, [databaseManager, wrapAsync]),

    updateCharacter: useCallback(async (id: string, updates: Partial<CharacterRecord>) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), new Date().toISOString(), id];
        
        await databaseManager.sqlite.run(
          `UPDATE characters SET ${setClauses}, updated_at = ? WHERE id = ?`,
          values
        );

        // Re-sync embedding if description fields changed
        if (updates.description || updates.backstory || updates.name) {
          await databaseManager.sync.syncContentToVector(id, 'character');
        }
      }, { action: 'update-character' });
    }, [databaseManager, wrapAsync]),

    deleteCharacter: useCallback(async (id: string) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        await databaseManager.sqlite.run('DELETE FROM characters WHERE id = ?', [id]);
        await databaseManager.sync.deleteContentEmbedding(id, 'character');
      }, { action: 'delete-character' });
    }, [databaseManager, wrapAsync]),

    // Content operations
    addContent: useCallback(async (projectId: string, contentType: string, text: string, contentId?: string) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        return await databaseManager.addContentWithEmbedding(projectId, contentType, text, contentId);
      }, { action: 'add-content' });
    }, [databaseManager, wrapAsync]),

    updateContent: useCallback(async (contentBlockId: string, newText: string) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        await databaseManager.updateContentWithEmbedding(contentBlockId, newText);
      }, { action: 'update-content' });
    }, [databaseManager, wrapAsync]),

    deleteContent: useCallback(async (contentBlockId: string) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        await databaseManager.deleteContentWithEmbedding(contentBlockId);
      }, { action: 'delete-content' });
    }, [databaseManager, wrapAsync]),

    // AI-powered operations
    semanticSearch: useCallback(async (options: SemanticSearchOptions) => {
      if (!databaseManager || !embeddingManager) {
        throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      }
      
      return await wrapAsync(async () => {
        // Generate embedding for search query
        const queryEmbeddings = await embeddingManager.generateEmbeddings([options.query]);
        const queryVector = queryEmbeddings[0];

        if (!queryVector) {
          throw new DatabaseError('Failed to generate search embedding', 'EMBEDDING_ERROR');
        }

        // Perform vector search
        return await databaseManager.vector.search(queryVector, options);
      }, { action: 'semantic-search' });
    }, [databaseManager, embeddingManager, wrapAsync]),

    findSimilarContent: useCallback(async (contentId: string, limit: number = 10) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        // Use the LanceDB manager's existing method
        const sourceEmbedding = await databaseManager.vector.getEmbedding(`emb_content_block_${contentId}`);
        if (!sourceEmbedding) {
          return [];
        }
        
        return await databaseManager.vector.search(sourceEmbedding.embedding_vector, {
          query: '',
          max_results: limit + 1,
          similarity_threshold: 0.7,
          project_id: sourceEmbedding.project_id
        }).then(results =>
          results.filter(result => result.id !== sourceEmbedding.id)
        );
      }, { action: 'find-similar-content' });
    }, [databaseManager, wrapAsync]),

    // Database management
    backup: useCallback(async () => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        return await databaseManager.backup();
      }, { action: 'backup' });
    }, [databaseManager, wrapAsync]),

    restore: useCallback(async (backupData: { sqlite: Uint8Array }) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        await databaseManager.restore(backupData);
        
        // Update connection status after restore
        const connectionInfo = databaseManager.getConnectionInfo();
        dispatch({ type: 'UPDATE_CONNECTION_STATUS', payload: connectionInfo });
      }, { action: 'restore' });
    }, [databaseManager, wrapAsync]),

    getStats: useCallback(async () => {
      if (!databaseManager) return;
      
      try {
        const stats = await databaseManager.getStats();
        dispatch({ type: 'UPDATE_STATS', payload: stats });
      } catch (error) {
        console.warn('Failed to get database stats:', error);
      }
    }, [databaseManager]),

    clearCache: useCallback(() => {
      if (embeddingManager) {
        embeddingManager.clearCache();
      }
    }, [embeddingManager]),

    // Sync operations
    syncProject: useCallback(async (projectId: string) => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        await databaseManager.sync.syncProjectEmbeddings(projectId);
      }, { action: 'sync-project' });
    }, [databaseManager, wrapAsync]),

    validateIntegrity: useCallback(async () => {
      if (!databaseManager) throw new DatabaseError('Database not initialized', 'NOT_INITIALIZED');
      
      return await wrapAsync(async () => {
        return await databaseManager.sync.validateDataIntegrity();
      }, { action: 'validate-integrity' });
    }, [databaseManager, wrapAsync]),

    // Error handling
    clearError: useCallback(() => {
      dispatch({ type: 'CLEAR_ERROR' });
    }, [])
  };
  return (
    <DatabaseContext.Provider value={{ state, actions }}>
      {children}
    </DatabaseContext.Provider>
  );
}