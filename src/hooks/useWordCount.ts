import { useMemo } from 'react';

export function useWordCount(text: string = '') {
  return useMemo(() => {
    if (!text) return 0;
    
    const words = text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    return words.length;
  }, [text]);
}