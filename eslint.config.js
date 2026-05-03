import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const FRAMEWORK_ID_EQUALITY_MESSAGE =
  'Do not branch on a framework id literal. Use a Framework interface flag (or add a new flag) so behavior flows through data, not code.'

const FRAMEWORK_JSON_IMPORT_MESSAGE =
  'Do not import framework JSONs directly. Use getFramework() / listFrameworks() / getDefaultFramework() from src/frameworks/registry.'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "BinaryExpression[operator=/^[!=]==$/][left.name='frameworkId'][right.type='Literal']",
          message: FRAMEWORK_ID_EQUALITY_MESSAGE,
        },
        {
          selector:
            "BinaryExpression[operator=/^[!=]==$/][right.name='frameworkId'][left.type='Literal']",
          message: FRAMEWORK_ID_EQUALITY_MESSAGE,
        },
      ],
    },
  },
  {
    // Outside the registry, never import a framework JSON directly.
    files: ['**/*.{ts,tsx}'],
    ignores: ['src/frameworks/registry.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/frameworks/*.json'],
              message: FRAMEWORK_JSON_IMPORT_MESSAGE,
            },
          ],
        },
      ],
    },
  },
  {
    // Core must stay framework-agnostic and free of UI/state coupling.
    files: ['src/core/**/*.{ts,tsx}'],
    ignores: ['src/core/**/__tests__/**', 'src/core/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/frameworks/*.json'],
              message: FRAMEWORK_JSON_IMPORT_MESSAGE,
            },
            {
              group: ['**/store/**', '**/components/**', '**/hooks/**'],
              message:
                'Core must stay framework-agnostic and free of UI/state coupling. Move shared logic into core, or invert the dependency.',
            },
          ],
        },
      ],
    },
  },
])
