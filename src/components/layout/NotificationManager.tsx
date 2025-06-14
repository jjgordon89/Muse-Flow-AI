import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useUI } from '../../contexts';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
};

const colorMap = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800'
};

export function NotificationManager() {
  const { state: uiState, actions: uiActions } = useUI();

  // Auto-hide notifications
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];

    uiState.notifications.forEach(notification => {
      if (notification.autoHide !== false) {
        const timeout = setTimeout(() => {
          uiActions.removeNotification(notification.id);
        }, 5000);
        timeouts.push(timeout);
      }
    });

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [uiState.notifications, uiActions]);

  if (uiState.notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {uiState.notifications.map(notification => {
        const Icon = iconMap[notification.type];
        const colorClass = colorMap[notification.type];

        return (
          <div
            key={notification.id}
            className={`p-4 rounded-lg border shadow-lg transform transition-all duration-300 ${colorClass}`}
          >
            <div className="flex items-start space-x-3">
              <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{notification.message}</p>
                <p className="text-xs opacity-75 mt-1">
                  {notification.timestamp.toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => uiActions.removeNotification(notification.id)}
                className="flex-shrink-0 p-1 hover:bg-black hover:bg-opacity-10 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}