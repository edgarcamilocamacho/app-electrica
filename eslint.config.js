import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import noLiteralUiText from './scripts/eslint-rules/no-literal-ui-text.js';

export default defineConfig(
  { ignores: ['dist/**', 'dist-server/**', '.data/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/platform/**/*.ts', 'src/main.tsx'],
    languageOptions: { globals: globals.browser },
    plugins: {
      'react-hooks': reactHooks,
      local: { rules: { 'no-literal-ui-text': noLiteralUiText } },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'local/no-literal-ui-text': 'error',
    },
  },
  {
    // Frontera de capas (PLAN §3): el núcleo no conoce UI, DOM ni plataforma.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'zustand', 'zustand/*'], message: 'core/ no puede depender de React ni del estado de UI.' },
            { group: ['**/app/**', '**/platform/**'], message: 'core/ no puede importar app/ ni platform/.' },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'fetch', 'performance'],
    },
  },
  {
    // La API (PLAN §24.1): Node puro, sin UI ni código del navegador.
    files: ['server/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'zustand', 'zustand/*'], message: 'server/ no puede depender de React.' },
            { group: ['**/app/**', '**/platform/**'], message: 'server/ solo puede usar src/core.' },
          ],
        },
      ],
    },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { globals: globals.browser, sourceType: 'script' },
  },
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
);
