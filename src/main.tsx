import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// In development, React StrictMode can cause components to render twice,
// which may cause issues with custom elements being defined multiple times
const isDevelopment = import.meta.env.DEV;

createRoot(document.getElementById('root')!).render(
  isDevelopment ? (
    <App />
  ) : (
    <StrictMode>
      <App />
    </StrictMode>
  )
);
