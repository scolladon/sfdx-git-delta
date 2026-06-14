#!/usr/bin/env node
// Run Stryker only against `src/**/*.ts` files that changed vs the merge-base
// with the base branch.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const baseBranch = process.env.MUTATION_BASE_BRANCH ?? 'origin/main';
const reportJsonPath = 'reports/mutation/mutation-testing-report.json';
const commentPath = 'reports/mutation/comment.md';

function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf-8' });
  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    throw new Error(`git ${args.join(' ')} failed: ${stderr}`);
  }
  return (result.stdout ?? '').trim();
}

function listChangedSourceFiles() {
  // --diff-filter=AM picks up Added and Modified files; deletions are skipped
  // because there is nothing left to mutate. Renames/copies are reported as
  // adds + deletes by default with --no-renames (omit; default is fine here).
  const output = git('--no-pager', 'diff', '--name-only', '--diff-filter=AM', `--merge-base`, baseBranch, '--', 'src');
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.ts'));
}

function extractOriginal(filePath, location) {
  if (!existsSync(filePath)) return null;
  const lines = readFileSync(filePath, 'utf-8').split('\n');
  const { start, end } = location;
  // Stryker locations are 1-indexed for both line and column
  if (start.line === end.line) {
    return lines[start.line - 1]?.slice(start.column - 1, end.column - 1) ?? null;
  }
  const parts = [lines[start.line - 1]?.slice(start.column - 1) ?? ''];
  for (let i = start.line; i < end.line - 1; i++) {
    parts.push(lines[i] ?? '');
  }
  parts.push(lines[end.line - 1]?.slice(0, end.column - 1) ?? '');
  return parts.join('\n');
}

function statusIcon(status) {
  return { Killed: '✅', Survived: '⚠️', Timeout: '⏱️', Ignored: '🚫', NoCoverage: '❌' }[status] ?? '❓';
}

function generateComment(changedFiles) {
  if (!existsSync(reportJsonPath)) return null;

  const report = JSON.parse(readFileSync(reportJsonPath, 'utf-8'));

  let killed = 0,
    survived = 0,
    timeout = 0,
    ignored = 0,
    noCoverage = 0;
  const survivedMutants = [];

  for (const [filePath, fileData] of Object.entries(report.files ?? {})) {
    for (const mutant of fileData.mutants ?? []) {
      if (mutant.status === 'Killed') killed++;
      else if (mutant.status === 'Survived') {
        survived++;
        survivedMutants.push({ filePath, mutant });
      } else if (mutant.status === 'Timeout') timeout++;
      else if (mutant.status === 'Ignored') ignored++;
      else if (mutant.status === 'NoCoverage') noCoverage++;
    }
  }

  const tested = killed + survived + timeout;
  const score = tested > 0 ? ((killed / tested) * 100).toFixed(2) : '100.00';
  const scoreEmoji = parseFloat(score) >= 80 ? '🟢' : parseFloat(score) >= 60 ? '🟡' : '🔴';

  const filesSummary = Object.entries(report.files ?? {})
    .map(([filePath, fileData]) => {
      const m = fileData.mutants ?? [];
      const fKilled = m.filter((x) => x.status === 'Killed').length;
      const fSurvived = m.filter((x) => x.status === 'Survived').length;
      const fTimeout = m.filter((x) => x.status === 'Timeout').length;
      const fIgnored = m.filter((x) => x.status === 'Ignored').length;
      const fTested = fKilled + fSurvived + fTimeout;
      const fScore = fTested > 0 ? ((fKilled / fTested) * 100).toFixed(2) : '100.00';
      return `| \`${filePath}\` | ${fScore}% | ${fKilled} | ${fSurvived} | ${fTimeout} | ${fIgnored} |`;
    })
    .join('\n');

  const survivedSection =
    survivedMutants.length === 0
      ? '_No mutants survived._'
      : survivedMutants
          .map(({ filePath, mutant }) => {
            const { line, column } = mutant.location.start;
            return [
              `**\`${filePath}:${line}:${column}\`** — ${mutant.mutatorName}`,
              '```diff',
              `- ${extractOriginal(filePath, mutant.location) ?? '(original)'}`,
              `+ ${mutant.replacement}`,
              '```',
            ].join('\n');
          })
          .join('\n\n');

  const testedFilesNote =
    changedFiles.length > 0
      ? `> Tested ${changedFiles.length} changed file(s): ${changedFiles.map((f) => `\`${f}\``).join(', ')}`
      : '';

  return [
    '## 🧬 Mutation Testing Results',
    '',
    testedFilesNote,
    '',
    `${scoreEmoji} **Score: ${score}%** &nbsp;|&nbsp; ✅ Killed: ${killed} &nbsp;|&nbsp; ⚠️ Survived: ${survived} &nbsp;|&nbsp; ⏱️ Timeout: ${timeout} &nbsp;|&nbsp; 🚫 Ignored: ${ignored}`,
    '',
    '<details>',
    '<summary>Per-file breakdown</summary>',
    '',
    '| File | Score | Killed | Survived | Timeout | Ignored |',
    '|------|-------|--------|----------|---------|---------|',
    filesSummary,
    '',
    '</details>',
    '',
    `### ${survived > 0 ? '⚠️' : '✅'} Survived Mutants`,
    '',
    survivedSection,
  ]
    .join('\n')
    .trim();
}

function main() {
  let files;
  try {
    files = listChangedSourceFiles();
  } catch (error) {
    console.error(`[incremental-mutation] ${error.message}`);
    console.error(
      `[incremental-mutation] Ensure the base branch "${baseBranch}" is fetched (use 'fetch-depth: 0' in CI).`,
    );
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('[incremental-mutation] No source files changed; skipping mutation testing.');
    mkdirSync('reports/mutation', { recursive: true });
    writeFileSync(
      commentPath,
      '## 🧬 Mutation Testing Results\n\n_No source files changed — mutation testing skipped._',
      'utf-8',
    );
    return;
  }

  console.log(`[incremental-mutation] Running Stryker against ${files.length} changed file(s):`);
  for (const file of files) console.log(`  - ${file}`);

  const args = ['stryker', 'run', '--mutate', files.join(',')];
  const stryker = spawnSync('npx', args, { stdio: 'inherit', shell: true });

  const comment = generateComment(files);
  if (comment) {
    mkdirSync('reports/mutation', { recursive: true });
    writeFileSync(commentPath, comment, 'utf-8');
    console.log(`[incremental-mutation] Comment written to ${commentPath}`);
  }

  process.exit(stryker.status ?? 1);
}

main();
