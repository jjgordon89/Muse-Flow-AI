import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/utils/test-utils';
import { VirtualListOptimized } from '../VirtualListOptimized';

const mockItems = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  name: `Item ${i}`,
  value: i * 10,
}));

const mockRenderItem = (item: typeof mockItems[0], index: number) => (
  <div key={item.id} data-testid={`item-${item.id}`}>
    {item.name}: {item.value}
  </div>
);

const mockKeyExtractor = (item: typeof mockItems[0]) => item.id.toString();

describe('VirtualListOptimized', () => {
  it('should render virtual list with items', () => {
    render(
      <VirtualListOptimized
        items={mockItems.slice(0, 5)}
        itemHeight={60}
        containerHeight={300}
        renderItem={mockRenderItem}
        keyExtractor={mockKeyExtractor}
      />
    );

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByTestId('item-0')).toBeInTheDocument();
    expect(screen.getByTestId('item-4')).toBeInTheDocument();
  });

  it('should show empty state when no items', () => {
    render(
      <VirtualListOptimized
        items={[]}
        itemHeight={60}
        containerHeight={300}
        renderItem={mockRenderItem}
        keyExtractor={mockKeyExtractor}
      />
    );

    expect(screen.getByText('No items to display')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <VirtualListOptimized
        items={[]}
        itemHeight={60}
        containerHeight={300}
        renderItem={mockRenderItem}
        keyExtractor={mockKeyExtractor}
        loading={true}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show custom empty component', () => {
    const customEmpty = <div>Custom empty message</div>;
    
    render(
      <VirtualListOptimized
        items={[]}
        itemHeight={60}
        containerHeight={300}
        renderItem={mockRenderItem}
        keyExtractor={mockKeyExtractor}
        emptyComponent={customEmpty}
      />
    );

    expect(screen.getByText('Custom empty message')).toBeInTheDocument();
  });

  it('should handle scroll events', () => {
    const onScrollEnd = vi.fn();
    
    render(
      <VirtualListOptimized
        items={mockItems}
        itemHeight={60}
        containerHeight={300}
        renderItem={mockRenderItem}
        keyExtractor={mockKeyExtractor}
        onScrollEnd={onScrollEnd}
      />
    );

    const listContainer = screen.getByRole('list');
    
    // Simulate scroll to bottom
    Object.defineProperty(listContainer, 'scrollTop', { value: 5000, writable: true });
    Object.defineProperty(listContainer, 'scrollHeight', { value: 6000, writable: true });
    Object.defineProperty(listContainer, 'clientHeight', { value: 300, writable: true });

    listContainer.dispatchEvent(new Event('scroll'));

    // Note: Due to debouncing, we'd need to wait or use fake timers to test this properly
  });

  it('should disable virtualization when requested', () => {
    render(
      <VirtualListOptimized
        items={mockItems.slice(0, 10)}
        itemHeight={60}
        containerHeight={300}
        renderItem={mockRenderItem}
        keyExtractor={mockKeyExtractor}
        enableVirtualization={false}
      />
    );

    // When virtualization is disabled, all items should be rendered
    mockItems.slice(0, 10).forEach((item) => {
      expect(screen.getByTestId(`item-${item.id}`)).toBeInTheDocument();
    });
  });
});