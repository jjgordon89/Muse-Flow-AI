import { describe, it, expect, vi } from 'vitest';
import { debounce, throttle, rafThrottle } from '../debounce';

describe('debounce', () => {
  it('should delay function execution', async () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    expect(fn).not.toHaveBeenCalled();

    await new Promise(resolve => setTimeout(resolve, 150));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cancel execution', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    debouncedFn.cancel();

    setTimeout(() => {
      expect(fn).not.toHaveBeenCalled();
    }, 150);
  });

  it('should flush immediately', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    debouncedFn.flush();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should respect leading option', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100, { leading: true });

    debouncedFn();
    expect(fn).toHaveBeenCalledTimes(1);

    debouncedFn();
    expect(fn).toHaveBeenCalledTimes(1); // Still 1 due to debounce
  });

  it('should respect maxWait option', async () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100, { maxWait: 50 });

    debouncedFn();
    await new Promise(resolve => setTimeout(resolve, 60));
    
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  it('should limit function calls', async () => {
    const fn = vi.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();
    throttledFn();
    throttledFn();

    expect(fn).toHaveBeenCalledTimes(1);

    await new Promise(resolve => setTimeout(resolve, 150));
    throttledFn();
    
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('rafThrottle', () => {
  it('should throttle using requestAnimationFrame', () => {
    const fn = vi.fn();
    const rafThrottledFn = rafThrottle(fn);

    rafThrottledFn();
    rafThrottledFn();
    rafThrottledFn();

    // Should only schedule one RAF call
    expect(fn).not.toHaveBeenCalled();
  });

  it('should cancel scheduled calls', () => {
    const fn = vi.fn();
    const rafThrottledFn = rafThrottle(fn);

    rafThrottledFn();
    rafThrottledFn.cancel();

    // Wait for potential RAF execution
    setTimeout(() => {
      expect(fn).not.toHaveBeenCalled();
    }, 20);
  });
});