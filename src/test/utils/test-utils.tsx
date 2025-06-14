import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { AppProviders } from '../../contexts';

// Custom render function that includes providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppProviders>{children}</AppProviders>
  );

  return render(ui, { wrapper: Wrapper, ...options });
};

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// Override render method
export { customRender as render };