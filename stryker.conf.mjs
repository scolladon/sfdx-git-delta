// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'yarn',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'jest',
  coverageAnalysis: 'perTest',
  ignoreStatic: true,
  ignorePatterns: ['lib/', 'reports/', 'bin/'],
  mutate: ['src/**/*.js'],
}
export default config
