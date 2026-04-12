window.BENCHMARK_DATA = {
  "lastUpdate": 1776006595427,
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
    ],
    "Latency Benchmark": [
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
          "id": "07f6f4b647998f863f452797b2ae2ec853b0f6ac",
          "message": "fix(perf): replace XML parser with flexible-xml-parser for ~2.5x speedup (#1272)",
          "timestamp": "2026-04-11T00:23:14+02:00",
          "tree_id": "a9e901ed236bdb249fcaab1c0ed3cc1c62013359",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/07f6f4b647998f863f452797b2ae2ec853b0f6ac"
        },
        "date": 1775859946343,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.3721,
            "range": "±2.39%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 2.1948,
            "range": "±3.95%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 7.0062,
            "range": "±3.52%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1838,
            "range": "±1.54%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0221,
            "range": "±0.27%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0225,
            "range": "±0.41%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0418,
            "range": "±0.60%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.1377,
            "range": "±0.49%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.141,
            "range": "±0.56%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.2598,
            "range": "±0.70%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.5685,
            "range": "±0.55%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.5719,
            "range": "±0.47%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 1.0664,
            "range": "±0.76%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0666,
            "range": "±0.65%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0009,
            "range": "±0.60%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.2741,
            "range": "±0.63%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.005,
            "range": "±0.36%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 1.0143,
            "range": "±0.64%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0232,
            "range": "±0.60%",
            "unit": "ms"
          }
        ]
      },
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
          "id": "e2b7830eb91b60069ea31cabb7fee9b25b80c45b",
          "message": "ci(perf): post same-runner perf comparison as PR comment (#1275)",
          "timestamp": "2026-04-12T17:07:12+02:00",
          "tree_id": "3845daf835dd70859fe5752b0c4b81c280e275d4",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/e2b7830eb91b60069ea31cabb7fee9b25b80c45b"
        },
        "date": 1776006595400,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.3616,
            "range": "±2.09%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 2.4283,
            "range": "±4.53%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 7.1617,
            "range": "±3.66%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1871,
            "range": "±1.51%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0231,
            "range": "±0.35%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0233,
            "range": "±0.27%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0428,
            "range": "±0.41%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.1414,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.1458,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.2714,
            "range": "±1.09%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.5841,
            "range": "±0.57%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.5995,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 1.0974,
            "range": "±0.45%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0673,
            "range": "±0.56%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0009,
            "range": "±0.47%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.2669,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0049,
            "range": "±0.35%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 1.0524,
            "range": "±1.89%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0224,
            "range": "±0.38%",
            "unit": "ms"
          }
        ]
      }
    ]
  }
}