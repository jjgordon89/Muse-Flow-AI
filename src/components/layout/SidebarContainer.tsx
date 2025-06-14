import React from 'react';
import { Sidebar } from './Sidebar';
import { SidebarContent } from './SidebarContent';
import { useUI } from '../../contexts';

export function SidebarContainer() {
  const { state: uiState, actions: uiActions } = useUI();

  return (
    <>
      <Sidebar
        isCollapsed={uiState.sidebar.isCollapsed}
        onToggle={uiActions.toggleSidebar}
        activeTab={uiState.sidebar.activeTab}
        onTabChange={uiActions.setActiveTab}
      />
      
      {!uiState.sidebar.isCollapsed && (
        <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto">
          <SidebarContent activeTab={uiState.sidebar.activeTab} />
        </div>
      )}
    </>
  );
}