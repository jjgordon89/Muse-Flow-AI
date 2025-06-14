import React from 'react';
import { ProjectProvider } from './ProjectContext';
import { UIProvider } from './UIContext';
import { AIProvider } from './AIContext';
import { EnhancedErrorBoundary } from '../components/common/EnhancedErrorBoundary';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <EnhancedErrorBoundary 
      level="app" 
      component="AppProviders"
      enableErrorReporting={true}
    >
      <UIProvider>
        <ProjectProvider>
          <AIProvider>
            {children}
          </AIProvider>
        </ProjectProvider>
      </UIProvider>
    </EnhancedErrorBoundary>
  );
}

// Re-export contexts for convenience
export { useProject } from './ProjectContext';
export { useUI } from './UIContext';
export { useAI } from './AIContext';