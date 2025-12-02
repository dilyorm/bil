module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: [
    '@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // Disable rules that are too strict for production
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true 
    }],
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-namespace': 'off',
    'no-console': 'off', // Allow console in production for logging
    'no-case-declarations': 'off',
    'no-useless-escape': 'off',
  },
  overrides: [
    {
      files: ['packages/desktop/**/*.ts'],
      rules: {
        // More relaxed rules for Electron
        '@typescript-eslint/no-var-requires': 'off',
        'no-console': 'off',
      }
    },
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        // Test files can be more relaxed
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      }
    }
  ]
};