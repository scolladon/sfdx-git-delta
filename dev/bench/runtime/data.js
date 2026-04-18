window.BENCHMARK_DATA = {
  "lastUpdate": 1776511963660,
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
          "id": "07f6f4b647998f863f452797b2ae2ec853b0f6ac",
          "message": "fix(perf): replace XML parser with flexible-xml-parser for ~2.5x speedup (#1272)",
          "timestamp": "2026-04-11T00:23:14+02:00",
          "tree_id": "a9e901ed236bdb249fcaab1c0ed3cc1c62013359",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/07f6f4b647998f863f452797b2ae2ec853b0f6ac"
        },
        "date": 1775859945165,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 2687,
            "range": "±2.39%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 456,
            "range": "±3.95%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 143,
            "range": "±3.52%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 5440,
            "range": "±1.54%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 45223,
            "range": "±0.27%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 44365,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 23925,
            "range": "±0.60%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 7263,
            "range": "±0.49%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 7092,
            "range": "±0.56%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 3849,
            "range": "±0.70%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 1759,
            "range": "±0.55%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 1748,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 938,
            "range": "±0.76%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 15007,
            "range": "±0.65%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 1114652,
            "range": "±0.60%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 3648,
            "range": "±0.63%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 198921,
            "range": "±0.36%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 986,
            "range": "±0.64%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 43101,
            "range": "±0.60%",
            "unit": "ops/sec"
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
        "date": 1776006594367,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 2765,
            "range": "±2.09%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 412,
            "range": "±4.53%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 140,
            "range": "±3.66%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 5344,
            "range": "±1.51%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 43220,
            "range": "±0.35%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 42924,
            "range": "±0.27%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 23360,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 7073,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 6860,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 3685,
            "range": "±1.09%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 1712,
            "range": "±0.57%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 1668,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 911,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 14866,
            "range": "±0.56%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 1089432,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 3747,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 203401,
            "range": "±0.35%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 950,
            "range": "±1.89%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 44611,
            "range": "±0.38%",
            "unit": "ops/sec"
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
          "id": "9c52b16f10b012016d13e2d474fdaa17b3cb7e6b",
          "message": "fix: code quality, performance, security, test and CI issues (#1277)",
          "timestamp": "2026-04-18T13:29:43+02:00",
          "tree_id": "a1b7fbb5ea6b27b15208f6e64bb07cd05bdb58a7",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/9c52b16f10b012016d13e2d474fdaa17b3cb7e6b"
        },
        "date": 1776511962999,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 2929,
            "range": "±2.90%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 458,
            "range": "±3.09%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 126,
            "range": "±4.12%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 4910,
            "range": "±1.63%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 36483,
            "range": "±0.64%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 41968,
            "range": "±0.43%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 23621,
            "range": "±0.59%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 6801,
            "range": "±0.58%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 6680,
            "range": "±0.56%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 3857,
            "range": "±0.61%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 1671,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 1635,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 937,
            "range": "±0.53%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 14571,
            "range": "±0.62%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 1068027,
            "range": "±0.51%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 3611,
            "range": "±0.57%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 203137,
            "range": "±0.65%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 977,
            "range": "±0.98%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 45128,
            "range": "±0.58%",
            "unit": "ops/sec"
          }
        ]
      }
    ]
  }
}