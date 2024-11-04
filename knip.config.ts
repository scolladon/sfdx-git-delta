export default {
  packageManager: 'npm',
  entry: [
    'src/commands/sgd/source/delta.ts',
    'src/main.ts',
    'bin/dev.js',
    'bin/run.js',
    '**/*.{nut,test}.ts',
    '.github/**/*.yml',
  ],
  project: ['**/*.{ts,js,json,yml}', '!src/metadata/v*.ts'],
  ignoreDependencies: [
    '@salesforce/ts-sinon',
    '@types/mocha',
    'mocha',
    'sinon',
    'ts-jest-mock-import-meta',
    'ts-node',
  ],
  ignoreBinaries: ['npm-check-updates'],
}
