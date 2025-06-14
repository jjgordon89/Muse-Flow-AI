import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { debounce, rafThrottle } from '../../utils/debounce';
import { useAsyncErrorHandler } from '../../hooks/useAsyncErrorHandler';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  className?: string;
  overscan?: number;
  onScrollEnd?: () => void;
  loading?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  enableVirtualization?: boolean;
  scrollDebounceMs?: number;
}

export function VirtualListOptimized<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  keyExtractor,
  className = '',
  overscan = 3,
  onScrollEnd,
  loading = false,
  loadingComponent,
  emptyComponent,
  enableVirtualization = true,
  scrollDebounceMs = 16 // ~60fps
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef<number>(0);
  const { reportError, safeAsync } = useAsyncErrorHandler({ component: 'VirtualListOptimized' });

  const totalHeight = useMemo(() => items.length * itemHeight, [items.length, itemHeight]);

  // Calculate visible range with memoization
  const visibleRange = useMemo(() => {
    if (!enableVirtualization) {
      return { startIndex: 0, endIndex: items.length - 1 };
    }

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan, enableVirtualization]);

  // Memoize visible items calculation
  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      if (items[i]) {
        result.push({
          item: items[i],
          index: i,
          key: keyExtractor(items[i], i)
        });
      }
    }
    return result;
  }, [items, visibleRange, keyExtractor]);

  // Optimized scroll handler with RAF throttling
  const handleScroll = useCallback(
    rafThrottle((e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop;
      const now = performance.now();
      
      // Update scroll position
      setScrollTop(newScrollTop);
      lastScrollTime.current = now;

      // Handle scroll end detection
      if (onScrollEnd) {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 10) {
          safeAsync(
            async () => onScrollEnd(),
            undefined,
            { action: 'scroll-end' }
          );
        }
      }
    }),
    [onScrollEnd, safeAsync]
  );

  // Debounced scroll position update for better performance
  const debouncedScrollUpdate = useCallback(
    debounce((scrollTop: number) => {
      // This runs after scroll has stopped for performance metrics
      const scrollDuration = performance.now() - lastScrollTime.current;
      if (scrollDuration > 100) { // Only log if scroll was significant
        console.debug(`VirtualList scroll completed: ${scrollDuration.toFixed(2)}ms`);
      }
    }, scrollDebounceMs),
    [scrollDebounceMs]
  );

  // Update debounced handler when scroll changes
  useEffect(() => {
    debouncedScrollUpdate(scrollTop);
  }, [scrollTop, debouncedScrollUpdate]);

  // Scroll to specific item with error handling
  const scrollToItem = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    try {
      if (scrollElementRef.current && index >= 0 && index < items.length) {
        const scrollTop = index * itemHeight;
        scrollElementRef.current.scrollTo({
          top: scrollTop,
          behavior
        });
      }
    } catch (error) {
      reportError(error, { action: 'scroll-to-item', metadata: { index } });
    }
  }, [itemHeight, items.length, reportError]);

  // Scroll to top/bottom helpers
  const scrollToTop = useCallback(() => scrollToItem(0), [scrollToItem]);
  const scrollToBottom = useCallback(() => scrollToItem(items.length - 1), [scrollToItem, items.length]);

  // Expose scroll methods
  useEffect(() => {
    const element = scrollElementRef.current;
    if (element) {
      (element as any).scrollToItem = scrollToItem;
      (element as any).scrollToTop = scrollToTop;
      (element as any).scrollToBottom = scrollToBottom;
    }
  }, [scrollToItem, scrollToTop, scrollToBottom]);

  // Cleanup debounced functions on unmount
  useEffect(() => {
    return () => {
      handleScroll.cancel();
      debouncedScrollUpdate.cancel();
    };
  }, [handleScroll, debouncedScrollUpdate]);

  // Handle empty state
  if (items.length === 0 && !loading) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`} 
        style={{ height: containerHeight }}
      >
        {emptyComponent || (
          <div className="text-center text-gray-500">
            <p className="text-sm">No items to display</p>
          </div>
        )}
      </div>
    );
  }

  // Render loading state
  if (loading && items.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`} 
        style={{ height: containerHeight }}
      >
        {loadingComponent || (
          <div className="text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-2"></div>
            <p className="text-sm">Loading...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
      role="list"
      aria-label="Virtual list"
    >
      <div 
        style={{ 
          height: totalHeight, 
          position: 'relative',
          // Improve rendering performance
          willChange: 'transform',
          contain: 'layout style paint'
        }}
      >
        {visibleItems.map(({ item, index, key }) => (
          <div
            key={key}
            style={{
              position: 'absolute',
              top: index * itemHeight,
              left: 0,
              right: 0,
              height: itemHeight,
              // Optimization hints for browser
              willChange: scrollTop === 0 ? 'auto' : 'transform',
              contain: 'layout style paint'
            }}
            role="listitem"
          >
            {renderItem(item, index)}
          </div>
        ))}
        
        {/* Loading indicator at bottom */}
        {loading && loadingComponent && (
          <div
            style={{
              position: 'absolute',
              top: totalHeight,
              left: 0,
              right: 0,
              height: itemHeight
            }}
          >
            {loadingComponent}
          </div>
        )}
      </div>
    </div>
  );
}

// Hook for managing virtual list state with enhanced error handling
export function useVirtualList<T>(
  items: T[], 
  itemHeight: number = 60,
  options: { enablePerformanceMonitoring?: boolean } = {}
) {
  const [containerHeight, setContainerHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);
  const { reportError } = useAsyncErrorHandler({ component: 'useVirtualList' });

  const updateHeight = useCallback(() => {
    try {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newHeight = rect.height;
        
        if (newHeight > 0 && newHeight !== containerHeight) {
          setContainerHeight(newHeight);
          
          if (options.enablePerformanceMonitoring) {
            console.debug(`VirtualList height updated: ${newHeight}px`);
          }
        }
      }
    } catch (error) {
      reportError(error, { action: 'update-height' });
    }
  }, [containerHeight, reportError, options.enablePerformanceMonitoring]);

  // Debounce resize handler for better performance
  const debouncedUpdateHeight = useCallback(
    debounce(updateHeight, 100),
    [updateHeight]
  );

  useEffect(() => {
    updateHeight();
    
    const resizeObserver = new ResizeObserver(debouncedUpdateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      debouncedUpdateHeight.cancel();
    };
  }, [updateHeight, debouncedUpdateHeight]);

  return {
    containerRef,
    containerHeight,
    itemHeight,
    totalItems: items.length,
    isVisible: containerHeight > 0
  };
}

// Optimized list item component with error boundary
export const VirtualListItem = React.memo<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}>(({ children, className = '', onClick, style }) => {
  const { reportError } = useAsyncErrorHandler({ component: 'VirtualListItem' });

  const handleClick = useCallback(() => {
    try {
      onClick?.();
    } catch (error) {
      reportError(error, { action: 'item-click' });
    }
  }, [onClick, reportError]);

  return (
    <div
      className={`flex items-center justify-between p-3 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${className}`}
      onClick={handleClick}
      style={{ 
        height: '100%',
        // Performance optimizations
        contain: 'layout style paint',
        ...style
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {children}
    </div>
  );
});

VirtualListItem.displayName = 'VirtualListItem';