import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

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
}

export function VirtualList<T>({
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
  emptyComponent
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const totalHeight = items.length * itemHeight;

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

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

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);

    // Check if scrolled to bottom
    if (onScrollEnd) {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        onScrollEnd();
      }
    }
  }, [onScrollEnd]);

  // Scroll to specific item
  const scrollToItem = useCallback((index: number) => {
    if (scrollElementRef.current) {
      const scrollTop = index * itemHeight;
      scrollElementRef.current.scrollTop = scrollTop;
    }
  }, [itemHeight]);

  // Expose scroll method
  useEffect(() => {
    const element = scrollElementRef.current;
    if (element) {
      (element as any).scrollToItem = scrollToItem;
    }
  }, [scrollToItem]);

  if (items.length === 0 && !loading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height: containerHeight }}>
        {emptyComponent || (
          <div className="text-center text-gray-500">
            <p className="text-sm">No items to display</p>
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
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, key }) => (
          <div
            key={key}
            style={{
              position: 'absolute',
              top: index * itemHeight,
              left: 0,
              right: 0,
              height: itemHeight
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
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

// Hook for managing virtual list state
export function useVirtualList<T>(items: T[], itemHeight: number = 60) {
  const [containerHeight, setContainerHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerHeight(rect.height);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  return {
    containerRef,
    containerHeight,
    itemHeight,
    totalItems: items.length
  };
}

// Optimized list item component
export const VirtualListItem = React.memo<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}>(({ children, className = '', onClick }) => (
  <div
    className={`flex items-center justify-between p-3 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors ${className}`}
    onClick={onClick}
    style={{ height: '100%' }}
  >
    {children}
  </div>
));

VirtualListItem.displayName = 'VirtualListItem';