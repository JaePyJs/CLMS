const js = require('@eslint/js');
const tseslintModule = require('@typescript-eslint/eslint-plugin');
const tsParserModule = require('@typescript-eslint/parser');

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

const baseIgnores = ['dist/**/*', 'src/tests/**/*', 'eslint.config.js'];

const sharedRules = {
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unused-vars': [
    'warn',
    {
      argsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
  '@typescript-eslint/no-var-requires': 'off',
  '@typescript-eslint/no-namespace': 'off',
  '@typescript-eslint/ban-types': 'off',
  '@typescript-eslint/no-require-imports': 'off',
  '@typescript-eslint/no-unsafe-function-type': 'off',
  'prefer-const': 'off',
  'no-var': 'error',
  'no-console': 'warn',
  'no-debugger': 'error',
  'no-duplicate-imports': 'error',
  'no-unused-expressions': 'error',
  'prefer-template': 'error',
  'template-curly-spacing': ['error', 'never'],
  'object-curly-spacing': ['error', 'always'],
  'array-bracket-spacing': ['error', 'never'],
  'computed-property-spacing': ['error', 'never'],
  'no-multiple-empty-lines': ['error', { max: 1 }],
  'eol-last': 'off',
  'comma-dangle': 'off',
  semi: 'off',
  quotes: 'off',
  indent: 'off',
  'no-case-declarations': 'off',
  'no-fallthrough': 'off',
  'no-useless-catch': 'off',
};

module.exports = [
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
    files: ['src/cli/**/*.{ts,js}', 'src/scripts/**/*.{ts,js}', 'scripts/**/*.{ts,js}'],
    rules: {
      'no-console': 'off',
    },
  },
];
