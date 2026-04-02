window.BENCHMARK_DATA = {
  "lastUpdate": 1775140955125,
  "repoUrl": "https://github.com/scolladon/sfdx-git-delta",
  "entries": {
    "Runtime Benchmark": [
      {
        "commit": {
          "author": {
            "email": "colladonsebastien@gmail.com",
            "name": "Sebastien",
            "username": "scolladon"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "c96c1d3cf623114a9a58b228eb62a1564f95630f",
          "message": "chore(perf): comprehensive Vitest bench infrastructure (#1267)",
          "timestamp": "2026-04-02T16:40:00+02:00",
          "tree_id": "fc1eb0081e5825cbed89228bf246aa4def265534",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/c96c1d3cf623114a9a58b228eb62a1564f95630f"
        },
        "date": 1775140954797,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 2988,
            "range": "±2.03%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 516,
            "range": "±2.56%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 127,
            "range": "±5.32%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 5096,
            "range": "±2.01%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 43992,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 43641,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 23613,
            "range": "±0.78%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 7090,
            "range": "±0.54%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 6978,
            "range": "±0.56%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 3792,
            "range": "±0.84%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 1721,
            "range": "±0.52%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 1619,
            "range": "±1.33%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 926,
            "range": "±0.79%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 15078,
            "range": "±0.81%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 1077910,
            "range": "±0.92%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 3658,
            "range": "±0.65%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 200225,
            "range": "±0.75%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 996,
            "range": "±0.67%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 42358,
            "range": "±0.75%",
            "unit": "ops/sec"
          }
        ]
      }
    ]
  }
}