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
    'Preview build for this commit:\n\n' +
    `${installLines}\n\n` +
    'Preview URLs are per-commit and immutable. After each push, copy the\n' +
    'command again rather than re-running an earlier one.\n'
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

if (!Array.isArray(packages)) {
  throw new Error(
    `${inputPath} has no packages array - the publish step wrote an unexpected shape`
  )
}

report(renderBody(packages))
