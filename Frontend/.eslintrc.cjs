module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules/**', 'vite.config.ts', 'vitest.config.ts', '*.config.ts'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['react-refresh', 'react-hooks'],
  rules: {
    // PRODUCTION-READY RULES (CLMS Constitution compliance)

    // React Fast Refresh - warn about violations
    'react-refresh/only-export-components': 'warn',

    // React Hooks - enforce dependency arrays (critical for correctness)
    'react-hooks/exhaustive-deps': 'warn',
    'react-hooks/rules-of-hooks': 'error',

    // Unused variables - error for production code quality
    'no-unused-vars': 'off', // Handled by TypeScript
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'prefer-const': 'error', // Immutability

    // TypeScript type safety - stricter rules
    '@typescript-eslint/no-explicit-any': 'warn', // Warn about any types (gradual migration)
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'off', // Requires strictNullChecks
    '@typescript-eslint/prefer-optional-chain': 'warn',
    '@typescript-eslint/no-unnecessary-condition': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',

    // Console and debugging
    'no-console': 'warn', // Use logger in production
    'no-debugger': 'error',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',

    // General code quality
    'no-var': 'error', // Modern JS only
    'no-duplicate-imports': 'error',
    eqeqeq: ['error', 'always'], // Strict equality
    curly: ['error', 'all'], // Always use braces

    // Function declaration
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'no-undef': 'off',
      },
    },
    {
      files: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
      env: {
        jest: true,
        node: true,
      },
      rules: {
        // Completely disable type checking for tests
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'no-unused-vars': 'off',
        'prefer-const': 'off',
        'no-console': 'off',
      },
      parserOptions: {
        // Allow test files to have looser parsing
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  ],
};
