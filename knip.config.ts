export default {
  entry: [
    'src/commands/sgd/source/delta.ts',
    'bin/dev.js',
    'bin/run.js',
    '**/*.{nut,test}.ts',
    '.github/**/*.yml',
  ],
  project: ['**/*.{ts,js,json,yml}', '!src/metadata/v*.ts'],
  ignoreDependencies: ['@types/lodash', 'lodash'],
  ignoreBinaries: ['npm-check-updates'],
}
