window.BENCHMARK_DATA = {
  "lastUpdate": 1781691008181,
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
        "date": 1778164233207,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3532,
            "range": "±1.77%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 654,
            "range": "±1.68%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 167,
            "range": "±1.76%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 4881,
            "range": "±1.40%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 3534509,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 3525138,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 58307,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 383916,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 384338,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 9259,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 70349,
            "range": "±0.18%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 69943,
            "range": "±0.13%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2175,
            "range": "±0.57%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 20857,
            "range": "±0.44%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 678980,
            "range": "±0.44%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 6532,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 110025,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 1870,
            "range": "±0.31%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 26469,
            "range": "±0.55%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 17768,
            "range": "±0.62%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 16064,
            "range": "±0.56%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 16521,
            "range": "±0.43%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1215,
            "range": "±0.57%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1143,
            "range": "±0.53%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1146,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 109,
            "range": "±2.77%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 114,
            "range": "±1.12%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 113,
            "range": "±3.00%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 19972,
            "range": "±1.40%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1676,
            "range": "±1.13%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 153,
            "range": "±1.43%",
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
          "id": "46ada9060d46f2d6ac216da24597f39a4d6cf604",
          "message": "chore(ci): approve dependabot PR via REST API and track Node LTS (#1303)",
          "timestamp": "2026-05-12T12:05:20+02:00",
          "tree_id": "a4cd33806136d5f14e6b9779b78f26147e90b61f",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/46ada9060d46f2d6ac216da24597f39a4d6cf604"
        },
        "date": 1778580494947,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 4335,
            "range": "±2.42%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 897,
            "range": "±6.24%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 236,
            "range": "±3.09%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 9369,
            "range": "±0.57%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 4620752,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 4683480,
            "range": "±0.22%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 75723,
            "range": "±4.52%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 551835,
            "range": "±0.25%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 551250,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 12543,
            "range": "±0.39%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 108734,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 108866,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2937,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 29426,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 895981,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 9343,
            "range": "±1.82%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 136260,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2837,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 33167,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 26123,
            "range": "±0.50%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 22612,
            "range": "±0.67%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 23688,
            "range": "±0.56%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1684,
            "range": "±1.51%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1683,
            "range": "±0.36%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1696,
            "range": "±0.57%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 163,
            "range": "±4.24%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 169,
            "range": "±0.39%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 174,
            "range": "±0.81%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 28541,
            "range": "±1.09%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 2008,
            "range": "±2.84%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 197,
            "range": "±6.08%",
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
          "id": "ef64856d32536f53ff7b75ec7746d87a2755512d",
          "message": "fix(metadata): emit page-scoped DigitalExperience members (#1305)",
          "timestamp": "2026-05-15T11:38:21+02:00",
          "tree_id": "418523b363b7ca93f89e015acec1d81f909ae381",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/ef64856d32536f53ff7b75ec7746d87a2755512d"
        },
        "date": 1778838088729,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3729,
            "range": "±2.24%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 703,
            "range": "±6.85%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 207,
            "range": "±1.88%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 6721,
            "range": "±0.44%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 4086375,
            "range": "±0.08%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 4082683,
            "range": "±0.22%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 54401,
            "range": "±5.73%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 452508,
            "range": "±0.06%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 453939,
            "range": "±0.22%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 8087,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 82980,
            "range": "±0.07%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 82839,
            "range": "±0.07%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 1913,
            "range": "±0.44%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 22123,
            "range": "±0.50%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 647838,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 6590,
            "range": "±2.09%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 100806,
            "range": "±0.36%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2039,
            "range": "±0.64%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 24017,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 19214,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 17251,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 17592,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1314,
            "range": "±0.83%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1249,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1244,
            "range": "±0.61%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 121,
            "range": "±3.07%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 126,
            "range": "±0.43%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 126,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 20935,
            "range": "±1.51%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1559,
            "range": "±0.94%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 144,
            "range": "±4.08%",
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
          "id": "ecf95d535bc649b2f136044834974d29b254a2d0",
          "message": "refactor: drop async dependency in favor of in-house concurrency primitives (#1309)",
          "timestamp": "2026-05-25T17:37:41+02:00",
          "tree_id": "f6775328cff9bec90283a64c968616c4ce892e85",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/ecf95d535bc649b2f136044834974d29b254a2d0"
        },
        "date": 1779723643763,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3289,
            "range": "±3.35%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 594,
            "range": "±8.56%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 199,
            "range": "±3.19%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 7071,
            "range": "±1.17%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 3790016,
            "range": "±0.32%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 3854452,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 60321,
            "range": "±0.55%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 370000,
            "range": "±0.32%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 431545,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 9674,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 85326,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 85797,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2290,
            "range": "±0.49%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 23443,
            "range": "±0.56%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 687310,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 7145,
            "range": "±2.18%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 104992,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2272,
            "range": "±0.89%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 25343,
            "range": "±0.44%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 20171,
            "range": "±0.89%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 17949,
            "range": "±0.83%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 18408,
            "range": "±0.84%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1372,
            "range": "±1.02%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1287,
            "range": "±0.79%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1289,
            "range": "±0.87%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 99,
            "range": "±6.24%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 132,
            "range": "±0.59%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 128,
            "range": "±0.58%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 21299,
            "range": "±1.51%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1629,
            "range": "±2.30%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 124,
            "range": "±8.89%",
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
          "id": "8d40836a8a1d896def926bec6af055064ffc45fe",
          "message": "refactor: drop simple-git dependency in favor of in-house spawn-based helper (#1310)",
          "timestamp": "2026-05-25T18:17:13+02:00",
          "tree_id": "ad92f76318912762d86664e2b0d4f7611e348e8d",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/8d40836a8a1d896def926bec6af055064ffc45fe"
        },
        "date": 1779726003960,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3487,
            "range": "±2.42%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 729,
            "range": "±6.24%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 210,
            "range": "±1.88%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 7178,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 3494336,
            "range": "±0.12%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 3501170,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 61153,
            "range": "±0.29%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 459647,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 460712,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 9889,
            "range": "±0.29%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 72804,
            "range": "±0.29%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 78871,
            "range": "±0.15%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2321,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 23092,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 673401,
            "range": "±0.33%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 6792,
            "range": "±2.01%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 100809,
            "range": "±0.26%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2121,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 25018,
            "range": "±0.23%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 19108,
            "range": "±0.34%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 16970,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 17084,
            "range": "±0.34%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1303,
            "range": "±0.72%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1194,
            "range": "±0.68%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1202,
            "range": "±0.30%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 120,
            "range": "±4.35%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 121,
            "range": "±0.49%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 123,
            "range": "±0.27%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 21805,
            "range": "±1.40%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1682,
            "range": "±1.86%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 159,
            "range": "±6.22%",
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
          "id": "2acb86b4df1ca9932be9b14683ea404bc6c30ee9",
          "message": "refactor: drop fs-extra in favor of node:fs/promises wrapper (#1311)",
          "timestamp": "2026-05-25T18:49:04+02:00",
          "tree_id": "7e4b76f982a0629e6e8252722b7830f711f90f28",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/2acb86b4df1ca9932be9b14683ea404bc6c30ee9"
        },
        "date": 1779727911083,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3664,
            "range": "±2.81%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 735,
            "range": "±6.61%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 209,
            "range": "±2.31%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 7612,
            "range": "±0.57%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 3764214,
            "range": "±0.13%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 3738964,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 62542,
            "range": "±0.50%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 426347,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 425861,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 10030,
            "range": "±0.70%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 84933,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 84778,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2376,
            "range": "±0.52%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 23528,
            "range": "±0.55%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 685062,
            "range": "±0.48%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 7267,
            "range": "±2.27%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 105274,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2346,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 25543,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 20649,
            "range": "±0.58%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 18309,
            "range": "±0.59%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 18525,
            "range": "±0.53%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1421,
            "range": "±0.79%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1334,
            "range": "±0.51%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1336,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 123,
            "range": "±5.66%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 135,
            "range": "±0.39%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 134,
            "range": "±1.05%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 21336,
            "range": "±1.56%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1630,
            "range": "±2.35%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 151,
            "range": "±8.03%",
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
          "id": "2fda15de790ab8b2a29474a66f9bc51c67c8a00f",
          "message": "refactor: replace fast-equals with in-house deepEqualJson (#1312)",
          "timestamp": "2026-05-25T19:28:03+02:00",
          "tree_id": "ff2580ba1fa1e87314a020ea1146e906a828aa58",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/2fda15de790ab8b2a29474a66f9bc51c67c8a00f"
        },
        "date": 1779730237122,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 3451114,
            "range": "±0.14%",
            "unit": "ops/sec"
          },
          {
            "name": "shallow-different-last-field",
            "value": 3579495,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-equal",
            "value": 444880,
            "range": "±0.21%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-different-array-length",
            "value": 934389,
            "range": "±0.25%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 41428,
            "range": "±0.27%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 722783,
            "range": "±0.30%",
            "unit": "ops/sec"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 16063040,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3618,
            "range": "±2.36%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 705,
            "range": "±7.69%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 209,
            "range": "±2.61%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 7061,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 4304103,
            "range": "±0.15%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 4842113,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 59114,
            "range": "±4.79%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 480137,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 477191,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 10071,
            "range": "±0.27%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 80235,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 78966,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2351,
            "range": "±0.26%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 22580,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 666416,
            "range": "±0.31%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 6734,
            "range": "±2.08%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 98732,
            "range": "±0.30%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2112,
            "range": "±0.33%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 24592,
            "range": "±0.33%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 19112,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 16937,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 17253,
            "range": "±0.32%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1297,
            "range": "±0.68%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1213,
            "range": "±0.28%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1213,
            "range": "±0.29%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 113,
            "range": "±4.68%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 123,
            "range": "±0.18%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 123,
            "range": "±0.24%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 21284,
            "range": "±1.54%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1671,
            "range": "±2.02%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 162,
            "range": "±5.97%",
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
          "id": "53c010528baf7b538706f9ed7c1473fd254757d6",
          "message": "build: drop tslib by inlining TS helpers (importHelpers: false) (#1313)",
          "timestamp": "2026-05-25T21:17:21+02:00",
          "tree_id": "5bca0e4ef0f250c063acc251e269e733483c08e8",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/53c010528baf7b538706f9ed7c1473fd254757d6"
        },
        "date": 1779736804520,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 3518492,
            "range": "±0.17%",
            "unit": "ops/sec"
          },
          {
            "name": "shallow-different-last-field",
            "value": 3522301,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-equal",
            "value": 455271,
            "range": "±0.35%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-different-array-length",
            "value": 961880,
            "range": "±0.33%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 43699,
            "range": "±0.36%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 705273,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 15911344,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3508,
            "range": "±2.50%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 713,
            "range": "±6.29%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 186,
            "range": "±3.67%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 6634,
            "range": "±0.50%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 3597164,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 3589608,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 60389,
            "range": "±0.43%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 448593,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 454826,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 9650,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 76940,
            "range": "±0.13%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 77248,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2256,
            "range": "±0.59%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 22458,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 681505,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 6630,
            "range": "±2.16%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 102722,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2093,
            "range": "±0.39%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 25016,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 19533,
            "range": "±0.48%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 17398,
            "range": "±0.49%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 17747,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1242,
            "range": "±1.82%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1228,
            "range": "±0.39%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1226,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 119,
            "range": "±4.52%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 126,
            "range": "±0.31%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 124,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 22177,
            "range": "±1.45%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1683,
            "range": "±1.93%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 163,
            "range": "±6.28%",
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
          "id": "5c174875b570fa5789409432f2a8c497cf7cc256",
          "message": "fix(deps): pin direct dependencies to exact versions (#1314)",
          "timestamp": "2026-05-25T21:30:42+02:00",
          "tree_id": "b56668b0c6c948134688db669571855c367f6a3d",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/5c174875b570fa5789409432f2a8c497cf7cc256"
        },
        "date": 1779737610106,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 3450774,
            "range": "±0.16%",
            "unit": "ops/sec"
          },
          {
            "name": "shallow-different-last-field",
            "value": 3624151,
            "range": "±0.12%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-equal",
            "value": 450497,
            "range": "±0.36%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-different-array-length",
            "value": 961746,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 44681,
            "range": "±0.36%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 686228,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 16065858,
            "range": "±0.29%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3410,
            "range": "±2.73%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 685,
            "range": "±6.67%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 203,
            "range": "±2.52%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 6674,
            "range": "±0.60%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 4158562,
            "range": "±0.12%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 4215745,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 59867,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 465053,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 456702,
            "range": "±0.25%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 9471,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 80198,
            "range": "±0.12%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 80262,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2211,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 22201,
            "range": "±0.54%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 676174,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 6457,
            "range": "±2.37%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 101843,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2053,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 23530,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 19086,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 16484,
            "range": "±0.53%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 16868,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1246,
            "range": "±0.81%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1170,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1181,
            "range": "±0.44%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 111,
            "range": "±4.86%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 118,
            "range": "±0.35%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 108,
            "range": "±4.98%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 21572,
            "range": "±1.51%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1708,
            "range": "±1.92%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 155,
            "range": "±6.75%",
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
          "id": "9e787d0616ee26e398ce3147fbdce39432d3ed1b",
          "message": "fix: degrade gracefully when latest API version lookup is unreachable (#1318)",
          "timestamp": "2026-05-29T00:41:53+02:00",
          "tree_id": "33d19a2a142961badcadc3157f57ce750e7b8645",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/9e787d0616ee26e398ce3147fbdce39432d3ed1b"
        },
        "date": 1780008305830,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 3607011,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "shallow-different-last-field",
            "value": 3677030,
            "range": "±0.08%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-equal",
            "value": 433310,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-different-array-length",
            "value": 904726,
            "range": "±0.33%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 44527,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 827491,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 15779630,
            "range": "±0.08%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 4112,
            "range": "±2.24%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 713,
            "range": "±15.10%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 216,
            "range": "±2.39%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 6755,
            "range": "±0.39%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 3491282,
            "range": "±0.07%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 3589321,
            "range": "±0.07%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 56839,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 463861,
            "range": "±0.06%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 461495,
            "range": "±0.05%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 9260,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 83460,
            "range": "±0.08%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 83055,
            "range": "±0.06%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2192,
            "range": "±0.51%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 22019,
            "range": "±0.48%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 641304,
            "range": "±0.32%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 6690,
            "range": "±2.02%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 101472,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2105,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 23102,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 19300,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 17088,
            "range": "±0.48%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 17682,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1338,
            "range": "±0.68%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1232,
            "range": "±0.35%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1229,
            "range": "±0.63%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 123,
            "range": "±3.07%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 124,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 124,
            "range": "±0.36%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 21031,
            "range": "±1.60%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1580,
            "range": "±1.46%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 150,
            "range": "±4.43%",
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
          "id": "e41f345c2d38045109082da6beccd4789a2d6076",
          "message": "fix: detect changes in nested content-container folders (StaticResource, bundles) (#1322)\n\nStop metadata directory resolution at types that own their nested paths (inFolder types and content-container adapters: bundle/digitalExperience/mixedContent), so a nested content folder colliding with a metadata directoryName (e.g. an icons/ folder inside a StaticResource) no longer hides the change.\n\ncloses #1322",
          "timestamp": "2026-06-04T22:59:35+02:00",
          "tree_id": "c491a3dfca061bffa5a9ab9f50fa990c0d4292cb",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/e41f345c2d38045109082da6beccd4789a2d6076"
        },
        "date": 1780606960766,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 3575954,
            "range": "±0.13%",
            "unit": "ops/sec"
          },
          {
            "name": "shallow-different-last-field",
            "value": 3697980,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-equal",
            "value": 464361,
            "range": "±0.18%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-different-array-length",
            "value": 980821,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 42087,
            "range": "±0.35%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 615170,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 15665998,
            "range": "±0.18%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3220,
            "range": "±2.95%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 683,
            "range": "±8.94%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 205,
            "range": "±2.19%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 7559,
            "range": "±0.50%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 3987991,
            "range": "±0.13%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 4025819,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 60427,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 420758,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 420174,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 9128,
            "range": "±5.57%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 84607,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 84704,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2287,
            "range": "±0.43%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 23017,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 680076,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 7014,
            "range": "±2.28%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 109222,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2276,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 25589,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 20937,
            "range": "±0.51%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 18715,
            "range": "±0.51%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 18241,
            "range": "±1.02%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1425,
            "range": "±0.78%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1349,
            "range": "±0.50%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1362,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 130,
            "range": "±4.80%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 137,
            "range": "±0.34%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 137,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 20786,
            "range": "±1.77%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1579,
            "range": "±2.42%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 152,
            "range": "±7.41%",
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
          "id": "e2244016f958ce9be10e89ebd2996fb50ba2d51e",
          "message": "fix(deps): remove all unnecessary overrides and improve knip config (#1329)",
          "timestamp": "2026-06-15T18:38:16+02:00",
          "tree_id": "11318cc0b7e26f9781721ac1ccfa19056e7c9837",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/e2244016f958ce9be10e89ebd2996fb50ba2d51e"
        },
        "date": 1781541693449,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 3435953,
            "range": "±0.19%",
            "unit": "ops/sec"
          },
          {
            "name": "shallow-different-last-field",
            "value": 3571777,
            "range": "±0.12%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-equal",
            "value": 454627,
            "range": "±0.23%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-different-array-length",
            "value": 988553,
            "range": "±0.32%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 42168,
            "range": "±0.35%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 603134,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 15562837,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3711,
            "range": "±2.67%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 743,
            "range": "±6.57%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 211,
            "range": "±2.12%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 7575,
            "range": "±0.49%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 3589083,
            "range": "±0.15%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 3738019,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 60834,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 440642,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 441635,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 9669,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 84817,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 84850,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2310,
            "range": "±0.43%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 23031,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 679082,
            "range": "±0.39%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 7017,
            "range": "±2.06%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 104331,
            "range": "±0.36%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2239,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 25742,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 20765,
            "range": "±0.56%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 19105,
            "range": "±0.49%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 19448,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1421,
            "range": "±0.70%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1353,
            "range": "±0.39%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1348,
            "range": "±0.67%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 128,
            "range": "±4.72%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 137,
            "range": "±0.35%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 135,
            "range": "±1.58%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 21283,
            "range": "±1.53%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1699,
            "range": "±2.17%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 155,
            "range": "±7.74%",
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
          "id": "24dd5222d3e6dab66cc832efd7cfea252a4a4f72",
          "message": "feat(metadata): refresh SDR registry to 12.36.3\n\nBumps @salesforce/source-deploy-retrieve from 12.36.2 to 12.36.3.",
          "timestamp": "2026-06-17T11:45:31+02:00",
          "tree_id": "86cf1ee0ffa192b61ffd2445029dc4e4ea78a8b8",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/24dd5222d3e6dab66cc832efd7cfea252a4a4f72"
        },
        "date": 1781689720635,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 3583421,
            "range": "±0.17%",
            "unit": "ops/sec"
          },
          {
            "name": "shallow-different-last-field",
            "value": 3668886,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-equal",
            "value": 465518,
            "range": "±0.17%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-different-array-length",
            "value": 980799,
            "range": "±0.31%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 42148,
            "range": "±0.32%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 614075,
            "range": "±0.39%",
            "unit": "ops/sec"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 15398952,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3713,
            "range": "±2.72%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 733,
            "range": "±6.32%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 191,
            "range": "±3.68%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 7575,
            "range": "±0.53%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 3963510,
            "range": "±0.17%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 4046364,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 60978,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 434455,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 435397,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 9730,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 80642,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 80778,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2258,
            "range": "±0.52%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 22739,
            "range": "±0.57%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 696572,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 7073,
            "range": "±2.23%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 103161,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2240,
            "range": "±0.60%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 25312,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 20933,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 18888,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 19261,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1425,
            "range": "±0.68%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1294,
            "range": "±1.20%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1356,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 123,
            "range": "±6.25%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 132,
            "range": "±2.31%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 135,
            "range": "±0.34%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 21440,
            "range": "±1.48%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1682,
            "range": "±2.21%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 157,
            "range": "±7.53%",
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
          "id": "8eebeb2108c3ee0cdd2cb7b0d56bd0806303d921",
          "message": "fix: escape XML entities in generated manifest member names (#1332)",
          "timestamp": "2026-06-17T11:49:04+02:00",
          "tree_id": "165c696626b11ebc970c6a83d9020238b2006abc",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/8eebeb2108c3ee0cdd2cb7b0d56bd0806303d921"
        },
        "date": 1781689948683,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 3356789,
            "range": "±0.17%",
            "unit": "ops/sec"
          },
          {
            "name": "shallow-different-last-field",
            "value": 3579619,
            "range": "±0.13%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-equal",
            "value": 462800,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-different-array-length",
            "value": 966276,
            "range": "±0.43%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 43832,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 690265,
            "range": "±0.53%",
            "unit": "ops/sec"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 16078950,
            "range": "±0.13%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 3516,
            "range": "±2.89%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 696,
            "range": "±6.80%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 208,
            "range": "±2.37%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 6883,
            "range": "±0.54%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 4112589,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 4138495,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 54640,
            "range": "±5.16%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 459365,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 459292,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 9128,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 81113,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 80917,
            "range": "±0.11%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2142,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 22381,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 649137,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 6489,
            "range": "±2.18%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 101368,
            "range": "±0.39%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2094,
            "range": "±0.34%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 23289,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 19083,
            "range": "±0.59%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 16976,
            "range": "±0.63%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 17343,
            "range": "±0.55%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1299,
            "range": "±1.07%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1222,
            "range": "±0.49%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1219,
            "range": "±0.46%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 113,
            "range": "±4.73%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 123,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 123,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 20247,
            "range": "±1.30%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 1593,
            "range": "±2.73%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 150,
            "range": "±6.97%",
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
          "id": "fff83dd78daf35ea87019f56f2dc31e5d6e568d1",
          "message": "fix: resolve nested Wave (and virtual content-container) files dropped from package.xml (#1335)",
          "timestamp": "2026-06-17T12:06:53+02:00",
          "tree_id": "a99c114ac585c08236e572bc995356bf95e0bffe",
          "url": "https://github.com/scolladon/sfdx-git-delta/commit/fff83dd78daf35ea87019f56f2dc31e5d6e568d1"
        },
        "date": 1781691007460,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "shallow-equal",
            "value": 4361357,
            "range": "±0.89%",
            "unit": "ops/sec"
          },
          {
            "name": "shallow-different-last-field",
            "value": 4681668,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-equal",
            "value": 588540,
            "range": "±0.18%",
            "unit": "ops/sec"
          },
          {
            "name": "nested-different-array-length",
            "value": 1249838,
            "range": "±0.39%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-equal",
            "value": 53244,
            "range": "±0.35%",
            "unit": "ops/sec"
          },
          {
            "name": "array-of-100-elements-last-differs",
            "value": 699829,
            "range": "±0.43%",
            "unit": "ops/sec"
          },
          {
            "name": "same-reference-short-circuit",
            "value": 20516212,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-small",
            "value": 4745,
            "range": "±2.68%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-medium",
            "value": 963,
            "range": "±6.10%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-handler-dispatch-large",
            "value": 264,
            "range": "±2.49%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-registry-load",
            "value": 9540,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-small",
            "value": 5069831,
            "range": "±0.12%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-small",
            "value": 5053660,
            "range": "±0.10%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-small",
            "value": 67809,
            "range": "±4.65%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-medium",
            "value": 583618,
            "range": "±0.08%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-medium",
            "value": 584681,
            "range": "±0.08%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-medium",
            "value": 12725,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-lookup-large",
            "value": 106952,
            "range": "±0.09%",
            "unit": "ops/sec"
          },
          {
            "name": "metadata-has-large",
            "value": 107100,
            "range": "±0.08%",
            "unit": "ops/sec"
          },
          {
            "name": "fqn-resolution-large",
            "value": 2912,
            "range": "±0.85%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-tree-scope",
            "value": 28779,
            "range": "±0.57%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-manifest-aggregation",
            "value": 813480,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-tree-scope",
            "value": 9146,
            "range": "±2.66%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-manifest-aggregation",
            "value": 128275,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-tree-scope",
            "value": 2963,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-manifest-aggregation",
            "value": 32422,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-small",
            "value": 25885,
            "range": "±0.84%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-small",
            "value": 24308,
            "range": "±0.55%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-small",
            "value": 24778,
            "range": "±0.45%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-medium",
            "value": 1853,
            "range": "±0.70%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-medium",
            "value": 1750,
            "range": "±0.41%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-medium",
            "value": 1752,
            "range": "±0.42%",
            "unit": "ops/sec"
          },
          {
            "name": "parseXml-large",
            "value": 166,
            "range": "±3.34%",
            "unit": "ops/sec"
          },
          {
            "name": "parseToSidePropagating-large",
            "value": 173,
            "range": "±1.28%",
            "unit": "ops/sec"
          },
          {
            "name": "parseFromSideSwallowing-large",
            "value": 173,
            "range": "±1.24%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-smallLabels",
            "value": 27609,
            "range": "±1.27%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-mediumProfile",
            "value": 2022,
            "range": "±1.93%",
            "unit": "ops/sec"
          },
          {
            "name": "writeXmlDocument-largeProfile",
            "value": 197,
            "range": "±6.49%",
            "unit": "ops/sec"
          }
        ]
      }
    ]
  }
}