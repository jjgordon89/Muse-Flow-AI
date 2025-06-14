import React from 'react';
import { AppProviders } from './contexts';
import { AppLayout } from './components/layout/AppLayout';

function App() {
  return (
    <AppProviders>
      <AppLayout />
    </AppProviders>
  );
}

export default App;