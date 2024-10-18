const config = {
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'jest',
  coverageAnalysis: 'perTest',
  ignoreStatic: true,
  ignorePatterns: ['lib/', 'reports/', 'bin/', 'e2e'],
  mutate: ['src/**/*.ts'],
}
export default config
