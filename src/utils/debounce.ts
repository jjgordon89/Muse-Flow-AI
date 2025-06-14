/**
 * Debouncing utilities for performance optimization
 */

interface DebounceOptions {
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}

interface ThrottleOptions {
  leading?: boolean;
  trailing?: boolean;
}

interface CancelableFunction {
  (...args: any[]): any;
  cancel: () => void;
  flush: () => any;
}

/**
 * Debounce function calls to improve performance
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: DebounceOptions = {}
): CancelableFunction {
  const { leading = false, trailing = true, maxWait } = options;
  
  let lastCallTime: number | undefined;
  let lastInvokeTime = 0;
  let timerId: NodeJS.Timeout | undefined;
  let lastArgs: Parameters<T> | undefined;
  let lastThis: any;
  let result: ReturnType<T>;

  function shouldInvoke(time: number): boolean {
    const timeSinceLastCall = time - (lastCallTime || 0);
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired(): void {
    const time = Date.now();
    if (shouldInvoke(time)) {
      invokeFunc(time);
    } else {
      // Restart the timer
      timerId = setTimeout(timerExpired, remainingWait(time));
    }
  }

  function remainingWait(time: number): number {
    const timeSinceLastCall = time - (lastCallTime || 0);
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;

    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }

  function invokeFunc(time: number): ReturnType<T> {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = undefined;
    lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function leadingEdge(time: number): ReturnType<T> {
    lastInvokeTime = time;
    timerId = setTimeout(timerExpired, wait);
    return leading ? invokeFunc(time) : result;
  }

  function trailingEdge(time: number): ReturnType<T> {
    timerId = undefined;

    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = undefined;
    lastThis = undefined;
    return result;
  }

  function cancel(): void {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
    lastInvokeTime = 0;
    lastArgs = undefined;
    lastCallTime = undefined;
    lastThis = undefined;
    timerId = undefined;
  }

  function flush(): ReturnType<T> {
    return timerId === undefined ? result : trailingEdge(Date.now());
  }

  function debounced(this: any, ...args: Parameters<T>): ReturnType<T> {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(lastCallTime);
      }
      if (maxWait !== undefined) {
        timerId = setTimeout(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }
    if (timerId === undefined) {
      timerId = setTimeout(timerExpired, wait);
    }
    return result;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;

  return debounced;
}

/**
 * Throttle function calls to limit execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: ThrottleOptions = {}
): CancelableFunction {
  return debounce(func, wait, {
    leading: true,
    trailing: true,
    maxWait: wait,
    ...options
  });
}

/**
 * Debounced state updater for React
 */
export class DebouncedState<T> {
  private currentValue: T;
  private debouncedSetter: CancelableFunction;
  private subscribers: Set<(value: T) => void> = new Set();

  constructor(
    initialValue: T,
    delay: number = 300,
    options: DebounceOptions = {}
  ) {
    this.currentValue = initialValue;
    this.debouncedSetter = debounce(
      (newValue: T) => {
        this.currentValue = newValue;
        this.notifySubscribers();
      },
      delay,
      options
    );
  }

  setValue(newValue: T): void {
    this.debouncedSetter(newValue);
  }

  getValue(): T {
    return this.currentValue;
  }

  subscribe(callback: (value: T) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  cancel(): void {
    this.debouncedSetter.cancel();
  }

  flush(): void {
    this.debouncedSetter.flush();
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.currentValue);
      } catch (error) {
        console.error('Error in DebouncedState subscriber:', error);
      }
    });
  }
}

/**
 * Frame-based throttling for smooth animations
 */
export function rafThrottle<T extends (...args: any[]) => any>(func: T): CancelableFunction {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | undefined;
  let lastThis: any;

  function throttled(this: any, ...args: Parameters<T>): void {
    lastArgs = args;
    lastThis = this;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (lastArgs) {
          func.apply(lastThis, lastArgs);
        }
      });
    }
  }

  function cancel(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastArgs = undefined;
    lastThis = undefined;
  }

  function flush(): any {
    if (rafId !== null) {
      cancel();
      if (lastArgs) {
        return func.apply(lastThis, lastArgs);
      }
    }
  }

  throttled.cancel = cancel;
  throttled.flush = flush;

  return throttled;
}

/**
 * Utility for creating debounced event handlers
 */
export function createDebouncedHandler<T extends Event>(
  handler: (event: T) => void,
  delay: number = 300,
  options: DebounceOptions = {}
): (event: T) => void {
  return debounce((event: T) => {
    // Persist the event for React synthetic events
    if (event && typeof event.persist === 'function') {
      event.persist();
    }
    handler(event);
  }, delay, options);
}

/**
 * Hook-friendly debounced callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList,
  options: DebounceOptions = {}
): CancelableFunction {
  const callbackRef = React.useRef(callback);
  const debouncedRef = React.useRef<CancelableFunction>();

  // Update callback ref when dependencies change
  React.useEffect(() => {
    callbackRef.current = callback;
  }, deps);

  // Create debounced function
  React.useEffect(() => {
    debouncedRef.current = debounce(
      (...args: Parameters<T>) => callbackRef.current(...args),
      delay,
      options
    );

    return () => {
      debouncedRef.current?.cancel();
    };
  }, [delay, options.leading, options.trailing, options.maxWait]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      debouncedRef.current?.cancel();
    };
  }, []);

  return debouncedRef.current!;
}