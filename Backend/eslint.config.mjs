import js from '@eslint/js';
import tseslintModule from '@typescript-eslint/eslint-plugin';
import tsParserModule from '@typescript-eslint/parser';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tseslint = tseslintModule.default ?? tseslintModule;
const tsParser = tsParserModule.default ?? tsParserModule;

const tsFiles = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

const tsRecommended = tseslint.configs['flat/recommended'].map(config => {
  if (!config.languageOptions) {
    return config;
  }

  return {
    ...config,
    languageOptions: {
      ...config.languageOptions,
      parser: tsParser,
      parserOptions: {
        ...config.languageOptions.parserOptions,
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
    },
  };
});

const baseIgnores = [
  'dist/**/*',
  'src/tests/**/*',
  'scripts/**/*',
  'eslint.config.js',
  'eslint.config.mjs',
  // Disabled services (missing dependencies)
  'src/services/*.disabled',
  'src/websocket/*.disabled',
  // Test and config files not in tsconfig
  'test-*.js',
  'register-paths.prod.js',
  'vitest.*.config.ts',
  'sandbox/**/*',
  // From .eslintignore
  'node_modules/',
  'build/',
  'coverage/',
  'logs/',
  'prisma/migrations/',
  'Dockerfile*',
  '**/*.d.ts',
];

const sharedRules = {
  // Production-readiness rules (CLMS Constitution compliance)
  '@typescript-eslint/explicit-function-return-type': 'off', // Too verbose for Express routes
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/no-explicit-any': 'error', // Stricter: no 'any' types (Constitution III)
  '@typescript-eslint/no-unused-vars': [
    'error', // Stricter: error instead of warn
    {
      argsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    },
  ],
  '@typescript-eslint/no-floating-promises': 'warn', // Warn: catch unhandled promises
  '@typescript-eslint/no-misused-promises': 'warn', // Warn: prevent Promise misuse
  '@typescript-eslint/await-thenable': 'warn', // Warn: prevent await on non-promises
  '@typescript-eslint/no-unnecessary-type-assertion': 'warn', // Warn: type safety
  '@typescript-eslint/prefer-nullish-coalescing': 'off', // Off: requires strictNullChecks
  '@typescript-eslint/prefer-optional-chain': 'warn', // Warn: safer property access
  '@typescript-eslint/no-var-requires': 'off',
  '@typescript-eslint/no-namespace': 'off',
  '@typescript-eslint/ban-types': 'off',
  '@typescript-eslint/no-require-imports': 'off',
  '@typescript-eslint/no-unsafe-function-type': 'off',

  // General code quality
  'prefer-const': 'error', // Immutability
  'no-var': 'error', // Modern JS only
  'no-console': 'warn', // Use logger instead
  'no-debugger': 'error', // No debug statements in production
  'no-duplicate-imports': 'error',
  'no-unused-expressions': 'error',
  'prefer-template': 'error', // Template literals over concatenation
  'template-curly-spacing': ['error', 'never'],
  'object-curly-spacing': ['error', 'always'],
  'array-bracket-spacing': ['error', 'never'],
  'computed-property-spacing': ['error', 'never'],
  'no-multiple-empty-lines': ['error', { max: 1 }],
  eqeqeq: ['error', 'always'], // Strict equality
  curly: ['error', 'all'], // Always use braces
  'no-throw-literal': 'error', // Throw Error objects only

  // Formatting (handled by Prettier)
  'eol-last': 'off',
  'comma-dangle': 'off',
  semi: 'off',
  quotes: 'off',
  indent: 'off',

  // Pragmatic exceptions
  'no-case-declarations': 'off',
  'no-fallthrough': 'off',
  'no-useless-catch': 'off',
};

export default [
  {
    ignores: baseIgnores,
  },
  js.configs.recommended,
  ...tsRecommended,
  {
    files: tsFiles,
    rules: sharedRules,
  },
  {
    files: [
      'src/cli/**/*.{ts,js}',
      'src/scripts/**/*.{ts,js}',
      'scripts/**/*.{ts,js}',
    ],
    rules: {
      'no-console': 'off',
    },
  },
];
