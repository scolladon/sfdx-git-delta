export default {
  entry: [
    'src/commands/sgd/source/delta.ts',
    'bin/dev.js',
    'bin/run.js',
    '**/*.{nut,test}.ts',
    '__tests__/perf/**/*.{ts,mjs}',
    'vitest.config.perf.ts',
    '.github/**/*.yml',
  ],
  project: ['**/*.{ts,js,json,yml}', '!src/metadata/v*.ts'],
  ignoreBinaries: ['npm-check-updates'],
  // Schemas in src/schemas/metadata.ts and discriminated-union variants
  // (CopyOperation, etc.) chain through one another in the same file —
  // knip treats those as unused exports because nothing imports them
  // directly. They are public surface for type derivation, so keep them.
  ignoreExportsUsedInFile: true,
}
