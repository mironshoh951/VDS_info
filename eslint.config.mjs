import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist-worker/**',
      'coverage/**',
      'playwright-report/**',
      'next-env.d.ts',
      // Superseded files kept only until someone deletes them by hand.
      '_to_delete/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // Type safety — `any` is a bug, not a shortcut (§71).
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    // Maintenance scripts are command-line tools: their whole output is
    // `console`, and a logger would be the wrong dependency for something that
    // runs outside the application.
    files: ['scripts/**/*.{js,mjs,cjs,ts}'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Architectural boundaries (§1.2). Presentational components must never
    // reach into the server layer; nothing may import Prisma outside server/db.
    files: ['src/components/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/*', '@/server'],
              message:
                'components/ and lib/ must not import from server/. Pass data in as props.',
            },
            {
              group: ['@prisma/client'],
              message: 'Prisma types belong to the server layer. Use a DTO type instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // Only the db module constructs a Prisma client.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/server/db/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              importNames: ['PrismaClient'],
              message: 'Import the shared client from @/server/db/client instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // Raw SQL must use tagged templates, never string concatenation (§10.1).
    files: ['src/server/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.property.name=/^\\$queryRawUnsafe|\\$executeRawUnsafe$/]',
          message:
            'Unsafe raw SQL is banned. Use $queryRaw/$executeRaw tagged templates.',
        },
      ],
    },
  },
  {
    // Tests, the seeder and the CLI scripts are console programs: printing
    // progress is their interface, not a debugging leftover.
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      'tests/**/*.ts',
      'prisma/seed/**/*.ts',
      'scripts/**/*.ts',
    ],
    rules: { 'no-console': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
]

export default config
