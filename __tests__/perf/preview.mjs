import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ghPagesDir = process.argv[2] || ''

const runtime = JSON.parse(readFileSync('perf-runtime.json', 'utf-8'))
const memory = JSON.parse(readFileSync('perf-memory.json', 'utf-8'))

const pipelineRuntime = runtime.filter(b => b.name.startsWith('pipeline-'))
const phaseRuntime = runtime.filter(b => !b.name.startsWith('pipeline-'))
const pipelineMemory = memory.filter(b => b.name.startsWith('pipeline-'))
const phaseMemory = memory.filter(b => !b.name.startsWith('pipeline-'))

const loadHistory = subdir => {
  const dataPath = join(ghPagesDir, subdir, 'data.js')
  if (!ghPagesDir || !existsSync(dataPath)) {
    return []
  }
  const raw = readFileSync(dataPath, 'utf-8')
  const jsonStr = raw.replace(/^window\.BENCHMARK_DATA\s*=\s*/, '')
  const data = JSON.parse(jsonStr)
  const suiteName = Object.keys(data.entries || {})[0]
  return suiteName ? data.entries[suiteName] : []
}

const runtimeHistory = loadHistory('dev/bench/runtime')
const memoryHistory = loadHistory('dev/bench/memory')
const hasTrends = runtimeHistory.length > 0

const buildTrendData = (history, currentBenches) => {
  const benchNames = currentBenches.map(b => b.name)
  const series = {}
  for (const name of benchNames) {
    series[name] = { labels: [], values: [] }
  }

  for (const entry of history) {
    const label = entry.commit?.id?.slice(0, 7) || '?'
    for (const b of entry.benches || []) {
      if (series[b.name]) {
        series[b.name].labels.push(label)
        series[b.name].values.push(b.value)
      }
    }
  }

  for (const b of currentBenches) {
    if (series[b.name]) {
      series[b.name].labels.push('this PR')
      series[b.name].values.push(b.value)
    }
  }

  return series
}

const runtimeTrends = hasTrends ? buildTrendData(runtimeHistory, runtime) : {}
const memoryTrends = hasTrends ? buildTrendData(memoryHistory, memory) : {}

const trendChartsHtml = hasTrends
  ? `
  <h2>Trends — Runtime (ops/sec over time)</h2>
  <div class="trend-grid">
    ${runtime.map((b, i) => `<div class="chart-box trend-box"><h3>${b.name}</h3><canvas id="trend-rt-${i}"></canvas></div>`).join('\n    ')}
  </div>

  <h2>Trends — Mean Time (ms over time)</h2>
  <div class="trend-grid">
    ${memory.map((b, i) => `<div class="chart-box trend-box"><h3>${b.name}</h3><canvas id="trend-mem-${i}"></canvas></div>`).join('\n    ')}
  </div>`
  : ''

