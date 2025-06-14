import { useEffect, useRef, useCallback } from 'react';
import { monitoring } from '../services/monitoring';
import { logger } from '../services/logging';

interface UseMonitoringOptions {
  component?: string;
  trackRenders?: boolean;
  trackInteractions?: boolean;
  performanceThreshold?: number;
}

export function useMonitoring(options: UseMonitoringOptions = {}) {
  const {
    component = 'Unknown',
    trackRenders = true,
    trackInteractions = false,
    performanceThreshold = 16
  } = options;

  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);
  const mountTime = useRef<number>(Date.now());

  // Track component renders
  useEffect(() => {
    if (!trackRenders) return;

    renderStartTime.current = performance.now();
    renderCount.current++;

    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      monitoring.recordComponentRender(component, renderTime);

      if (renderTime > performanceThreshold) {
        logger.warn(`Slow render detected in ${component}`, {
          renderTime,
          renderCount: renderCount.current,
          threshold: performanceThreshold
        });
      }
    };
  });

  // Track component lifecycle
  useEffect(() => {
    const mountDuration = Date.now() - mountTime.current;
    monitoring.recordMetric(`component_mount_${component}`, mountDuration, 'ms');
    logger.debug(`Component mounted: ${component}`, { mountDuration });

    return () => {
      const lifetimeDuration = Date.now() - mountTime.current;
      monitoring.recordMetric(`component_lifetime_${component}`, lifetimeDuration, 'ms');
      logger.debug(`Component unmounted: ${component}`, { lifetimeDuration });
    };
  }, [component]);

  // Interaction tracking helpers
  const trackClick = useCallback((target: string, metadata?: Record<string, any>) => {
    if (trackInteractions) {
      monitoring.recordInteraction('click', `${component}:${target}`, metadata);
    }
  }, [component, trackInteractions]);

  const trackInput = useCallback((target: string, metadata?: Record<string, any>) => {
    if (trackInteractions) {
      monitoring.recordInteraction('input', `${component}:${target}`, metadata);
    }
  }, [component, trackInteractions]);

  const trackNavigation = useCallback((target: string, metadata?: Record<string, any>) => {
    if (trackInteractions) {
      monitoring.recordInteraction('navigation', `${component}:${target}`, metadata);
    }
  }, [component, trackInteractions]);

  const trackError = useCallback((error: Error, context?: string, metadata?: Record<string, any>) => {
    monitoring.recordError(error, `${component}:${context || 'unknown'}`, metadata);
  }, [component]);

  const startTimer = useCallback((name: string, metadata?: Record<string, any>) => {
    return monitoring.startTimer(`${component}:${name}`, metadata);
  }, [component]);

  const recordMetric = useCallback((name: string, value: number, unit: 'ms' | 'bytes' | 'count' | 'percent', metadata?: Record<string, any>) => {
    monitoring.recordMetric(`${component}:${name}`, value, unit, metadata);
  }, [component]);

  return {
    trackClick,
    trackInput,
    trackNavigation,
    trackError,
    startTimer,
    recordMetric,
    renderCount: renderCount.current,
    component
  };
}

export function usePerformanceMonitor(name: string, dependencies: React.DependencyList = []) {
  const timerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    timerRef.current = monitoring.startTimer(name);

    return () => {
      if (timerRef.current) {
        timerRef.current();
        timerRef.current = null;
      }
    };
  }, dependencies);

  const measure = useCallback((operationName: string) => {
    return monitoring.startTimer(`${name}:${operationName}`);
  }, [name]);

  return { measure };
}