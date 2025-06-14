# Contexts

This folder contains React contexts and providers for the application.

## Files

- `index.tsx` - Main AppProviders component that wraps the entire app with all context providers
- `hooks.ts` - Re-exports all context hooks for convenient importing
- `AIContext.tsx` - AI service context and hooks
- `DatabaseContext.tsx` - Database service context and hooks  
- `ProjectContext.tsx` - Project data context and hooks
- `UIContext.tsx` - UI state context and hooks

## Usage

### Using the AppProviders Component

```tsx
import { AppProviders } from './contexts';

function App() {
  return (
    <AppProviders>
      <YourAppContent />
    </AppProviders>
  );
}
```

### Using Context Hooks

```tsx
import { useAI, useProject, useUI, useDatabase } from './contexts/hooks';

function MyComponent() {
  const { state: aiState, actions: aiActions } = useAI();
  const { state: projectState, actions: projectActions } = useProject();
  // ...
}
```

## Note

The hooks are exported from a separate `hooks.ts` file to comply with React Fast Refresh requirements, which requires component files to only export React components.