const trendChartsJs = hasTrends
  ? `
    const runtimeTrends = ${JSON.stringify(runtimeTrends)};
    const memoryTrends = ${JSON.stringify(memoryTrends)};
    const runtimeNames = ${JSON.stringify(runtime.map(b => b.name))};
    const memoryNames = ${JSON.stringify(memory.map(b => b.name))};

    const trendOpts = (higherIsBetter) => ({
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#21262d' }, ticks: { color: '#8b949e', font: { size: 10 }, maxRotation: 45 } },
        y: { grid: { color: '#21262d' }, ticks: { color: '#8b949e' } }
      },
      elements: {
        point: { radius: 3, hoverRadius: 6 }
      }
    });

    const trendLine = (id, labels, values, higherIsBetter) => {
      const lastIdx = values.length - 1;
      const pointBg = values.map((_, i) => i === lastIdx ? '#f85149' : '#58a6ff');
      const pointRadius = values.map((_, i) => i === lastIdx ? 6 : 3);
      new Chart(document.getElementById(id), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: values,
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88,166,255,0.1)',
            fill: true,
            tension: 0.2,
            pointBackgroundColor: pointBg,
            pointRadius: pointRadius,
            pointBorderColor: pointBg,
          }]
        },
        options: trendOpts(higherIsBetter)
      });
    };

    runtimeNames.forEach((name, i) => {
      const t = runtimeTrends[name];
      if (t) trendLine('trend-rt-' + i, t.labels, t.values, true);
    });
    memoryNames.forEach((name, i) => {
      const t = memoryTrends[name];
      if (t) trendLine('trend-mem-' + i, t.labels, t.values, false);
    });`
  : ''

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>sfdx-git-delta — Performance Benchmarks</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; }
    h1 { font-size: 1.6rem; margin-bottom: 8px; color: #58a6ff; }
    h2 { font-size: 1.2rem; margin: 32px 0 12px; color: #8b949e; border-bottom: 1px solid #21262d; padding-bottom: 8px; }
    h3 { font-size: 0.9rem; color: #c9d1d9; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .trend-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .chart-box { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
    .trend-box { min-height: 200px; }
    .pr-dot { display: inline-block; width: 10px; height: 10px; background: #f85149; border-radius: 50%; margin-right: 6px; }
    .legend-note { color: #8b949e; font-size: 0.85rem; margin-bottom: 16px; }
    canvas { width: 100% !important; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.85rem; }
    th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #21262d; }
    th { color: #8b949e; font-weight: 600; }
    td.val { font-family: 'SF Mono', Monaco, monospace; text-align: right; }
    .subtitle { color: #8b949e; font-size: 0.9rem; margin-bottom: 24px; }
  </style>
</head>
<body>
  <h1>sfdx-git-delta — Performance Benchmarks</h1>
  <p class="subtitle">${hasTrends ? 'PR preview with historical trends' : 'Local run'} — ${new Date().toISOString().slice(0, 19)}</p>
  ${hasTrends ? '<p class="legend-note"><span class="pr-dot"></span>Red dot = this PR</p>' : ''}

  ${trendChartsHtml}

  <h2>Current Run — Snapshot</h2>
  <div class="grid">
    <div class="chart-box">
      <h2>Pipeline — Runtime (ops/sec, higher is better)</h2>
      <canvas id="pipelineRuntime"></canvas>
    </div>
    <div class="chart-box">
      <h2>Pipeline — Mean Time (ms, lower is better)</h2>
      <canvas id="pipelineMemory"></canvas>
    </div>
  </div>

  <div class="grid">
    <div class="chart-box">
      <h2>Per-Phase — Runtime (ops/sec)</h2>
      <canvas id="phaseRuntime"></canvas>
    </div>
    <div class="chart-box">
      <h2>Per-Phase — Mean Time (ms)</h2>
      <canvas id="phaseMemory"></canvas>
    </div>
  </div>

  <h2>Raw Data</h2>
  <div class="grid">
    <div class="chart-box">
      <h2>Pipeline Benchmarks</h2>
      <table>
        <tr><th>Benchmark</th><th>ops/sec</th><th>Mean (ms)</th><th>Range</th></tr>
        ${pipelineRuntime.map((r, i) => `<tr><td>${r.name}</td><td class="val">${r.value.toLocaleString()}</td><td class="val">${pipelineMemory[i].value}</td><td class="val">${r.range}</td></tr>`).join('\n        ')}
      </table>
    </div>
    <div class="chart-box">
      <h2>Per-Phase Benchmarks</h2>
      <table>
        <tr><th>Benchmark</th><th>ops/sec</th><th>Mean (ms)</th><th>Range</th></tr>
        ${phaseRuntime.map((r, i) => `<tr><td>${r.name}</td><td class="val">${r.value.toLocaleString()}</td><td class="val">${phaseMemory[i].value}</td><td class="val">${r.range}</td></tr>`).join('\n        ')}
      </table>
    </div>
  </div>

  <script>
    const colors = [
      '#58a6ff','#3fb950','#d29922','#f85149','#bc8cff',
      '#79c0ff','#56d364','#e3b341','#ff7b72','#d2a8ff',
      '#39d353','#db6d28','#a5d6ff','#ffa657','#ff9bce',
      '#7ee787','#f0883e','#6cb6ff','#d186eb','#ea6045'
    ];
    const chartOpts = (type) => ({
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { type: type === 'log' ? 'logarithmic' : 'linear', grid: { color: '#21262d' }, ticks: { color: '#8b949e' } },
        y: { grid: { display: false }, ticks: { color: '#c9d1d9', font: { size: 11 } } }
      }
    });
    const bar = (id, labels, values, type) => {
      new Chart(document.getElementById(id), {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: labels.map((_, i) => colors[i % colors.length]), borderRadius: 4 }] },
        options: chartOpts(type)
      });
    };

    bar('pipelineRuntime', ${JSON.stringify(pipelineRuntime.map(b => b.name))}, ${JSON.stringify(pipelineRuntime.map(b => b.value))}, 'log');
    bar('pipelineMemory',  ${JSON.stringify(pipelineMemory.map(b => b.name))},  ${JSON.stringify(pipelineMemory.map(b => b.value))}, 'log');
    bar('phaseRuntime', ${JSON.stringify(phaseRuntime.map(b => b.name))}, ${JSON.stringify(phaseRuntime.map(b => b.value))}, 'log');
    bar('phaseMemory',  ${JSON.stringify(phaseMemory.map(b => b.name))},  ${JSON.stringify(phaseMemory.map(b => b.value))}, 'log');

    ${trendChartsJs}
  </script>
</body>
</html>`

const outPath = 'perf-preview.html'
writeFileSync(outPath, html)
// biome-ignore lint/suspicious/noConsole: preview output
console.info(`Preview written to ${outPath}`)
if (hasTrends) {
  // biome-ignore lint/suspicious/noConsole: preview output
  console.info(
    `Loaded ${runtimeHistory.length} historical data points from gh-pages`
  )
}
