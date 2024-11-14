const config = {
  coverageAnalysis: 'perTest',
  ignorePatterns: ['lib/', 'reports/', 'bin/', 'e2e/'],
  mutate: ['src/**/*.ts', '!src/metadata/v*.ts'],
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'jest',
}
export default config
