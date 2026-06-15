window.BENCHMARK_DATA = {
  "lastUpdate": 1781541695767,
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
        "date": 1776511964593,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.3414,
            "range": "±2.90%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 2.185,
            "range": "±3.09%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 7.9534,
            "range": "±4.12%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.2036,
            "range": "±1.63%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0274,
            "range": "±0.64%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0238,
            "range": "±0.43%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0423,
            "range": "±0.59%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.147,
            "range": "±0.58%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.1497,
            "range": "±0.56%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.2593,
            "range": "±0.61%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.5984,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.6116,
            "range": "±0.41%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 1.0669,
            "range": "±0.53%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0686,
            "range": "±0.62%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0009,
            "range": "±0.51%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.277,
            "range": "±0.57%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0049,
            "range": "±0.65%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 1.0234,
            "range": "±0.98%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0222,
            "range": "±0.58%",
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "49699333+dependabot[bot]@users.noreply.github.com",
            "name": "dependabot[bot]",
            "username": "dependabot[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "f1151114b74c4dfa94db3472dec4f08391acb0d6",
          "message": "feat(metadata): bump @salesforce/source-deploy-retrieve from 12.32.8 to 12.32.9 (#1279)\n\nSigned-off-by: dependabot[bot] <support@github.com>\nCo-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-22T08:23:13+02:00",
          "tree_id": "b13866dda04a942886551c635a0fca6314f76dad",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/f1151114b74c4dfa94db3472dec4f08391acb0d6"
        },
        "date": 1776839150610,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2707,
            "range": "±1.92%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.7688,
            "range": "±2.44%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 7.1964,
            "range": "±4.27%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1741,
            "range": "±1.63%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0212,
            "range": "±0.37%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0219,
            "range": "±0.36%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0401,
            "range": "±0.50%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.1325,
            "range": "±0.51%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.1392,
            "range": "±0.60%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.25,
            "range": "±0.53%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.5501,
            "range": "±1.00%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.5617,
            "range": "±0.58%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 1.0375,
            "range": "±0.50%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0664,
            "range": "±0.53%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0009,
            "range": "±0.53%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.2783,
            "range": "±0.48%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0048,
            "range": "±0.47%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 1.0556,
            "range": "±0.74%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0205,
            "range": "±0.46%",
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "49699333+dependabot[bot]@users.noreply.github.com",
            "name": "dependabot[bot]",
            "username": "dependabot[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "830c0faa6167e1e01bb90ab4a55816d5e09d6765",
          "message": "feat(metadata): bump @salesforce/source-deploy-retrieve from 12.32.9 to 12.34.0 (#1282)\n\nSigned-off-by: dependabot[bot] <support@github.com>\nCo-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-23T08:23:21+02:00",
          "tree_id": "2014fdc2e5a6ce435ac9daed304f64c103ec9401",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/830c0faa6167e1e01bb90ab4a55816d5e09d6765"
        },
        "date": 1776925580694,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2908,
            "range": "±1.82%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.8923,
            "range": "±2.55%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 6.7325,
            "range": "±1.55%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1958,
            "range": "±1.43%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0228,
            "range": "±0.37%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.023,
            "range": "±0.30%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.041,
            "range": "±0.39%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.1414,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.144,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.2551,
            "range": "±0.41%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.5802,
            "range": "±0.32%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.5885,
            "range": "±0.27%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 1.0745,
            "range": "±1.67%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0685,
            "range": "±0.46%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0009,
            "range": "±0.44%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.2713,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0048,
            "range": "±0.34%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 1.0041,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0221,
            "range": "±0.39%",
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
          "id": "01f741311bf0eecee7dc6ce5b178e686dd8a28ba",
          "message": "feat: --changes-manifest for review-centric change-kind output (#1281)\n\nCo-authored-by: Stefanvdk <10604623+Stefanvdk@users.noreply.github.com>nv",
          "timestamp": "2026-04-23T09:21:14+02:00",
          "tree_id": "08f7109cd86acc229141426a1a4cf98c4408558f",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/01f741311bf0eecee7dc6ce5b178e686dd8a28ba"
        },
        "date": 1776929038230,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2648,
            "range": "±1.91%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.7369,
            "range": "±2.15%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 6.3853,
            "range": "±1.87%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1752,
            "range": "±1.57%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0218,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0218,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0423,
            "range": "±0.55%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.1353,
            "range": "±0.46%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.1378,
            "range": "±0.52%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.26,
            "range": "±0.54%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.5539,
            "range": "±0.43%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.5613,
            "range": "±0.59%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 1.0903,
            "range": "±1.02%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0617,
            "range": "±0.53%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0015,
            "range": "±0.53%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.253,
            "range": "±0.45%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0091,
            "range": "±0.44%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.9495,
            "range": "±0.43%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0358,
            "range": "±0.47%",
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
          "id": "df3c8330076517fa1fdc9f73e60ce1ac54867ab2",
          "message": "feat(pipeline): streaming I/O end-to-end + txml + lookup caches (#1284)",
          "timestamp": "2026-04-27T20:42:55+02:00",
          "tree_id": "0e74cf12bddeeee4bbc000bb4104137843e1e870",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/df3c8330076517fa1fdc9f73e60ce1ac54867ab2"
        },
        "date": 1777316406972,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2624,
            "range": "±2.34%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.4712,
            "range": "±2.19%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 6.1365,
            "range": "±3.15%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1935,
            "range": "±2.05%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0003,
            "range": "±0.08%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0003,
            "range": "±0.18%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0187,
            "range": "±0.86%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0026,
            "range": "±0.26%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0023,
            "range": "±0.32%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.1148,
            "range": "±0.87%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.0128,
            "range": "±0.07%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0129,
            "range": "±0.08%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.4881,
            "range": "±1.06%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0465,
            "range": "±0.82%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0016,
            "range": "±0.93%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1413,
            "range": "±0.76%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0095,
            "range": "±0.71%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.4785,
            "range": "±0.66%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0394,
            "range": "±0.69%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0573,
            "range": "±1.03%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.0615,
            "range": "±0.87%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0605,
            "range": "±0.79%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.8451,
            "range": "±0.99%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.8775,
            "range": "±0.81%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.8804,
            "range": "±0.81%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 10.0065,
            "range": "±3.18%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 8.7257,
            "range": "±1.67%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 9.5509,
            "range": "±7.21%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.0561,
            "range": "±1.47%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.7321,
            "range": "±1.51%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 7.9902,
            "range": "±1.61%",
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "49699333+dependabot[bot]@users.noreply.github.com",
            "name": "dependabot[bot]",
            "username": "dependabot[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "b8860d7510756f187eb3c43152cd18471aba6a8e",
          "message": "feat(metadata): bump @salesforce/source-deploy-retrieve from 12.34.5 to 12.35.0 (#1288)\n\nSigned-off-by: dependabot[bot] <support@github.com>\nCo-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-29T08:23:22+02:00",
          "tree_id": "d18e8791e34ff36dbf73fcef031df389949849af",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/b8860d7510756f187eb3c43152cd18471aba6a8e"
        },
        "date": 1777443982555,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2917,
            "range": "±2.25%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.63,
            "range": "±2.73%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 6.2184,
            "range": "±2.31%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1975,
            "range": "±1.68%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0003,
            "range": "±0.12%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0003,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0185,
            "range": "±0.88%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0026,
            "range": "±0.27%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0026,
            "range": "±0.29%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.1149,
            "range": "±0.99%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.014,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0139,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.4927,
            "range": "±1.09%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0506,
            "range": "±0.81%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0014,
            "range": "±0.80%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1592,
            "range": "±0.65%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0093,
            "range": "±0.69%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.549,
            "range": "±0.65%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0388,
            "range": "±0.78%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0632,
            "range": "±0.93%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.0646,
            "range": "±0.66%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0634,
            "range": "±0.65%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.8472,
            "range": "±0.81%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.9118,
            "range": "±0.99%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.9006,
            "range": "±0.51%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 9.6059,
            "range": "±2.82%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 9.2066,
            "range": "±2.12%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 9.349,
            "range": "±3.47%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.0558,
            "range": "±1.91%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.7453,
            "range": "±2.36%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 7.8671,
            "range": "±5.43%",
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
          "id": "10d7aa069d162fc51ce166c85f314165484f9f54",
          "message": "chore(ci): describe new SDR metadata in dependabot auto-merge title (#1290)",
          "timestamp": "2026-04-29T10:54:42+02:00",
          "tree_id": "09b2560fb9a89b78ba8d62f8864e28ecd633858a",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/10d7aa069d162fc51ce166c85f314165484f9f54"
        },
        "date": 1777453063399,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2937,
            "range": "±2.37%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.5638,
            "range": "±2.12%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 7.0155,
            "range": "±5.70%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.2109,
            "range": "±1.73%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0003,
            "range": "±0.12%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0003,
            "range": "±0.12%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0194,
            "range": "±0.91%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0026,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0026,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.1154,
            "range": "±0.79%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.0143,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0141,
            "range": "±0.25%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.4964,
            "range": "±0.95%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0499,
            "range": "±0.80%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0015,
            "range": "±0.83%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1573,
            "range": "±0.71%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.009,
            "range": "±0.73%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.5785,
            "range": "±1.15%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0393,
            "range": "±0.68%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0605,
            "range": "±1.03%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.0622,
            "range": "±0.78%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0611,
            "range": "±0.68%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.8501,
            "range": "±1.54%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.8888,
            "range": "±1.20%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.8711,
            "range": "±0.64%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 9.5551,
            "range": "±3.73%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 8.7764,
            "range": "±1.58%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 8.8194,
            "range": "±2.39%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.0545,
            "range": "±1.98%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.6398,
            "range": "±1.44%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 7.0862,
            "range": "±1.72%",
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
          "id": "380a8e00ad7823701a550933fcc91edbbd481f30",
          "message": "fix(metadata): emit parent container in package.xml when generateDelta is off (#1298)",
          "timestamp": "2026-05-07T12:29:46+02:00",
          "tree_id": "6062c6381cb47d91ee2ab37abc505f1cf609d57b",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/380a8e00ad7823701a550933fcc91edbbd481f30"
        },
        "date": 1778149996734,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2486,
            "range": "±2.23%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.493,
            "range": "±2.47%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 6.1269,
            "range": "±3.38%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1828,
            "range": "±1.76%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0003,
            "range": "±0.13%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0003,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0171,
            "range": "±0.81%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0026,
            "range": "±0.25%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0026,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.1057,
            "range": "±0.81%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.0132,
            "range": "±0.27%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0131,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.4496,
            "range": "±0.81%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0462,
            "range": "±0.70%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0015,
            "range": "±0.68%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1463,
            "range": "±0.65%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0089,
            "range": "±0.62%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.5053,
            "range": "±0.62%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.036,
            "range": "±0.62%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0519,
            "range": "±0.82%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.056,
            "range": "±0.73%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0552,
            "range": "±0.61%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.7462,
            "range": "±0.89%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.7957,
            "range": "±0.71%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.7885,
            "range": "±0.66%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 8.9048,
            "range": "±3.02%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 8.5454,
            "range": "±7.57%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 8.8593,
            "range": "±8.29%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.0479,
            "range": "±1.17%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.6333,
            "range": "±1.22%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 7.3633,
            "range": "±3.92%",
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
          "id": "2ab697f412cab4d55f94b47a2d3e0b572ce29fda",
          "message": "chore(test): kill killable mutants and document equivalents (87.92% → 99.83%) (#1300)",
          "timestamp": "2026-05-07T16:27:22+02:00",
          "tree_id": "445d32ff21aae3b625e360eb39cc2ddcfb85b64e",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/2ab697f412cab4d55f94b47a2d3e0b572ce29fda"
        },
        "date": 1778164235558,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2831,
            "range": "±1.77%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.5296,
            "range": "±1.68%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 5.9752,
            "range": "±1.76%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.2049,
            "range": "±1.40%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0003,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0003,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0172,
            "range": "±0.46%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0026,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0026,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.108,
            "range": "±0.47%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.0142,
            "range": "±0.18%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0143,
            "range": "±0.13%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.4598,
            "range": "±0.57%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0479,
            "range": "±0.44%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0015,
            "range": "±0.44%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1531,
            "range": "±0.37%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0091,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.5348,
            "range": "±0.31%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0378,
            "range": "±0.55%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0563,
            "range": "±0.62%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.0623,
            "range": "±0.56%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0605,
            "range": "±0.43%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.823,
            "range": "±0.57%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.8747,
            "range": "±0.53%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.8729,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 9.1725,
            "range": "±2.77%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 8.7899,
            "range": "±1.12%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 8.8668,
            "range": "±3.00%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.0501,
            "range": "±1.40%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.5965,
            "range": "±1.13%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 6.5378,
            "range": "±1.43%",
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
          "id": "46ada9060d46f2d6ac216da24597f39a4d6cf604",
          "message": "chore(ci): approve dependabot PR via REST API and track Node LTS (#1303)",
          "timestamp": "2026-05-12T12:05:20+02:00",
          "tree_id": "a4cd33806136d5f14e6b9779b78f26147e90b61f",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/46ada9060d46f2d6ac216da24597f39a4d6cf604"
        },
        "date": 1778580497135,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2307,
            "range": "±2.42%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.1146,
            "range": "±6.24%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 4.2423,
            "range": "±3.09%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1067,
            "range": "±0.57%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0002,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0002,
            "range": "±0.22%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0132,
            "range": "±4.52%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0018,
            "range": "±0.25%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0018,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.0797,
            "range": "±0.39%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.0092,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0092,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.3404,
            "range": "±0.45%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.034,
            "range": "±0.47%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0011,
            "range": "±0.41%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.107,
            "range": "±1.82%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0073,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.3525,
            "range": "±0.41%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0302,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0383,
            "range": "±0.50%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.0442,
            "range": "±0.67%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0422,
            "range": "±0.56%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.5939,
            "range": "±1.51%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.5943,
            "range": "±0.36%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.5896,
            "range": "±0.57%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 6.1407,
            "range": "±4.24%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 5.9174,
            "range": "±0.39%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 5.7414,
            "range": "±0.81%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.035,
            "range": "±1.09%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.4979,
            "range": "±2.84%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 5.067,
            "range": "±6.08%",
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
          "id": "ef64856d32536f53ff7b75ec7746d87a2755512d",
          "message": "fix(metadata): emit page-scoped DigitalExperience members (#1305)",
          "timestamp": "2026-05-15T11:38:21+02:00",
          "tree_id": "418523b363b7ca93f89e015acec1d81f909ae381",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/ef64856d32536f53ff7b75ec7746d87a2755512d"
        },
        "date": 1778838090962,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2682,
            "range": "±2.24%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.4233,
            "range": "±6.85%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 4.832,
            "range": "±1.88%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1488,
            "range": "±0.44%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0002,
            "range": "±0.08%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0002,
            "range": "±0.22%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0184,
            "range": "±5.73%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0022,
            "range": "±0.06%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0022,
            "range": "±0.22%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.1237,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.0121,
            "range": "±0.07%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0121,
            "range": "±0.07%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.5227,
            "range": "±0.44%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0452,
            "range": "±0.50%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0015,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1518,
            "range": "±2.09%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0099,
            "range": "±0.36%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.4903,
            "range": "±0.64%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0416,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.052,
            "range": "±0.45%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.058,
            "range": "±0.47%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0568,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.7613,
            "range": "±0.83%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.8007,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.8041,
            "range": "±0.61%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 8.2807,
            "range": "±3.07%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 7.9069,
            "range": "±0.43%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 7.9223,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.0478,
            "range": "±1.51%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.6415,
            "range": "±0.94%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 6.9213,
            "range": "±4.08%",
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
          "id": "ecf95d535bc649b2f136044834974d29b254a2d0",
          "message": "refactor: drop async dependency in favor of in-house concurrency primitives (#1309)",
          "timestamp": "2026-05-25T17:37:41+02:00",
          "tree_id": "f6775328cff9bec90283a64c968616c4ce892e85",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/ecf95d535bc649b2f136044834974d29b254a2d0"
        },
        "date": 1779723645899,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.304,
            "range": "±3.35%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.6822,
            "range": "±8.56%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 5.0324,
            "range": "±3.19%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1414,
            "range": "±1.17%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0003,
            "range": "±0.32%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0003,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0166,
            "range": "±0.55%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0027,
            "range": "±0.32%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0023,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.1034,
            "range": "±0.46%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.0117,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0117,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.4367,
            "range": "±0.49%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0427,
            "range": "±0.56%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0015,
            "range": "±0.46%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.14,
            "range": "±2.18%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0095,
            "range": "±0.37%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.4401,
            "range": "±0.89%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0395,
            "range": "±0.44%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0496,
            "range": "±0.89%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.0557,
            "range": "±0.83%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0543,
            "range": "±0.84%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.7288,
            "range": "±1.02%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.7772,
            "range": "±0.79%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.7756,
            "range": "±0.87%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 10.0565,
            "range": "±6.24%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 7.5896,
            "range": "±0.59%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 7.7938,
            "range": "±0.58%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.0469,
            "range": "±1.51%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.614,
            "range": "±2.30%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 8.071,
            "range": "±8.89%",
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
          "id": "8d40836a8a1d896def926bec6af055064ffc45fe",
          "message": "refactor: drop simple-git dependency in favor of in-house spawn-based helper (#1310)",
          "timestamp": "2026-05-25T18:17:13+02:00",
          "tree_id": "ad92f76318912762d86664e2b0d4f7611e348e8d",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/8d40836a8a1d896def926bec6af055064ffc45fe"
        },
        "date": 1779726006173,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2868,
            "range": "±2.42%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.3715,
            "range": "±6.24%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 4.7656,
            "range": "±1.88%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1393,
            "range": "±0.37%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0003,
            "range": "±0.12%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0003,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0164,
            "range": "±0.29%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0022,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0022,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.1011,
            "range": "±0.29%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.0137,
            "range": "±0.29%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0127,
            "range": "±0.15%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.4308,
            "range": "±0.41%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0433,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0015,
            "range": "±0.33%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1472,
            "range": "±2.01%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0099,
            "range": "±0.26%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.4716,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.04,
            "range": "±0.23%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0523,
            "range": "±0.34%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.0589,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0585,
            "range": "±0.34%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.7676,
            "range": "±0.72%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.8373,
            "range": "±0.68%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.8322,
            "range": "±0.30%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 8.325,
            "range": "±4.35%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 8.2882,
            "range": "±0.49%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 8.1411,
            "range": "±0.27%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.0459,
            "range": "±1.40%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.5945,
            "range": "±1.86%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 6.2786,
            "range": "±6.22%",
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
          "id": "2acb86b4df1ca9932be9b14683ea404bc6c30ee9",
          "message": "refactor: drop fs-extra in favor of node:fs/promises wrapper (#1311)",
          "timestamp": "2026-05-25T18:49:04+02:00",
          "tree_id": "7e4b76f982a0629e6e8252722b7830f711f90f28",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/2acb86b4df1ca9932be9b14683ea404bc6c30ee9"
        },
        "date": 1779727912600,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2729,
            "range": "±2.81%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.3614,
            "range": "±6.61%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 4.7861,
            "range": "±2.31%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1314,
            "range": "±0.57%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0003,
            "range": "±0.13%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0003,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.016,
            "range": "±0.50%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0023,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0023,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.0997,
            "range": "±0.70%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.0118,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0118,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.4209,
            "range": "±0.52%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0425,
            "range": "±0.55%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0015,
            "range": "±0.48%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1376,
            "range": "±2.27%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0095,
            "range": "±0.41%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.4263,
            "range": "±0.45%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0392,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0484,
            "range": "±0.58%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.0546,
            "range": "±0.59%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.054,
            "range": "±0.53%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.7036,
            "range": "±0.79%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.7495,
            "range": "±0.51%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.7485,
            "range": "±0.45%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 8.1586,
            "range": "±5.66%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 7.423,
            "range": "±0.39%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 7.4659,
            "range": "±1.05%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.0469,
            "range": "±1.56%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.6136,
            "range": "±2.35%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 6.6266,
            "range": "±8.03%",
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
          "id": "2fda15de790ab8b2a29474a66f9bc51c67c8a00f",
          "message": "refactor: replace fast-equals with in-house deepEqualJson (#1312)",
          "timestamp": "2026-05-25T19:28:03+02:00",
          "tree_id": "ff2580ba1fa1e87314a020ea1146e906a828aa58",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/2fda15de790ab8b2a29474a66f9bc51c67c8a00f"
        },
        "date": 1779730238471,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 0.0003,
            "range": "±0.14%",
            "unit": "ms"
          },
          {
            "name": "shallow-different-last-field",
            "value": 0.0003,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "nested-equal",
            "value": 0.0022,
            "range": "±0.21%",
            "unit": "ms"
          },
          {
            "name": "nested-different-array-length",
            "value": 0.0011,
            "range": "±0.25%",
            "unit": "ms"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 0.0241,
            "range": "±0.27%",
            "unit": "ms"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 0.0014,
            "range": "±0.30%",
            "unit": "ms"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 0.0001,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2764,
            "range": "±2.36%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.4187,
            "range": "±7.69%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 4.7955,
            "range": "±2.61%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1416,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0002,
            "range": "±0.15%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0002,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0169,
            "range": "±4.79%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0021,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0021,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.0993,
            "range": "±0.27%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.0125,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0127,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.4254,
            "range": "±0.26%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0443,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0015,
            "range": "±0.31%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1485,
            "range": "±2.08%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0101,
            "range": "±0.30%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.4736,
            "range": "±0.33%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0407,
            "range": "±0.33%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0523,
            "range": "±0.41%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.059,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.058,
            "range": "±0.32%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.771,
            "range": "±0.68%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.8243,
            "range": "±0.28%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.8241,
            "range": "±0.29%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 8.846,
            "range": "±4.68%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 8.1568,
            "range": "±0.18%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 8.1542,
            "range": "±0.24%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.047,
            "range": "±1.54%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.5984,
            "range": "±2.02%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 6.1824,
            "range": "±5.97%",
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
          "id": "53c010528baf7b538706f9ed7c1473fd254757d6",
          "message": "build: drop tslib by inlining TS helpers (importHelpers: false) (#1313)",
          "timestamp": "2026-05-25T21:17:21+02:00",
          "tree_id": "5bca0e4ef0f250c063acc251e269e733483c08e8",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/53c010528baf7b538706f9ed7c1473fd254757d6"
        },
        "date": 1779736806702,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 0.0003,
            "range": "±0.17%",
            "unit": "ms"
          },
          {
            "name": "shallow-different-last-field",
            "value": 0.0003,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "nested-equal",
            "value": 0.0022,
            "range": "±0.35%",
            "unit": "ms"
          },
          {
            "name": "nested-different-array-length",
            "value": 0.001,
            "range": "±0.33%",
            "unit": "ms"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 0.0229,
            "range": "±0.36%",
            "unit": "ms"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 0.0014,
            "range": "±0.46%",
            "unit": "ms"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 0.0001,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2851,
            "range": "±2.50%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.4026,
            "range": "±6.29%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 5.39,
            "range": "±3.67%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1507,
            "range": "±0.50%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0003,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0003,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0166,
            "range": "±0.43%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0022,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0022,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.1036,
            "range": "±0.46%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.013,
            "range": "±0.13%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0129,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.4433,
            "range": "±0.59%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0445,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0015,
            "range": "±0.47%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1508,
            "range": "±2.16%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0097,
            "range": "±0.41%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.4777,
            "range": "±0.39%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.04,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0512,
            "range": "±0.48%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.0575,
            "range": "±0.49%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0563,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.8053,
            "range": "±1.82%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.8141,
            "range": "±0.39%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.8156,
            "range": "±0.45%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 8.3882,
            "range": "±4.52%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 7.9554,
            "range": "±0.31%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 8.0718,
            "range": "±0.37%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.0451,
            "range": "±1.45%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.5942,
            "range": "±1.93%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 6.1342,
            "range": "±6.28%",
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
          "id": "5c174875b570fa5789409432f2a8c497cf7cc256",
          "message": "fix(deps): pin direct dependencies to exact versions (#1314)",
          "timestamp": "2026-05-25T21:30:42+02:00",
          "tree_id": "b56668b0c6c948134688db669571855c367f6a3d",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/5c174875b570fa5789409432f2a8c497cf7cc256"
        },
        "date": 1779737612220,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 0.0003,
            "range": "±0.16%",
            "unit": "ms"
          },
          {
            "name": "shallow-different-last-field",
            "value": 0.0003,
            "range": "±0.12%",
            "unit": "ms"
          },
          {
            "name": "nested-equal",
            "value": 0.0022,
            "range": "±0.36%",
            "unit": "ms"
          },
          {
            "name": "nested-different-array-length",
            "value": 0.001,
            "range": "±0.45%",
            "unit": "ms"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 0.0224,
            "range": "±0.36%",
            "unit": "ms"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 0.0015,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 0.0001,
            "range": "±0.29%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2932,
            "range": "±2.73%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.4589,
            "range": "±6.67%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 4.9299,
            "range": "±2.52%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1498,
            "range": "±0.60%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0002,
            "range": "±0.12%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0002,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0167,
            "range": "±0.47%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0022,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0022,
            "range": "±0.25%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.1056,
            "range": "±0.45%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.0125,
            "range": "±0.12%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0125,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.4523,
            "range": "±0.46%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.045,
            "range": "±0.54%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0015,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1549,
            "range": "±2.37%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0098,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.487,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0425,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0524,
            "range": "±0.45%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.0607,
            "range": "±0.53%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0593,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.8028,
            "range": "±0.81%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.8548,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.8469,
            "range": "±0.44%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 9.0407,
            "range": "±4.86%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 8.4459,
            "range": "±0.35%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 9.2712,
            "range": "±4.98%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.0464,
            "range": "±1.51%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.5855,
            "range": "±1.92%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 6.4356,
            "range": "±6.75%",
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
          "id": "9e787d0616ee26e398ce3147fbdce39432d3ed1b",
          "message": "fix: degrade gracefully when latest API version lookup is unreachable (#1318)",
          "timestamp": "2026-05-29T00:41:53+02:00",
          "tree_id": "33d19a2a142961badcadc3157f57ce750e7b8645",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/9e787d0616ee26e398ce3147fbdce39432d3ed1b"
        },
        "date": 1780008307982,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 0.0003,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "shallow-different-last-field",
            "value": 0.0003,
            "range": "±0.08%",
            "unit": "ms"
          },
          {
            "name": "nested-equal",
            "value": 0.0023,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "nested-different-array-length",
            "value": 0.0011,
            "range": "±0.33%",
            "unit": "ms"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 0.0225,
            "range": "±0.46%",
            "unit": "ms"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 0.0012,
            "range": "±0.46%",
            "unit": "ms"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 0.0001,
            "range": "±0.08%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2432,
            "range": "±2.24%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.4019,
            "range": "±15.10%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 4.619,
            "range": "±2.39%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.148,
            "range": "±0.39%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0003,
            "range": "±0.07%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0003,
            "range": "±0.07%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0176,
            "range": "±0.47%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0022,
            "range": "±0.06%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0022,
            "range": "±0.05%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.108,
            "range": "±0.45%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.012,
            "range": "±0.08%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.012,
            "range": "±0.06%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.4561,
            "range": "±0.51%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0454,
            "range": "±0.48%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0016,
            "range": "±0.32%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1495,
            "range": "±2.02%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0099,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.475,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0433,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0518,
            "range": "±0.46%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.0585,
            "range": "±0.48%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0566,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.7474,
            "range": "±0.68%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.8115,
            "range": "±0.35%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.8134,
            "range": "±0.63%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 8.119,
            "range": "±3.07%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 8.0348,
            "range": "±0.37%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 8.0447,
            "range": "±0.36%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.0475,
            "range": "±1.60%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.6328,
            "range": "±1.46%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 6.6825,
            "range": "±4.43%",
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
          "id": "e41f345c2d38045109082da6beccd4789a2d6076",
          "message": "fix: detect changes in nested content-container folders (StaticResource, bundles) (#1322)\n\nStop metadata directory resolution at types that own their nested paths (inFolder types and content-container adapters: bundle/digitalExperience/mixedContent), so a nested content folder colliding with a metadata directoryName (e.g. an icons/ folder inside a StaticResource) no longer hides the change.\n\ncloses #1322",
          "timestamp": "2026-06-04T22:59:35+02:00",
          "tree_id": "c491a3dfca061bffa5a9ab9f50fa990c0d4292cb",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/e41f345c2d38045109082da6beccd4789a2d6076"
        },
        "date": 1780606962236,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 0.0003,
            "range": "±0.13%",
            "unit": "ms"
          },
          {
            "name": "shallow-different-last-field",
            "value": 0.0003,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "nested-equal",
            "value": 0.0022,
            "range": "±0.18%",
            "unit": "ms"
          },
          {
            "name": "nested-different-array-length",
            "value": 0.001,
            "range": "±0.37%",
            "unit": "ms"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 0.0238,
            "range": "±0.35%",
            "unit": "ms"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 0.0016,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 0.0001,
            "range": "±0.18%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.3105,
            "range": "±2.95%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.4648,
            "range": "±8.94%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 4.8851,
            "range": "±2.19%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.1323,
            "range": "±0.50%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0003,
            "range": "±0.13%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0002,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0165,
            "range": "±0.41%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0024,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0024,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.1095,
            "range": "±5.57%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.0118,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0118,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.4372,
            "range": "±0.43%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0434,
            "range": "±0.45%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0015,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1426,
            "range": "±2.28%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0092,
            "range": "±0.37%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.4394,
            "range": "±0.37%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0391,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0478,
            "range": "±0.51%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.0534,
            "range": "±0.51%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0548,
            "range": "±1.02%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.7019,
            "range": "±0.78%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.7414,
            "range": "±0.50%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.7344,
            "range": "±0.41%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 7.6777,
            "range": "±4.80%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 7.3258,
            "range": "±0.34%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 7.2882,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.0481,
            "range": "±1.77%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.6332,
            "range": "±2.42%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 6.5989,
            "range": "±7.41%",
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
          "id": "e2244016f958ce9be10e89ebd2996fb50ba2d51e",
          "message": "fix(deps): remove all unnecessary overrides and improve knip config (#1329)",
          "timestamp": "2026-06-15T18:38:16+02:00",
          "tree_id": "11318cc0b7e26f9781721ac1ccfa19056e7c9837",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/e2244016f958ce9be10e89ebd2996fb50ba2d51e"
        },
        "date": 1781541695736,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 0.0003,
            "range": "±0.19%",
            "unit": "ms"
          },
          {
            "name": "shallow-different-last-field",
            "value": 0.0003,
            "range": "±0.12%",
            "unit": "ms"
          },
          {
            "name": "nested-equal",
            "value": 0.0022,
            "range": "±0.23%",
            "unit": "ms"
          },
          {
            "name": "nested-different-array-length",
            "value": 0.001,
            "range": "±0.32%",
            "unit": "ms"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 0.0237,
            "range": "±0.35%",
            "unit": "ms"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 0.0017,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 0.0001,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 0.2695,
            "range": "±2.67%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 1.3451,
            "range": "±6.57%",
            "unit": "ms"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 4.7388,
            "range": "±2.12%",
            "unit": "ms"
          },
          {
            "name": "metadata-registry-load",
            "value": 0.132,
            "range": "±0.49%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-small",
            "value": 0.0003,
            "range": "±0.15%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-small",
            "value": 0.0003,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-small",
            "value": 0.0164,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 0.0023,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-medium",
            "value": 0.0023,
            "range": "±0.09%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 0.1034,
            "range": "±0.47%",
            "unit": "ms"
          },
          {
            "name": "metadata-lookup-large",
            "value": 0.0118,
            "range": "±0.11%",
            "unit": "ms"
          },
          {
            "name": "metadata-has-large",
            "value": 0.0118,
            "range": "±0.10%",
            "unit": "ms"
          },
          {
            "name": "fqn-resolution-large",
            "value": 0.433,
            "range": "±0.43%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 0.0434,
            "range": "±0.47%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 0.0015,
            "range": "±0.39%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 0.1425,
            "range": "±2.06%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 0.0096,
            "range": "±0.36%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 0.4466,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 0.0388,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "parseXml-small",
            "value": 0.0482,
            "range": "±0.56%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 0.0523,
            "range": "±0.49%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 0.0514,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "parseXml-medium",
            "value": 0.7039,
            "range": "±0.70%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 0.7392,
            "range": "±0.39%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 0.7418,
            "range": "±0.67%",
            "unit": "ms"
          },
          {
            "name": "parseXml-large",
            "value": 7.8155,
            "range": "±4.72%",
            "unit": "ms"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 7.3203,
            "range": "±0.35%",
            "unit": "ms"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 7.4167,
            "range": "±1.58%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 0.047,
            "range": "±1.53%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 0.5885,
            "range": "±2.17%",
            "unit": "ms"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 6.4509,
            "range": "±7.74%",
            "unit": "ms"
          }
        ]
      }
    ]
  }
}