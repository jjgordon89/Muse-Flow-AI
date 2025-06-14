import React from 'react';
import { ProjectProvider } from './ProjectContext';
import { UIProvider } from './UIContext';
import { AIProvider } from './AIContext';
import { DatabaseProvider } from './DatabaseContext';
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
        <DatabaseProvider>
          <ProjectProvider>
            <AIProvider>
              {children}
            </AIProvider>
          </ProjectProvider>
        </DatabaseProvider>
      </UIProvider>
    </EnhancedErrorBoundary>
  );
}