'use strict';

/**
 * FSAA — ESLint flat config (Vite template, ESLint 9).
 * IDENTICAL boundary rules to the Next.js template — the methodology is one,
 * only the bundler/pages-layer differ.
 *
 * Layers: shared <- entities <- features <- pages (react-router here) <- app
 *   1. Imports flow only downward.
 *   2. Features never import each other (graduation guarantee).
 *   3. No circular imports.
 * Differences vs Next template: pages files are src/pages/** (not app/**),
 * and app-layer files are src/app/** (main.tsx).
 */

import importPlugin from 'eslint-plugin-import';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fsaaPlugin from 'eslint-plugin-fsaa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const upwardMessage = 'FSAA upward import: use only layers BELOW your own.';
const appMessage = 'FSAA: nothing imports from app/ — it is the top layer.';

const sharedRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        { group: ['**/app/**', '@app/*'], message: appMessage },
        { group: ['@entities/*', '@features/*', '@pages/*'], message: upwardMessage },
      ],
    },
  ],
};

const entitiesRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        { group: ['**/app/**', '@app/*'], message: appMessage },
        { group: ['@features/*', '@pages/*'], message: upwardMessage },
      ],
    },
  ],
};

const featuresRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        { group: ['**/app/**', '@app/*', '@pages/**'], message: appMessage },
        { group: ['@features/*', '@pages/*', 'src/features/**'], message: 'FSAA: features do not import each other — move code via @entities (data) or @shared (UI), or graduate it.' },
        { regex: '^\.\./\.\./(features|pages|app)/', message: 'FSAA: relative import into another layer the wrong way — cross-slice goes via @entities (data) or @shared (UI); stay inside your slice otherwise.' },
      ],
    },
  ],
};


/* Cross-slice zones are built dynamically: every slice under src/features/
   gets its own zone — import/no-restricted-paths RESOLVES relative paths,
   so leaving your slice via ../.. is caught, while legal downward relatives
   (../../entities, ../../shared) keep working. Mirror of drift-check v4.4. */
const featuresRoot = path.join(__dirname, "src", "features");
const featureZones = () => {
  let slices = [];
  try {
    slices = fs.readdirSync(featuresRoot).filter((f) => fs.statSync(path.join(featuresRoot, f)).isDirectory());
  } catch {
    /* no features dir yet (fresh template) */
  }
  const zones = [];
  for (const a of slices)
    for (const b of slices)
      if (a !== b)
        zones.push({
          target: `./src/features/${a}`,
          from: `./src/features/${b}`,
          message: "FSAA: features do not import each other — move code via @entities (data) or @shared (UI), or graduate it.",
        });
  return zones;
};

export default [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: [path.join(__dirname, 'tsconfig.json')] },
      },
    },
    rules: {
      'import/no-cycle': ['error', { maxDepth: '∞' }],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: sharedRules,
  },
  {
    files: ['src/entities/**/*.{ts,tsx}'],
    rules: entitiesRules,
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      ...featuresRules,
      'import/no-restricted-paths': ['error', { zones: featureZones() }],
    },
  },
  {
    /* src/pages: may import features + shared (composition of scenarios) */
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/app/**', '@app/**'], message: appMessage }] },
      ],
    },
  },
  /* eslint-plugin-fsaa 0.1.1 — the same contract as npm lint rules.
     Single source of truth: the npm package implements the checks; this
     config wires fsaa/recommended in, so `pnpm lint` and drift-check share
     one rule implementation. */
  ...fsaaPlugin.configs.recommended,
];
