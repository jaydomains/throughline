import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      // Late-bound bindings (declared, captured in a closure, assigned later — e.g.
      // server.ts disciplineEngine per C-D7) are read before assignment by design and
      // cannot become `const`.
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
];
