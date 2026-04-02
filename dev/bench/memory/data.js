window.BENCHMARK_DATA = {
  "lastUpdate": 1775140955953,
  "repoUrl": "https://github.com/scolladon/sfdx-git-delta",
  "entries": {
    "Memory Benchmark": [
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
        "date": 1775140955928,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.3346,
            "range": "±2.03%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.9392,
            "range": "±2.56%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 7.8596,
            "range": "±5.32%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1962,
            "range": "±2.01%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0227,
            "range": "±0.46%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0229,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0423,
            "range": "±0.78%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.141,
            "range": "±0.54%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.1433,
            "range": "±0.56%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.2637,
            "range": "±0.84%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.5809,
            "range": "±0.52%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.6178,
            "range": "±1.33%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 1.0805,
            "range": "±0.79%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0663,
            "range": "±0.81%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0009,
            "range": "±0.92%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.2734,
            "range": "±0.65%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.005,
            "range": "±0.75%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 1.0044,
            "range": "±0.67%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0236,
            "range": "±0.75%",
            "unit": "ms"
          }
        ]
      }
    ]
  }
}