window.BENCHMARK_DATA = {
  "lastUpdate": 1778149995203,
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
        "date": 1776839148679,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3694,
            "range": "±1.92%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 565,
            "range": "±2.44%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 139,
            "range": "±4.27%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 5743,
            "range": "±1.63%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 47124,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 45664,
            "range": "±0.36%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 24943,
            "range": "±0.50%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 7549,
            "range": "±0.51%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 7184,
            "range": "±0.60%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 4000,
            "range": "±0.53%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 1818,
            "range": "±1.00%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 1780,
            "range": "±0.58%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 964,
            "range": "±0.50%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 15050,
            "range": "±0.53%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 1095076,
            "range": "±0.53%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 3593,
            "range": "±0.48%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 210072,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 947,
            "range": "±0.74%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 48707,
            "range": "±0.46%",
            "unit": "ops/sec"
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
        "date": 1776925578481,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3439,
            "range": "±1.82%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 528,
            "range": "±2.55%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 149,
            "range": "±1.55%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 5108,
            "range": "±1.43%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 43896,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 43478,
            "range": "±0.30%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 24402,
            "range": "±0.39%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 7070,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 6943,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 3920,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 1724,
            "range": "±0.32%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 1699,
            "range": "±0.27%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 931,
            "range": "±1.67%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 14606,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 1136293,
            "range": "±0.44%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 3686,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 206994,
            "range": "±0.34%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 996,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 45311,
            "range": "±0.39%",
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
          "id": "01f741311bf0eecee7dc6ce5b178e686dd8a28ba",
          "message": "feat: --changes-manifest for review-centric change-kind output (#1281)\n\nCo-authored-by: Stefanvdk <10604623+Stefanvdk@users.noreply.github.com>nv",
          "timestamp": "2026-04-23T09:21:14+02:00",
          "tree_id": "08f7109cd86acc229141426a1a4cf98c4408558f",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/01f741311bf0eecee7dc6ce5b178e686dd8a28ba"
        },
        "date": 1776929036212,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3776,
            "range": "±1.91%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 576,
            "range": "±2.15%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 157,
            "range": "±1.87%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 5706,
            "range": "±1.57%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 45854,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 45943,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 23615,
            "range": "±0.55%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 7391,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 7258,
            "range": "±0.52%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 3846,
            "range": "±0.54%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 1805,
            "range": "±0.43%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 1782,
            "range": "±0.59%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 917,
            "range": "±1.02%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 16211,
            "range": "±0.53%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 677739,
            "range": "±0.53%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 3953,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 109754,
            "range": "±0.44%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 1053,
            "range": "±0.43%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 27905,
            "range": "±0.47%",
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
          "id": "df3c8330076517fa1fdc9f73e60ce1ac54867ab2",
          "message": "feat(pipeline): streaming I/O end-to-end + txml + lookup caches (#1284)",
          "timestamp": "2026-04-27T20:42:55+02:00",
          "tree_id": "0e74cf12bddeeee4bbc000bb4104137843e1e870",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/df3c8330076517fa1fdc9f73e60ce1ac54867ab2"
        },
        "date": 1777316405188,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3811,
            "range": "±2.34%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 680,
            "range": "±2.19%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 163,
            "range": "±3.15%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 5168,
            "range": "±2.05%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 3226535,
            "range": "±0.08%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 3318696,
            "range": "±0.18%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 53521,
            "range": "±0.86%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 390340,
            "range": "±0.26%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 427985,
            "range": "±0.32%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 8712,
            "range": "±0.87%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 78023,
            "range": "±0.07%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 77414,
            "range": "±0.08%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2049,
            "range": "±1.06%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 21486,
            "range": "±0.82%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 628052,
            "range": "±0.93%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 7079,
            "range": "±0.76%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 105241,
            "range": "±0.71%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2090,
            "range": "±0.66%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 25394,
            "range": "±0.69%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 17446,
            "range": "±1.03%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 16264,
            "range": "±0.87%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 16542,
            "range": "±0.79%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1183,
            "range": "±0.99%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1140,
            "range": "±0.81%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1136,
            "range": "±0.81%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 100,
            "range": "±3.18%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 115,
            "range": "±1.67%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 105,
            "range": "±7.21%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 17839,
            "range": "±1.47%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1366,
            "range": "±1.51%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 125,
            "range": "±1.61%",
            "unit": "ops/sec"
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
        "date": 1777443981085,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3428,
            "range": "±2.25%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 614,
            "range": "±2.73%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 161,
            "range": "±2.31%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 5064,
            "range": "±1.68%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 3611204,
            "range": "±0.12%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 3652323,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 54055,
            "range": "±0.88%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 380211,
            "range": "±0.27%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 384371,
            "range": "±0.29%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 8705,
            "range": "±0.99%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 71336,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 71957,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2030,
            "range": "±1.09%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 19770,
            "range": "±0.81%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 696826,
            "range": "±0.80%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 6283,
            "range": "±0.65%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 107038,
            "range": "±0.69%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 1822,
            "range": "±0.65%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 25788,
            "range": "±0.78%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 15834,
            "range": "±0.93%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 15478,
            "range": "±0.66%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 15774,
            "range": "±0.65%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1180,
            "range": "±0.81%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1097,
            "range": "±0.99%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1110,
            "range": "±0.51%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 104,
            "range": "±2.82%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 109,
            "range": "±2.12%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 107,
            "range": "±3.47%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 17913,
            "range": "±1.91%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1342,
            "range": "±2.36%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 127,
            "range": "±5.43%",
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
          "id": "10d7aa069d162fc51ce166c85f314165484f9f54",
          "message": "chore(ci): describe new SDR metadata in dependabot auto-merge title (#1290)",
          "timestamp": "2026-04-29T10:54:42+02:00",
          "tree_id": "09b2560fb9a89b78ba8d62f8864e28ecd633858a",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/10d7aa069d162fc51ce166c85f314165484f9f54"
        },
        "date": 1777453061159,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3404,
            "range": "±2.37%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 639,
            "range": "±2.12%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 143,
            "range": "±5.70%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 4742,
            "range": "±1.73%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 3487537,
            "range": "±0.12%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 3459941,
            "range": "±0.12%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 51657,
            "range": "±0.91%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 378280,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 377724,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 8663,
            "range": "±0.79%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 70089,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 70788,
            "range": "±0.25%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2015,
            "range": "±0.95%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 20047,
            "range": "±0.80%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 660556,
            "range": "±0.83%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 6358,
            "range": "±0.71%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 111547,
            "range": "±0.73%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 1729,
            "range": "±1.15%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 25430,
            "range": "±0.68%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 16521,
            "range": "±1.03%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 16080,
            "range": "±0.78%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 16364,
            "range": "±0.68%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1176,
            "range": "±1.54%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1125,
            "range": "±1.20%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1148,
            "range": "±0.64%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 105,
            "range": "±3.73%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 114,
            "range": "±1.58%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 113,
            "range": "±2.39%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 18342,
            "range": "±1.98%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1563,
            "range": "±1.44%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 141,
            "range": "±1.72%",
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
          "id": "380a8e00ad7823701a550933fcc91edbbd481f30",
          "message": "fix(metadata): emit parent container in package.xml when generateDelta is off (#1298)",
          "timestamp": "2026-05-07T12:29:46+02:00",
          "tree_id": "6062c6381cb47d91ee2ab37abc505f1cf609d57b",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/380a8e00ad7823701a550933fcc91edbbd481f30"
        },
        "date": 1778149994513,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 4023,
            "range": "±2.23%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 670,
            "range": "±2.47%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 163,
            "range": "±3.38%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 5471,
            "range": "±1.76%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 3367604,
            "range": "±0.13%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 3336689,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 58581,
            "range": "±0.81%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 386092,
            "range": "±0.25%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 387660,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 9463,
            "range": "±0.81%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 75884,
            "range": "±0.27%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 76082,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2224,
            "range": "±0.81%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 21659,
            "range": "±0.70%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 667212,
            "range": "±0.68%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 6836,
            "range": "±0.65%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 112775,
            "range": "±0.62%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 1979,
            "range": "±0.62%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 27743,
            "range": "±0.62%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 19272,
            "range": "±0.82%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 17851,
            "range": "±0.73%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 18116,
            "range": "±0.61%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1340,
            "range": "±0.89%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1257,
            "range": "±0.71%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1268,
            "range": "±0.66%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 112,
            "range": "±3.02%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 117,
            "range": "±7.57%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 113,
            "range": "±8.29%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 20859,
            "range": "±1.17%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1579,
            "range": "±1.22%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 136,
            "range": "±3.92%",
            "unit": "ops/sec"
          }
        ]
      }
    ]
  }
}