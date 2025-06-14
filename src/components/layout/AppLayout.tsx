import React from 'react';
import { HeaderContainer } from './HeaderContainer';
import { SidebarContainer } from './SidebarContainer';
import { MainContent } from './MainContent';
import { ModalManager } from './ModalManager';
import { NotificationManager } from './NotificationManager';
import { useUI } from '../../contexts';
import { EnhancedErrorBoundary } from '../common/EnhancedErrorBoundary';

export function AppLayout() {
  const { state: uiState } = useUI();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <EnhancedErrorBoundary level="component" component="HeaderContainer">
        <HeaderContainer />
      </EnhancedErrorBoundary>
      
      <div className="flex-1 flex overflow-hidden">
        <EnhancedErrorBoundary level="component" component="SidebarContainer">
          <SidebarContainer />
        </EnhancedErrorBoundary>
        
        <EnhancedErrorBoundary level="component" component="MainContent">
          <MainContent />
        </EnhancedErrorBoundary>
      </div>

      <ModalManager />
      <NotificationManager />
    </div>
  );
}