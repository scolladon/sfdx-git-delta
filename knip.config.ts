import type { KnipConfig } from 'knip'

const config = async (): Promise<KnipConfig> => {
  return {
    entry: [
      'src/commands/sgd/source/delta.ts',
      'src/main.ts',
      'bin/dev.js',
      'bin/run.js',
    ],
    project: ['src/**/*.ts', 'bin/*.js'],
    ignoreDependencies: [
      '@salesforce/ts-sinon',
      '@types/chai',
      '@types/jest',
      '@types/mocha',
      'chai',
      'mocha',
      'sinon',
      'ts-jest-mock-import-meta',
    ],
    ignoreBinaries: ['test:e2e'],
  }
}

export default config
