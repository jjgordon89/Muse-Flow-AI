import React, { useContext } from 'react';
import { AIContext } from './AIContext';
import { DatabaseContext } from './DatabaseContext';
import { ProjectContext } from './ProjectContext';
import { UIContext } from './UIContext';

export function useAI() {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}

// Database-specific hooks
export function useDatabaseStatus() {
  const { state } = useDatabase();
  return {
    isInitialized: state.isInitialized,
    isInitializing: state.isInitializing,
    connectionStatus: state.connectionStatus,
    hasError: !!state.lastError,
    error: state.lastError
  };
}

export function useDatabaseStats() {
  const { state, actions } = useDatabase();
  
  React.useEffect(() => {
    if (state.isInitialized) {
      actions.getStats();
      
      // Refresh stats periodically
      const interval = setInterval(actions.getStats, 60000); // Every minute
      return () => clearInterval(interval);
    }
  }, [state.isInitialized, actions]);
  
  return state.stats;
}
