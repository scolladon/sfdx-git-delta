import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'

const inputPath = 'preview.json'
const outputPath = 'preview-comment.md'
const marker = '<!-- sgd-preview -->'

const renderBody = packages => {
  if (packages.length === 0) {
    return `${marker}\n\nNo preview package was produced for this pull request.\n`
  }

  const installLines = packages
    .map(pkg => `    sf plugins install ${pkg.url}`)
    .join('\n')

  return (
    `${marker}\n\n` +
    'Preview build for this pull request:\n\n' +
    `${installLines}\n\n` +
    'Re-run the command after each push to pick up the latest build.\n'
  )
}

const report = body => {
  writeFileSync(outputPath, body)

  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) {
    appendFileSync(summaryPath, body)
  } else {
    process.stdout.write(body)
  }
}

const { packages } = JSON.parse(readFileSync(inputPath, 'utf-8'))
report(renderBody(packages))
