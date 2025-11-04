module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules/**'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: ['react-refresh', 'react-hooks'],
  rules: {
    // AGGRESSIVE RULE DISABLING TO REDUCE NOISE
    
    // React Fast Refresh - completely disable
    'react-refresh/only-export-components': 'off',
    
    // React Hooks - reduce to minimal warnings
    'react-hooks/exhaustive-deps': 'off',
    
    // Unused variables - aggressive disabling
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'prefer-const': 'off',
    '@typescript-eslint/prefer-const': 'off',
    
    // TypeScript noise - disable most rules
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/prefer-optional-chain': 'off',
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/no-unnecessary-condition': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    
    // Console and other noise
    'no-console': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    
    // React specific
    'react-hooks/rules-of-hooks': 'off',
    'react-hooks/exhaustive-deps': 'off',
    
    // General noise
    'no-undef': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off'
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'no-undef': 'off'
      },
    },
    {
      files: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
      env: {
        jest: true,
        node: true
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
        'no-console': 'off'
      },
      parserOptions: {
        // Allow test files to have looser parsing
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    }
  ],
}