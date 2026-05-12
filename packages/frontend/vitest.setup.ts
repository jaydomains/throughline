import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// With vitest globals disabled, Testing Library can't auto-register its cleanup
// hook. Register it manually so each test starts with an empty DOM.
afterEach(() => {
  cleanup();
});
