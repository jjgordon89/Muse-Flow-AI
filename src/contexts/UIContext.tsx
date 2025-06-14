import React, { createContext, useContext, useReducer, useCallback } from 'react';

interface UIState {
  sidebar: {
    isCollapsed: boolean;
    activeTab: string;
  };
  modals: {
    settings: boolean;
    exportImport: boolean;
  };
  theme: 'light' | 'dark';
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: Date;
    autoHide?: boolean;
  }>;
}

type UIAction =
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_COLLAPSED'; payload: boolean }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'OPEN_MODAL'; payload: keyof UIState['modals'] }
  | { type: 'CLOSE_MODAL'; payload: keyof UIState['modals'] }
  | { type: 'CLOSE_ALL_MODALS' }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'ADD_NOTIFICATION'; payload: Omit<UIState['notifications'][0], 'id' | 'timestamp'> }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' };

interface UIContextValue {
  state: UIState;
  actions: {
    toggleSidebar: () => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    setActiveTab: (tab: string) => void;
    openModal: (modal: keyof UIState['modals']) => void;
    closeModal: (modal: keyof UIState['modals']) => void;
    closeAllModals: () => void;
    setTheme: (theme: 'light' | 'dark') => void;
    showNotification: (notification: Omit<UIState['notifications'][0], 'id' | 'timestamp'>) => void;
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
    showWarning: (message: string) => void;
    showInfo: (message: string) => void;
    removeNotification: (id: string) => void;
    clearNotifications: () => void;
  };
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

const initialState: UIState = {
  sidebar: {
    isCollapsed: false,
    activeTab: 'overview'
  },
  modals: {
    settings: false,
    exportImport: false
  },
  theme: 'light',
  notifications: []
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        sidebar: {
          ...state.sidebar,
          isCollapsed: !state.sidebar.isCollapsed
        }
      };

    case 'SET_SIDEBAR_COLLAPSED':
      return {
        ...state,
        sidebar: {
          ...state.sidebar,
          isCollapsed: action.payload
        }
      };

    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        sidebar: {
          ...state.sidebar,
          activeTab: action.payload
        }
      };

    case 'OPEN_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          [action.payload]: true
        }
      };

    case 'CLOSE_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          [action.payload]: false
        }
      };

    case 'CLOSE_ALL_MODALS':
      return {
        ...state,
        modals: Object.keys(state.modals).reduce((acc, key) => ({
          ...acc,
          [key]: false
        }), {} as UIState['modals'])
      };

    case 'SET_THEME':
      return {
        ...state,
        theme: action.payload
      };

    case 'ADD_NOTIFICATION':
      const newNotification = {
        ...action.payload,
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      };
      return {
        ...state,
        notifications: [...state.notifications, newNotification]
      };

    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };

    case 'CLEAR_NOTIFICATIONS':
      return {
        ...state,
        notifications: []
      };

    default:
      return state;
  }
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  const actions = {
    toggleSidebar: useCallback(() => {
      dispatch({ type: 'TOGGLE_SIDEBAR' });
    }, []),

    setSidebarCollapsed: useCallback((collapsed: boolean) => {
      dispatch({ type: 'SET_SIDEBAR_COLLAPSED', payload: collapsed });
    }, []),

    setActiveTab: useCallback((tab: string) => {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
    }, []),

    openModal: useCallback((modal: keyof UIState['modals']) => {
      dispatch({ type: 'OPEN_MODAL', payload: modal });
    }, []),

    closeModal: useCallback((modal: keyof UIState['modals']) => {
      dispatch({ type: 'CLOSE_MODAL', payload: modal });
    }, []),

    closeAllModals: useCallback(() => {
      dispatch({ type: 'CLOSE_ALL_MODALS' });
    }, []),

    setTheme: useCallback((theme: 'light' | 'dark') => {
      dispatch({ type: 'SET_THEME', payload: theme });
    }, []),

    showNotification: useCallback((notification: Omit<UIState['notifications'][0], 'id' | 'timestamp'>) => {
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
    }, []),

    showSuccess: useCallback((message: string) => {
      dispatch({ 
        type: 'ADD_NOTIFICATION', 
        payload: { type: 'success', message, autoHide: true }
      });
    }, []),

    showError: useCallback((message: string) => {
      dispatch({ 
        type: 'ADD_NOTIFICATION', 
        payload: { type: 'error', message, autoHide: false }
      });
    }, []),

    showWarning: useCallback((message: string) => {
      dispatch({ 
        type: 'ADD_NOTIFICATION', 
        payload: { type: 'warning', message, autoHide: true }
      });
    }, []),

    showInfo: useCallback((message: string) => {
      dispatch({ 
        type: 'ADD_NOTIFICATION', 
        payload: { type: 'info', message, autoHide: true }
      });
    }, []),

    removeNotification: useCallback((id: string) => {
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
    }, []),

    clearNotifications: useCallback(() => {
      dispatch({ type: 'CLEAR_NOTIFICATIONS' });
    }, [])
  };

  return (
    <UIContext.Provider value={{ state, actions }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}