import React from 'react';
import { WordProcessorContainer } from '../editor/WordProcessorContainer';
import { EnhancedErrorBoundary } from '../common/EnhancedErrorBoundary';

export function MainContent() {
  return (
    <div className="flex-1 overflow-hidden">
      <EnhancedErrorBoundary level="component" component="WordProcessor">
        <WordProcessorContainer />
      </EnhancedErrorBoundary>
    </div>
  );
}