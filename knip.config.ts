import type { KnipConfig } from 'knip'

const config = async (): Promise<KnipConfig> => {
  return {
    entry: ['src/commands/sgd/source/delta.ts', 'src/main.ts'],
    project: ['src/**/*.ts'],
    ignoreDependencies: [
      '@salesforce/ts-sinon',
      '@types/jest',
      '@types/mocha',
      'chai',
      'mocha',
      'sinon',
    ],
    ignoreBinaries: ['test:e2e'],
  }
}

export default config
