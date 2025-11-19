// Flat ESLint config for the Frontend workspace
// Simplified configuration to focus on critical issues

import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      '.vite/',
      '.playwright/',
      'reports/',
      'Dockerfile*',
      '**/*.d.ts',
      'public/build/',
      'logs/',
      'src/test/**',
      'src/types/**',
      'src/utils/**',
      '.eslintrc.cjs',
      'vite.config.ts',
      'vitest.config.ts',
      '*.config.ts',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      'tests/**',
      'src/hooks/**',
      'src/services/**',
      'src/lib/**',
      'src/schemas/**',
      'src/store/**',
      'src/examples/**',
      'src/scripts/**',
      'src/components/ui/**',
      'src/components/settings/**',
      'src/components/security/**',
      'src/components/search/**',
      'src/components/server/**',
      'src/components/users/**',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Promise: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        React: 'readonly',
        MediaStreamConstraints: 'readonly',
        MediaTrackCapabilities: 'readonly',
        MediaTrackConstraintSet: 'readonly',
        MediaTrackConstraints: 'readonly',
        IntersectionObserverInit: 'readonly',
        NodeJS: 'readonly',
        EventListener: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': [
        'warn',
        { allow: ['warn', 'error', 'info'] },
      ],
      'no-debugger': 'error',
      'no-unused-vars': 'warn',
      'prefer-const': 'warn',
      'no-duplicate-imports': 'warn',
      'no-redeclare': 'off', // TypeScript handles redeclaration properly
    },
  },
];
